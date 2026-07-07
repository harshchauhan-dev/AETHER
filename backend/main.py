"""
AETHER FastAPI Backend — Space Intelligence Operating System API.
"""
from datetime import datetime
import random
from typing import List, Dict, Any, Optional

import asyncio
from fastapi import FastAPI, Depends, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import (
    init_db, SessionLocal,
    log_occupant_snapshot, log_environmental_snapshot, log_alerts,
    save_chat_message, get_chat_history, get_occupancy_heatmap,
    get_recent_alerts, clear_all_history,
)
from aether.perception.simulator import BuildingSimulator
from aether.understanding.spatial_model import SpatialLayout
from aether.understanding.tracker import StateTracker
from aether.prediction.forecaster import Forecaster
from aether.decision.decision_engine import DecisionEngine
from aether.learning.memory import EnvironmentalMemory
from aether.interface.agent import AETHERAgent

# ─── Initialise database ────────────────────────────────────────────────────
init_db()

# ─── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(title="AETHER Space Intelligence OS API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Database dependency ────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Bootstrap Multi-Sector States ──────────────────────────────────────────

def create_sector_instance(sector_id: str, name: str, ping_base: int):
    layout = SpatialLayout()
    sim = BuildingSimulator(rooms=list(layout.rooms.keys()), connections=layout.connections)

    # Register occupants (using patients/nurses inside database mappings, but mapped to drone/civilians)
    sim.add_entity("civilian_1", "patient", "ICU-1")
    sim.add_entity("civilian_2", "patient", "ICU-2")
    sim.add_entity("civilian_3", "patient", "Ward-3")
    sim.add_entity("civilian_4", "patient", "Ward-4")
    sim.add_entity("field_agent_bob", "nurse", "Staff-Station")
    sim.add_entity("field_agent_alice", "nurse", "Staff-Station")
    sim.add_entity("recon_drone_1", "visitor", "Corridor")

    tracker = StateTracker(layout)
    tracker.register_tag("TAG-PATIENT_1", "civilian_1", "patient")
    tracker.register_tag("TAG-PATIENT_2", "civilian_2", "patient")
    tracker.register_tag("TAG-PATIENT_3", "civilian_3", "patient")
    tracker.register_tag("TAG-PATIENT_4", "civilian_4", "patient")
    tracker.register_tag("TAG-NURSE_BOB", "field_agent_bob", "nurse")
    tracker.register_tag("TAG-NURSE_ALICE", "field_agent_alice", "nurse")

    forecaster = Forecaster(tracker, layout)
    engine = DecisionEngine(tracker, layout)
    memory = EnvironmentalMemory()

    return {
        "id": sector_id,
        "name": name,
        "layout": layout,
        "sim": sim,
        "tracker": tracker,
        "forecaster": forecaster,
        "engine": engine,
        "memory": memory,
        "ping": ping_base,
        "csi_quality": 0.98,
        "csi_packets": 550,
        "step": 0
    }

def bootstrap_sectors():
    states = {
        "metro_care": create_sector_instance("metro_care", "Metro Grid Hub", 12),
        "mercy_general": create_sector_instance("mercy_general", "Industrial Complex", 18),
        "st_jude": create_sector_instance("st_jude", "Logistics Port", 24),
        "aether_labs": create_sector_instance("aether_labs", "Orbital Uplink Command", 8),
        "kolkata_grid": create_sector_instance("kolkata_grid", "Kolkata Grid", 15),
        "hyderabad_hub": create_sector_instance("hyderabad_hub", "Hyderabad Hub", 14)
    }
    
    # Pre-inject some alert states
    states["mercy_general"]["sim"].trigger_fire("Kitchen")
    states["st_jude"]["sim"].trigger_fall("civilian_1")
    
    return states

hospitals = bootstrap_sectors()  # Keep variable named hospitals for backward compatibility with router endpoints
agent = AETHERAgent(hospitals)


# ─── Pydantic schemas ────────────────────────────────────────────────────────

class HospitalMetaOut(BaseModel):
    id: str
    name: str
    coords: List[float]    # [lat, lng] geographic coordinates
    active_alerts_count: int
    ping: int
    csi_quality: float
    csi_packets: int
    status: str

class OccupantOut(BaseModel):
    entity_id: str
    role: str
    current_room: str
    posture: str
    activity: str
    breathing_rate: Optional[float] = None
    inactivity_duration: float = 0.0
    pos_x: float
    pos_y: float
    pos_z: float
    sigma_points: List[List[float]] = []

class RoomOut(BaseModel):
    room_id: str
    room_type: str
    temperature: float
    smoke_ppm: float
    is_hazard: bool
    pos: tuple

class AlertOut(BaseModel):
    entity_id: Optional[str] = None
    room_id: str
    type: str
    severity: str
    message: str

class PredictionOut(BaseModel):
    alert_type: str
    room_id: str
    entity_id: Optional[str] = None
    probability: float
    description: str

class ActionOut(BaseModel):
    action_type: str
    target_room: str
    description: str
    route: Optional[List[str]] = None
    assigned_responder_id: Optional[str] = None
    severity: str

class HospitalStateOut(BaseModel):
    id: str
    name: str
    sim_time: str
    step: int
    ping: int
    csi_quality: float
    csi_packets: int
    occupants: List[OccupantOut]
    rooms: List[RoomOut]
    alerts: List[AlertOut]
    predictions: List[PredictionOut]
    actions: List[ActionOut]
    hazards: List[str]
    connections: List[tuple]

class ChatRequest(BaseModel):
    message: str
    hospital_id: str

class ChatResponse(BaseModel):
    response: str
    history: List[Dict[str, str]]

class TriggerRequest(BaseModel):
    hospital_id: str
    target: str

class SimulationConfig(BaseModel):
    fire_spread_rate: float
    csi_noise_level: str
    occupant_speed: str
    convection_rate: float = 0.15
    social_force_weight: float = 1.5
    desired_velocity: float = 1.2

class SpawnRequest(BaseModel):
    hospital_id: str
    entity_id: str
    role: str
    room_id: str

class TempOverrideRequest(BaseModel):
    hospital_id: str
    room_id: str
    temperature: float


# ─── Coords Mapping ──────────────────────────────────────────────────────────
HOSPITAL_COORDS = {
    "metro_care":     [28.6139, 77.2090],   # New Delhi, India
    "mercy_general":  [19.0760, 72.8777],   # Mumbai, India
    "st_jude":        [13.0827, 80.2707],   # Chennai, India
    "aether_labs":    [12.9716, 77.5946],   # Bangalore, India
    "kolkata_grid":   [22.5726, 88.3639],   # Kolkata, India
    "hyderabad_hub":  [17.3850, 78.4867],   # Hyderabad, India
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def build_hospital_state(hid: str) -> HospitalStateOut:
    h = hospitals.get(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Sector not found")
        
    layout = h["layout"]
    tracker = h["tracker"]
    forecaster = h["forecaster"]
    engine = h["engine"]

    occupants = [
        OccupantOut(
            entity_id=o.entity_id,
            role=o.role,
            current_room=o.current_room,
            posture=o.posture,
            activity=o.activity,
            breathing_rate=o.breathing_rate,
            inactivity_duration=o.inactivity_duration,
            pos_x=o.pos_x,
            pos_y=o.pos_y,
            pos_z=o.pos_z,
            sigma_points=o.sigma_points,
        )
        for o in tracker.occupants.values()
    ]

    rooms = []
    for room_id, info in layout.rooms.items():
        attrs = layout.graph.nodes[room_id]
        rooms.append(RoomOut(
            room_id=room_id,
            room_type=info["type"],
            temperature=attrs.get("temperature", 21.5),
            smoke_ppm=attrs.get("smoke_ppm", 0.0),
            is_hazard=attrs.get("hazard", False),
            pos=info["pos"],
        ))

    raw_alerts = tracker.get_active_alerts()
    alerts = [AlertOut(**a) for a in raw_alerts]

    preds = forecaster.predict()
    predictions = [
        PredictionOut(
            alert_type=p.alert_type,
            room_id=p.room_id,
            entity_id=p.entity_id,
            probability=p.probability,
            description=p.description,
        )
        for p in preds
    ]

    recs = engine.get_recommendations()
    actions = [
        ActionOut(
            action_type=r.action_type,
            target_room=r.target_room,
            description=r.description,
            route=r.route,
            assigned_responder_id=r.assigned_responder_id,
            severity=r.severity,
        )
        for r in recs
    ]

    return HospitalStateOut(
        id=hid,
        name=h["name"],
        sim_time=h["sim"].time.strftime("%Y-%m-%d %H:%M:%S"),
        step=h["step"],
        ping=h["ping"],
        csi_quality=h["csi_quality"],
        csi_packets=h["csi_packets"],
        occupants=occupants,
        rooms=rooms,
        alerts=alerts,
        predictions=predictions,
        actions=actions,
        hazards=layout.get_active_hazards(),
        connections=layout.connections,
    )


# ─── WebSocket Connection Manager ───────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # Maps sector_id (hospital_id) to list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, sector_id: str):
        await websocket.accept()
        if sector_id not in self.active_connections:
            self.active_connections[sector_id] = []
        self.active_connections[sector_id].append(websocket)
        
        # Immediately send the latest state upon connection
        try:
            state_data = build_hospital_state(sector_id)
            await websocket.send_json(jsonable_encoder(state_data))
        except Exception as e:
            print(f"Error sending initial state to websocket for {sector_id}: {e}")

    def disconnect(self, websocket: WebSocket, sector_id: str):
        if sector_id in self.active_connections:
            if websocket in self.active_connections[sector_id]:
                self.active_connections[sector_id].remove(websocket)

    async def broadcast_sector_state(self, sector_id: str, state_data: dict):
        if sector_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[sector_id]:
                try:
                    await connection.send_json(state_data)
                except Exception:
                    disconnected.append(connection)
            for conn in disconnected:
                self.disconnect(conn, sector_id)

manager = ConnectionManager()


# ─── Simulation Background Manager ──────────────────────────────────────────

class SimulationManager:
    def __init__(self):
        self.is_playing = False
        self.sim_speed = 1.0
        self.lock = asyncio.Lock()
        self.fire_spread_rate = 8.5
        self.csi_noise_level = "moderate"
        self.occupant_speed = "normal"
        self.convection_rate = 0.15
        self.social_force_weight = 1.5
        self.desired_velocity = 1.2

sim_manager = SimulationManager()


# ─── Background Simulation Loop ──────────────────────────────────────────────

def tick_all_sectors_internal(db: Session):
    """Internal helper to tick all simulations once and log to DB (assumes lock is held)."""
    for hid, h in hospitals.items():
        sim = h["sim"]
        tracker = h["tracker"]
        layout = h["layout"]
        memory = h["memory"]

        # Fluctuates network quality
        h["ping"] = max(5, int(h["ping"] + random.choice([-2, -1, 0, 1, 2])))
        h["csi_quality"] = min(1.0, max(0.85, h["csi_quality"] + random.choice([-0.01, -0.005, 0, 0.005, 0.01])))
        h["csi_packets"] = max(100, int(h["csi_packets"] + random.choice([-10, -5, 0, 5, 10])))

        # Core simulation advance
        telemetry = sim.tick()
        tracker.process_telemetry(telemetry)
        memory.log_tick(sim.time, tracker.occupants, layout.graph)
        h["step"] += 1

        # Persistent SQLite logging
        log_occupant_snapshot(db, hid, sim.time, tracker.occupants)
        log_environmental_snapshot(db, hid, sim.time, layout.graph.nodes(data=True))
        raw_alerts = tracker.get_active_alerts()
        if raw_alerts:
            log_alerts(db, hid, sim.time, raw_alerts)

async def run_simulation_loop():
    while True:
        if sim_manager.is_playing:
            async with sim_manager.lock:
                db = SessionLocal()
                try:
                    tick_all_sectors_internal(db)
                except Exception as e:
                    print(f"Error ticking in background simulation loop: {e}")
                finally:
                    db.close()

            # Broadcast updates via WebSockets for all sectors
            for hid in list(hospitals.keys()):
                try:
                    state_data = build_hospital_state(hid)
                    await manager.broadcast_sector_state(hid, jsonable_encoder(state_data))
                except Exception as e:
                    print(f"Error broadcasting state in loop for {hid}: {e}")

        # Sleep duration dynamically changes based on sim_speed multiplier
        sleep_time = max(0.01, 1.0 / sim_manager.sim_speed)
        await asyncio.sleep(sleep_time)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(run_simulation_loop())


# ─── Simulation Control & WebSockets ────────────────────────────────────────

@app.get("/api/simulation/status")
def get_simulation_status():
    return {
        "is_playing": sim_manager.is_playing,
        "sim_speed": sim_manager.sim_speed,
        "fire_spread_rate": sim_manager.fire_spread_rate,
        "csi_noise_level": sim_manager.csi_noise_level,
        "occupant_speed": sim_manager.occupant_speed,
        "convection_rate": getattr(sim_manager, "convection_rate", 0.15),
        "social_force_weight": getattr(sim_manager, "social_force_weight", 1.5),
        "desired_velocity": getattr(sim_manager, "desired_velocity", 1.2)
    }

@app.post("/api/simulation/start")
async def start_simulation():
    async with sim_manager.lock:
        sim_manager.is_playing = True
    return {
        "status": "started",
        "is_playing": True,
        "sim_speed": sim_manager.sim_speed
    }

@app.post("/api/simulation/pause")
async def pause_simulation():
    async with sim_manager.lock:
        sim_manager.is_playing = False
    return {
        "status": "paused",
        "is_playing": False,
        "sim_speed": sim_manager.sim_speed
    }

@app.post("/api/simulation/speed")
async def change_simulation_speed(speed: float = Query(..., description="Simulation speed multiplier")):
    if speed <= 0:
        raise HTTPException(status_code=400, detail="Speed must be greater than 0")
    async with sim_manager.lock:
        sim_manager.sim_speed = speed
    return {
        "status": f"speed set to {speed}x",
        "is_playing": sim_manager.is_playing,
        "sim_speed": speed
    }

@app.post("/api/simulation/configure")
async def configure_simulation(config: SimulationConfig):
    async with sim_manager.lock:
        sim_manager.fire_spread_rate = config.fire_spread_rate
        sim_manager.csi_noise_level = config.csi_noise_level
        sim_manager.occupant_speed = config.occupant_speed
        sim_manager.convection_rate = config.convection_rate
        sim_manager.social_force_weight = config.social_force_weight
        sim_manager.desired_velocity = config.desired_velocity
        
        # Propagate config to all sectors' simulators
        for hid, h in hospitals.items():
            h["sim"].configure_simulator(
                fire_spread_rate=config.fire_spread_rate,
                csi_noise_level=config.csi_noise_level,
                occupant_speed=config.occupant_speed,
                convection_rate=config.convection_rate,
                social_force_weight=config.social_force_weight,
                desired_velocity=config.desired_velocity
            )
            
            # Broadcast state update immediately via WebSockets
            try:
                state_data = build_hospital_state(hid)
                await manager.broadcast_sector_state(hid, jsonable_encoder(state_data))
            except Exception as e:
                print(f"Error broadcasting state in config change: {e}")
                
    return {
        "status": "configured",
        "fire_spread_rate": sim_manager.fire_spread_rate,
        "csi_noise_level": sim_manager.csi_noise_level,
        "occupant_speed": sim_manager.occupant_speed,
        "convection_rate": sim_manager.convection_rate,
        "social_force_weight": sim_manager.social_force_weight,
        "desired_velocity": sim_manager.desired_velocity
    }

@app.websocket("/api/ws/{sector_id}")
async def websocket_endpoint(websocket: WebSocket, sector_id: str):
    if sector_id not in hospitals:
        await websocket.close(code=4004)
        return
    await manager.connect(websocket, sector_id)
    try:
        while True:
            # Keep connection open and detect client disconnect
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, sector_id)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/api/hospitals", response_model=List[HospitalMetaOut])
def get_hospitals():
    """Return GIS regional layout list of all campuses."""
    res = []
    for hid, h in hospitals.items():
        alerts_count = len(h["tracker"].get_active_alerts())
        status = "normal"
        if alerts_count > 0:
            status = "emergency"
            
        res.append(HospitalMetaOut(
            id=hid,
            name=h["name"],
            coords=HOSPITAL_COORDS[hid],
            active_alerts_count=alerts_count,
            ping=h["ping"],
            csi_quality=h["csi_quality"],
            csi_packets=h["csi_packets"],
            status=status
        ))
    return res


@app.get("/api/hospitals/{hid}/state", response_model=HospitalStateOut)
def get_hospital_state(hid: str):
    """Return local detailed spatial layout state for a hospital."""
    return build_hospital_state(hid)


@app.post("/api/tick")
async def tick_all(active_id: str = "metro_care", db: Session = Depends(get_db)):
    """
    Ticks all hospital simulations by 1s, fluctuates network quality metrics,
    logs snapshot data to SQLite, and returns the state of the active hospital.
    """
    async with sim_manager.lock:
        tick_all_sectors_internal(db)

    # Broadcast updates via WebSockets for all sectors
    for hid in list(hospitals.keys()):
        try:
            state_data = build_hospital_state(hid)
            await manager.broadcast_sector_state(hid, jsonable_encoder(state_data))
        except Exception as e:
            print(f"Error broadcasting state in manual tick: {e}")

    return build_hospital_state(active_id)


@app.post("/api/trigger/fall", response_model=HospitalStateOut)
async def trigger_fall(req: TriggerRequest, db: Session = Depends(get_db)):
    async with sim_manager.lock:
        h = hospitals.get(req.hospital_id)
        if not h:
            raise HTTPException(status_code=404, detail="Sector not found")
            
        h["sim"].trigger_fall(req.target)
        
        # Tick hospital once
        telemetry = h["sim"].tick()
        h["tracker"].process_telemetry(telemetry)
        h["memory"].log_tick(h["sim"].time, h["tracker"].occupants, h["layout"].graph)
        h["step"] += 1

        log_occupant_snapshot(db, req.hospital_id, h["sim"].time, h["tracker"].occupants)
        log_environmental_snapshot(db, req.hospital_id, h["sim"].time, h["layout"].graph.nodes(data=True))
        
        raw_alerts = h["tracker"].get_active_alerts()
        if raw_alerts:
            log_alerts(db, req.hospital_id, h["sim"].time, raw_alerts)

        state_data = build_hospital_state(req.hospital_id)
        await manager.broadcast_sector_state(req.hospital_id, jsonable_encoder(state_data))

    return state_data


@app.post("/api/trigger/fire", response_model=HospitalStateOut)
async def trigger_fire(req: TriggerRequest, db: Session = Depends(get_db)):
    async with sim_manager.lock:
        h = hospitals.get(req.hospital_id)
        if not h:
            raise HTTPException(status_code=404, detail="Sector not found")
            
        h["sim"].trigger_fire(req.target)
        
        # Tick hospital once
        telemetry = h["sim"].tick()
        h["tracker"].process_telemetry(telemetry)
        h["memory"].log_tick(h["sim"].time, h["tracker"].occupants, h["layout"].graph)
        h["step"] += 1

        log_occupant_snapshot(db, req.hospital_id, h["sim"].time, h["tracker"].occupants)
        log_environmental_snapshot(db, req.hospital_id, h["sim"].time, h["layout"].graph.nodes(data=True))
        
        raw_alerts = h["tracker"].get_active_alerts()
        if raw_alerts:
            log_alerts(db, req.hospital_id, h["sim"].time, raw_alerts)

        state_data = build_hospital_state(req.hospital_id)
        await manager.broadcast_sector_state(req.hospital_id, jsonable_encoder(state_data))

    return state_data


@app.post("/api/trigger/intruder", response_model=HospitalStateOut)
async def trigger_intruder(req: TriggerRequest, db: Session = Depends(get_db)):
    """Inject an unidentified entity into a room."""
    async with sim_manager.lock:
        h = hospitals.get(req.hospital_id)
        if not h:
            raise HTTPException(status_code=404, detail="Sector not found")
        
        h["sim"].trigger_intruder(req.target)
        
        telemetry = h["sim"].tick()
        h["tracker"].process_telemetry(telemetry)
        h["memory"].log_tick(h["sim"].time, h["tracker"].occupants, h["layout"].graph)
        h["step"] += 1

        log_occupant_snapshot(db, req.hospital_id, h["sim"].time, h["tracker"].occupants)
        log_environmental_snapshot(db, req.hospital_id, h["sim"].time, h["layout"].graph.nodes(data=True))

        state_data = build_hospital_state(req.hospital_id)
        await manager.broadcast_sector_state(req.hospital_id, jsonable_encoder(state_data))

    return state_data


@app.post("/api/trigger/sensor_fail", response_model=HospitalStateOut)
async def trigger_sensor_fail(req: TriggerRequest, db: Session = Depends(get_db)):
    """Simulate CSI sensor node failure in a room."""
    async with sim_manager.lock:
        h = hospitals.get(req.hospital_id)
        if not h:
            raise HTTPException(status_code=404, detail="Sector not found")
        
        h["sim"].trigger_sensor_fail(req.target)
        
        telemetry = h["sim"].tick()
        h["tracker"].process_telemetry(telemetry)
        h["memory"].log_tick(h["sim"].time, h["tracker"].occupants, h["layout"].graph)
        h["step"] += 1

        log_occupant_snapshot(db, req.hospital_id, h["sim"].time, h["tracker"].occupants)
        log_environmental_snapshot(db, req.hospital_id, h["sim"].time, h["layout"].graph.nodes(data=True))

        state_data = build_hospital_state(req.hospital_id)
        await manager.broadcast_sector_state(req.hospital_id, jsonable_encoder(state_data))

    return state_data


@app.post("/api/simulation/spawn")
async def spawn_occupant(req: SpawnRequest):
    async with sim_manager.lock:
        h = hospitals.get(req.hospital_id)
        if not h:
            raise HTTPException(status_code=404, detail="Sector not found")
        
        sim = h["sim"]
        tracker = h["tracker"]
        
        sim.add_entity(req.entity_id, req.role, req.room_id)
        
        if req.role in ["nurse", "patient"]:
            tag_id = f"TAG-{req.entity_id.upper()}"
            tracker.register_tag(tag_id, req.entity_id, req.role)
        
        state_data = build_hospital_state(req.hospital_id)
        await manager.broadcast_sector_state(req.hospital_id, jsonable_encoder(state_data))
        
    return {"status": f"Spawned {req.entity_id} ({req.role}) in {req.room_id}"}


@app.post("/api/simulation/override_temperature")
async def override_temperature(req: TempOverrideRequest):
    async with sim_manager.lock:
        h = hospitals.get(req.hospital_id)
        if not h:
            raise HTTPException(status_code=404, detail="Sector not found")
        
        sim = h["sim"]
        layout = h["layout"]
        
        if req.room_id not in sim.rooms:
            raise HTTPException(status_code=404, detail="Room not found")
            
        sim.temperatures[req.room_id] = req.temperature
        layout.graph.nodes[req.room_id]["temperature"] = req.temperature
        
        state_data = build_hospital_state(req.hospital_id)
        await manager.broadcast_sector_state(req.hospital_id, jsonable_encoder(state_data))
        
    return {"status": f"Overrode temperature in {req.room_id} to {req.temperature}°C"}


@app.post("/api/reset", response_model=HospitalStateOut)
async def reset_simulation(active_id: str = "metro_care", db: Session = Depends(get_db)):
    """Reset all simulation states and wipe DB history."""
    global hospitals, agent
    async with sim_manager.lock:
        clear_all_history(db)
        hospitals = bootstrap_sectors()
        agent = AETHERAgent(hospitals)
        
        # Propagate current configuration to the new simulator instances
        for hid, h in hospitals.items():
            h["sim"].configure_simulator(
                fire_spread_rate=sim_manager.fire_spread_rate,
                csi_noise_level=sim_manager.csi_noise_level,
                occupant_speed=sim_manager.occupant_speed
            )
            try:
                state_data = build_hospital_state(hid)
                await manager.broadcast_sector_state(hid, jsonable_encoder(state_data))
            except Exception as e:
                print(f"Error broadcasting state in reset: {e}")

        state_data = build_hospital_state(active_id)
    return state_data


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    """Submit conversational queries to the spatial AI reasoning agent."""
    async with sim_manager.lock:
        save_chat_message(db, req.hospital_id, "user", req.message)
        answer = agent.query(req.message, req.hospital_id)
        save_chat_message(db, req.hospital_id, "agent", answer)
        history = get_chat_history(db, req.hospital_id, limit=50)
    return ChatResponse(response=answer, history=history)


@app.get("/api/history/heatmap")
def history_heatmap(hospital_id: str, db: Session = Depends(get_db)):
    return get_occupancy_heatmap(db, hospital_id)


@app.get("/api/history/alerts")
def history_alerts(hospital_id: Optional[str] = None, db: Session = Depends(get_db)):
    return get_recent_alerts(db, hospital_id, limit=30)


@app.get("/api/history/chat")
def history_chat(hospital_id: Optional[str] = None, db: Session = Depends(get_db)):
    return get_chat_history(db, hospital_id, limit=50)


# ─── Backward Compatible State Fallback ──────────────────────────────────────
@app.get("/api/state", response_model=HospitalStateOut)
def get_default_state():
    return build_hospital_state("metro_care")

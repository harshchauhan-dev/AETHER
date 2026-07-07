import random
import math
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any
from .sensors import (
    WiFiCSITelemetry,
    mmWaveTelemetry,
    BluetoothUWBTelemetry,
    AcousticTelemetry,
    EnvironmentalTelemetry,
    PressureMatTelemetry,
    DoorContactTelemetry,
)

class SimulatedEntity:
    def __init__(self, entity_id: str, role: str, start_room: str):
        self.entity_id = entity_id
        self.role = role  # "patient", "nurse", "visitor"
        self.current_room = start_room
        self.posture = "standing"  # "standing", "sitting", "lying_down", "fallen"
        self.breathing_rate = 16.0  # normal breaths/min
        self.target_room: str = start_room
        self.path: List[str] = []
        self.ticks_in_current_state = 0
        self.immobile = False
        
        # Room-local coordinate position (x, y, z in meters)
        self.pos_x = random.uniform(1.0, 4.0)
        self.pos_y = random.uniform(1.0, 4.0)
        self.pos_z = 1.7  # Standing height
        
        # Velocity vector (for continuous Social Force Model)
        self.vx = 0.0
        self.vy = 0.0

        # Specific tags
        self.tag_id = f"TAG-{entity_id.upper()}"

    def update_posture(self):
        if self.posture == "fallen":
            self.pos_z = 0.15
            self.breathing_rate = 14.0
        elif self.posture == "sitting":
            self.pos_z = 1.0
            self.breathing_rate = 15.0
        elif self.posture == "lying_down":
            self.pos_z = 0.3
            self.breathing_rate = 12.0
        else:
            self.pos_z = 1.7
            self.breathing_rate = 16.0

ROOM_DIMENSIONS: Dict[str, Dict[str, float]] = {
    "ICU-1":         {"width_m": 4.0, "height_m": 5.0},
    "ICU-2":         {"width_m": 4.0, "height_m": 5.0},
    "Ward-3":        {"width_m": 4.0, "height_m": 5.0},
    "Ward-4":        {"width_m": 4.0, "height_m": 5.0},
    "Staff-Station": {"width_m": 6.0, "height_m": 8.0},
    "Kitchen":       {"width_m": 5.0, "height_m": 3.0},
    "Corridor":      {"width_m": 12.0, "height_m": 2.0},
    "Exit-1":        {"width_m": 2.0, "height_m": 2.0},
    "Exit-2":        {"width_m": 2.0, "height_m": 2.0},
}

def get_door_coordinates(current_room: str, next_room: str) -> Tuple[float, float]:
    layout_positions = {
        "ICU-1": (1.0, 3.0),
        "ICU-2": (1.0, 1.0),
        "Ward-3": (5.0, 3.0),
        "Ward-4": (5.0, 1.0),
        "Staff-Station": (3.0, 2.0),
        "Kitchen": (3.0, 4.0),
        "Corridor": (3.0, 0.0),
        "Exit-1": (6.0, 0.0),
        "Exit-2": (0.0, 0.0),
    }
    p1 = layout_positions.get(current_room, (3.0, 2.0))
    p2 = layout_positions.get(next_room, (3.0, 2.0))
    w1 = ROOM_DIMENSIONS.get(current_room, {}).get("width_m", 4.0)
    h1 = ROOM_DIMENSIONS.get(current_room, {}).get("height_m", 4.0)
    cx, cy = w1 / 2.0, h1 / 2.0
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    if abs(dx) >= abs(dy):
        return (w1 - 0.3, cy) if dx > 0 else (0.3, cy)
    else:
        return (cx, h1 - 0.3) if dy > 0 else (cx, 0.3)

def get_entrance_coordinates(current_room: str, prev_room: str) -> Tuple[float, float]:
    w = ROOM_DIMENSIONS.get(current_room, {}).get("width_m", 4.0)
    h = ROOM_DIMENSIONS.get(current_room, {}).get("height_m", 4.0)
    cx, cy = w / 2.0, h / 2.0
    layout_positions = {
        "ICU-1": (1.0, 3.0),
        "ICU-2": (1.0, 1.0),
        "Ward-3": (5.0, 3.0),
        "Ward-4": (5.0, 1.0),
        "Staff-Station": (3.0, 2.0),
        "Kitchen": (3.0, 4.0),
        "Corridor": (3.0, 0.0),
        "Exit-1": (6.0, 0.0),
        "Exit-2": (0.0, 0.0),
    }
    p_curr = layout_positions.get(current_room, (3.0, 2.0))
    p_prev = layout_positions.get(prev_room, (3.0, 2.0))
    dx = p_curr[0] - p_prev[0]
    dy = p_curr[1] - p_prev[1]
    if abs(dx) >= abs(dy):
        return (0.4, cy) if dx > 0 else (w - 0.4, cy)
    else:
        return (cx, 0.4) if dy > 0 else (cx, h - 0.4)

class BuildingSimulator:
    def __init__(self, rooms: List[str], connections: List[Tuple[str, str]]):
        self.rooms = rooms
        self.connections = connections
        
        # Spatial graph representation
        self.adj: Dict[str, List[str]] = {r: [] for r in rooms}
        for u, v in connections:
            self.adj[u].append(v)
            self.adj[v].append(u)
            
        # Physical variables per room
        self.temperatures: Dict[str, float] = {r: 21.5 for r in rooms}
        self.smoke_ppm: Dict[str, float] = {r: 0.0 for r in rooms}
        self.fire_source: str = ""
        self.blocked_doors: Dict[str, bool] = {}
        self.failed_sensors: Dict[str, bool] = {}  # rooms with degraded CSI
        
        # Track entities
        self.entities: Dict[str, SimulatedEntity] = {}
        self.time = datetime.now()
        
        # Active telemetry cache
        self.telemetry_history: List[Dict[str, Any]] = []
        
        # Configuration variables
        self.fire_spread_rate = 8.5
        self.csi_noise_level = "moderate"
        self.occupant_speed = "normal"
        self.convection_rate = 0.15
        self.social_force_weight = 1.5
        self.desired_velocity = 1.2
        
    def add_entity(self, entity_id: str, role: str, start_room: str):
        entity = SimulatedEntity(entity_id, role, start_room)
        self.entities[entity_id] = entity

    def configure_simulator(self, fire_spread_rate: float = 8.5, csi_noise_level: str = "moderate", occupant_speed: str = "normal", convection_rate: float = 0.15, social_force_weight: float = 1.5, desired_velocity: float = 1.2):
        self.fire_spread_rate = fire_spread_rate
        self.csi_noise_level = csi_noise_level
        self.occupant_speed = occupant_speed
        self.convection_rate = convection_rate
        self.social_force_weight = social_force_weight
        self.desired_velocity = desired_velocity
        
    def get_path(self, start: str, end: str) -> List[str]:
        # A* Dynamic Pathfinding with Hazard Weighting
        if start == end:
            return []
            
        import heapq
        
        # Priority queue stores (cost, current_node, path)
        queue = [(0.0, start, [start])]
        
        # Cost to reach a node from start
        g_costs = {start: 0.0}
        
        while queue:
            current_cost, node, path = heapq.heappop(queue)
            
            if node == end:
                return path[1:]
                
            for neighbor in self.adj.get(node, []):
                # Base step cost
                step_cost = 1.0
                
                # Dynamic hazard weighting (avoid fire and smoke)
                temp = self.temperatures.get(neighbor, 21.5)
                smoke = self.smoke_ppm.get(neighbor, 0.0)
                
                if temp > 40.0:
                    step_cost += (temp - 40.0) * 0.5  # High penalty for heat
                if smoke > 50.0:
                    step_cost += (smoke - 50.0) * 0.1 # Penalty for smoke
                    
                new_g = g_costs[node] + step_cost
                
                if neighbor not in g_costs or new_g < g_costs[neighbor]:
                    g_costs[neighbor] = new_g
                    
                    # Heuristic (simple uniform assumption)
                    h_cost = 1.0 if neighbor != end else 0.0
                    f_cost = new_g + h_cost
                    
                    heapq.heappush(queue, (f_cost, neighbor, path + [neighbor]))
                    
        return []

    def trigger_fall(self, patient_id: str) -> str:
        if patient_id in self.entities:
            entity = self.entities[patient_id]
            entity.posture = "fallen"
            entity.immobile = True
            entity.update_posture()
            # Sudden height drop coordinate jump
            entity.pos_x += random.uniform(-0.5, 0.5)
            entity.pos_y += random.uniform(-0.5, 0.5)
            return f"Fall triggered for {patient_id} in {entity.current_room}"
        return "Patient not found"
        
    def trigger_fire(self, room_id: str):
        if room_id in self.rooms:
            self.fire_source = room_id
            return f"Fire started in {room_id}"
        return "Room not found"

    def trigger_intruder(self, room_id: str) -> str:
        """Inject an unidentified entity into the specified room."""
        intruder_id = f"unknown_{len([e for e in self.entities if e.startswith('unknown_')]) + 1}"
        entity = SimulatedEntity(intruder_id, "unknown", room_id)
        entity.posture = "standing"
        entity.pos_x = random.uniform(0.5, 3.5)
        entity.pos_y = random.uniform(0.5, 3.5)
        self.entities[intruder_id] = entity
        return f"Unidentified entity {intruder_id} injected into {room_id}"

    def trigger_sensor_fail(self, room_id: str) -> str:
        """Simulate a CSI sensor node failure in the specified room."""
        if room_id in self.rooms:
            self.failed_sensors[room_id] = True
            return f"Sensor node failure triggered in {room_id}"
        return "Room not found"

    def reset_simulation(self):
        self.fire_source = ""
        self.blocked_doors.clear()
        self.failed_sensors.clear()
        for r in self.rooms:
            self.temperatures[r] = 21.5
            self.smoke_ppm[r] = 0.0
        # Remove any injected intruders
        self.entities = {eid: e for eid, e in self.entities.items() if not eid.startswith("unknown_")}
        for entity in self.entities.values():
            entity.posture = "standing"
            entity.immobile = False
            entity.path = []
            entity.target_room = entity.current_room
            entity.update_posture()




    def tick(self) -> List[Any]:
        self.time += timedelta(seconds=1)
        telemetry_batch: List[Any] = []
        
        # 1. Update Environment (Cellular Automata heat and smoke propagation)
        convection = getattr(self, "convection_rate", 0.15)
        temp_deltas = {r: 0.0 for r in self.rooms}
        smoke_deltas = {r: 0.0 for r in self.rooms}
        
        if self.fire_source:
            spread = getattr(self, "fire_spread_rate", 8.5)
            self.temperatures[self.fire_source] = min(350.0, self.temperatures[self.fire_source] + spread)
            self.smoke_ppm[self.fire_source] = min(800.0, self.smoke_ppm[self.fire_source] + spread * 4.0)
            
        for r in self.rooms:
            t_curr = self.temperatures[r]
            s_curr = self.smoke_ppm[r]
            
            # Convective transfer from neighbors
            for adj_room in self.adj[r]:
                door_key = f"Door-{r}-{adj_room}"
                is_blocked = self.blocked_doors.get(door_key, False)
                if not is_blocked:
                    t_neighbor = self.temperatures[adj_room]
                    s_neighbor = self.smoke_ppm[adj_room]
                    temp_deltas[r] += convection * (t_neighbor - t_curr)
                    smoke_deltas[r] += convection * (s_neighbor - s_curr) * 1.5
                    
            # Natural dissipation / cooling back to baseline
            temp_deltas[r] -= 0.04 * (t_curr - 21.5)
            smoke_deltas[r] -= 0.08 * s_curr
            
        for r in self.rooms:
            if r == self.fire_source:
                continue
            self.temperatures[r] = max(21.5, min(350.0, self.temperatures[r] + temp_deltas[r]))
            self.smoke_ppm[r] = max(0.0, min(800.0, self.smoke_ppm[r] + smoke_deltas[r]))
            
            # Block doors dynamically if temperature exceeds threshold
            if self.temperatures[r] > 60.0:
                for adj_room in self.adj[r]:
                    door_key = f"Door-{r}-{adj_room}"
                    reverse_key = f"Door-{adj_room}-{r}"
                    self.blocked_doors[door_key] = True
                    self.blocked_doors[reverse_key] = True
        
        # 2. Update Entities (Social Force Model Pedestrian Dynamics)
        for entity in self.entities.values():
            entity.ticks_in_current_state += 1
            
            if entity.immobile:
                entity.update_posture()
                continue

            w_room = ROOM_DIMENSIONS.get(entity.current_room, {}).get("width_m", 5.0)
            h_room = ROOM_DIMENSIONS.get(entity.current_room, {}).get("height_m", 5.0)

            # Routine decision making (selecting paths)
            if not entity.path:
                speed_config = getattr(self, "occupant_speed", "normal")
                ticks_threshold = random.randint(3, 10) if speed_config == "fast" else (random.randint(30, 90) if speed_config == "slow" else random.randint(10, 40))

                if entity.ticks_in_current_state > ticks_threshold:
                    entity.ticks_in_current_state = 0
                    if entity.role == "nurse":
                        dest = "Staff-Station" if random.random() < 0.4 else random.choice(self.rooms)
                        entity.path = self.get_path(entity.current_room, dest)
                        entity.target_room = dest
                        entity.posture = "standing"
                    elif entity.role == "patient":
                        if random.random() < 0.15:
                            dest = "Kitchen" if random.random() < 0.5 else "Corridor"
                            entity.path = self.get_path(entity.current_room, dest)
                            entity.target_room = dest
                            entity.posture = "standing"
                        else:
                            entity.posture = random.choice(["sitting", "lying_down"])
                    elif entity.role == "visitor":
                        if random.random() < 0.2:
                            dest = random.choice([r for r in self.rooms if "ICU" in r or "Ward" in r or r == "Corridor"])
                            entity.path = self.get_path(entity.current_room, dest)
                            entity.target_room = dest
                            entity.posture = "standing"

            # Compute forces
            target_x, target_y = w_room / 2.0, h_room / 2.0
            
            if entity.path:
                next_room = entity.path[0]
                target_x, target_y = get_door_coordinates(entity.current_room, next_room)
                
                # Check door crossing distance threshold
                dist_to_door = math.sqrt((entity.pos_x - target_x)**2 + (entity.pos_y - target_y)**2)
                if dist_to_door < 0.55:
                    door_key = f"Door-{entity.current_room}-{next_room}"
                    if not self.blocked_doors.get(door_key, False):
                        prev_room = entity.current_room
                        entity.current_room = next_room
                        entity.path.pop(0)
                        entity.pos_x, entity.pos_y = get_entrance_coordinates(next_room, prev_room)
                        entity.posture = "standing"
                        entity.vx, entity.vy = 0.0, 0.0  # reset velocity vector on transition
                        
                        w_room = ROOM_DIMENSIONS.get(entity.current_room, {}).get("width_m", 5.0)
                        h_room = ROOM_DIMENSIONS.get(entity.current_room, {}).get("height_m", 5.0)
                        if entity.path:
                            target_x, target_y = get_door_coordinates(entity.current_room, entity.path[0])
                        else:
                            target_x, target_y = w_room / 2.0, h_room / 2.0
                    else:
                        entity.path = []
                        entity.target_room = entity.current_room
            else:
                if entity.posture == "standing":
                    if not hasattr(entity, 'drift_target') or random.random() < 0.06:
                        entity.drift_target = (random.uniform(1.0, w_room - 1.0), random.uniform(1.0, h_room - 1.0))
                    target_x, target_y = entity.drift_target
                else:
                    target_x, target_y = w_room / 2.0, h_room / 2.0

            # 1. Target Attraction Force (Kinematic Relaxation)
            dx = target_x - entity.pos_x
            dy = target_y - entity.pos_y
            dist_to_target = math.sqrt(dx**2 + dy**2)
            
            speed_config = getattr(self, "occupant_speed", "normal")
            v_desired_speed = 2.0 if speed_config == "fast" else (0.6 if speed_config == "slow" else 1.2)
            if entity.posture in ["sitting", "lying_down"]:
                v_desired_speed = 0.0
                
            desired_vx = (dx / dist_to_target) * v_desired_speed if dist_to_target > 0.1 else 0.0
            desired_vy = (dy / dist_to_target) * v_desired_speed if dist_to_target > 0.1 else 0.0
            
            tau = 0.4
            f_desired_x = (desired_vx - entity.vx) / tau
            f_desired_y = (desired_vy - entity.vy) / tau

            # 2. Hazard Repulsion Force
            f_hazard_x, f_hazard_y = 0.0, 0.0
            sf_weight = getattr(self, "social_force_weight", 1.5)
            temp = self.temperatures.get(entity.current_room, 21.5)
            if temp > 40.0:
                rx = entity.pos_x - (w_room / 2.0)
                ry = entity.pos_y - (h_room / 2.0)
                rdist = math.sqrt(rx**2 + ry**2) or 0.1
                f_hazard_x += (rx / rdist) * sf_weight * (temp - 40.0) * 0.15
                f_hazard_y += (ry / rdist) * sf_weight * (temp - 40.0) * 0.15

            # 3. Collision Repulsion Force (Same-Room Occupants)
            f_social_x, f_social_y = 0.0, 0.0
            for other_id, other in self.entities.items():
                if other_id != entity.entity_id and other.current_room == entity.current_room:
                    ox = entity.pos_x - other.pos_x
                    oy = entity.pos_y - other.pos_y
                    odist = math.sqrt(ox**2 + oy**2)
                    if 0 < odist < 2.0:
                        mag = 0.8 * sf_weight * math.exp(-odist)
                        f_social_social_x = (ox / odist) * mag
                        f_social_social_y = (oy / odist) * mag
                        f_social_x += f_social_social_x
                        f_social_y += f_social_social_y

            # Update velocity and position
            entity.vx += (f_desired_x + f_hazard_x + f_social_x) * 1.0
            entity.vy += (f_desired_y + f_hazard_y + f_social_y) * 1.0
            
            speed = math.sqrt(entity.vx**2 + entity.vy**2)
            max_speed = v_desired_speed * 1.5
            if speed > max_speed and speed > 0:
                entity.vx = (entity.vx / speed) * max_speed
                entity.vy = (entity.vy / speed) * max_speed
                
            entity.pos_x += entity.vx * 1.0
            entity.pos_y += entity.vy * 1.0
            
            # Bound within room walls
            entity.pos_x = max(0.2, min(w_room - 0.2, entity.pos_x))
            entity.pos_y = max(0.2, min(h_room - 0.2, entity.pos_y))
            entity.update_posture()

        # 3. Generate Telemetry Records
        # CSI
        for r in self.rooms:
            # Count moving occupants in room
            room_occupants = [e for e in self.entities.values() if e.current_room == r]
            moving_count = sum(1 for e in room_occupants if e.posture == "standing" and e.path)
            resting_count = sum(1 for e in room_occupants if e.posture in ["sitting", "lying_down"])
            
            # CSI variance based on movement
            noise = getattr(self, "csi_noise_level", "moderate")
            noise_mult = 1.0
            if noise == "clean":
                noise_mult = 0.4
            elif noise == "noisy":
                noise_mult = 2.2

            if self.failed_sensors.get(r, False):
                # Sensor failure: near-zero noisy readings
                amp_var = random.uniform(0.001, 0.005)
                phase_var = random.uniform(0.001, 0.008)
            else:
                amp_var = (0.01 + (moving_count * 1.5) + (resting_count * 0.05) + random.uniform(0.005, 0.03)) * noise_mult
                phase_var = (0.02 + (moving_count * 2.1) + (resting_count * 0.08) + random.uniform(0.01, 0.05)) * noise_mult
            
            # Estimate breathing rate from resters
            b_rate = None
            if resting_count > 0 and moving_count == 0:
                b_rate = sum(e.breathing_rate for e in room_occupants if e.posture in ["sitting", "lying_down"]) / resting_count
                b_rate += random.uniform(-0.2, 0.2)
                
            telemetry_batch.append(WiFiCSITelemetry(
                room_id=r,
                amplitude_variance=amp_var,
                phase_variance=phase_var,
                breathing_rate=b_rate,
                timestamp=self.time
            ))

        # mmWave
        for r in self.rooms:
            room_occupants = [e for e in self.entities.values() if e.current_room == r]
            positions = [(e.pos_x, e.pos_y, e.pos_z) for e in room_occupants]
            # Simple velocities
            velocities = []
            for e in room_occupants:
                if e.path:
                    velocities.append((random.uniform(0.5, 1.2), random.uniform(0.5, 1.2), 0.0))
                else:
                    velocities.append((0.0, 0.0, 0.0))
            
            has_sudden_drop = any(e.posture == "fallen" for e in room_occupants)
            
            telemetry_batch.append(mmWaveTelemetry(
                room_id=r,
                target_count=len(room_occupants),
                positions=positions,
                velocities=velocities,
                has_sudden_drop=has_sudden_drop,
                timestamp=self.time
            ))

        # Bluetooth/UWB
        for entity_id, entity in self.entities.items():
            if entity.role in ["nurse", "patient"]:  # Carry tags
                # Simulate rssi/distance based on position
                dist = random.uniform(0.2, 2.5) if entity.posture in ["sitting", "lying_down"] else random.uniform(1.0, 5.0)
                rssi = -50 - (dist * 6) + random.uniform(-3, 3)
                
                telemetry_batch.append(BluetoothUWBTelemetry(
                    tag_id=entity.tag_id,
                    room_id=entity.current_room,
                    rssi=rssi,
                    distance=dist,
                    timestamp=self.time
                ))

        # Acoustic
        for r in self.rooms:
            room_occupants = [e for e in self.entities.values() if e.current_room == r]
            sound_type = "normal"
            decibel = 35.0 + random.uniform(1.0, 5.0) # normal quiet background
            
            # Check for fallen or screams
            if any(e.posture == "fallen" for e in room_occupants):
                # Fall sound peak
                decibel = 82.0 + random.uniform(1.0, 5.0)
                sound_type = "crash"
            elif any(e.breathing_rate > 22.0 for e in room_occupants):
                decibel = 65.0
                sound_type = "cry_for_help"
            elif len(room_occupants) > 2:
                decibel = 52.0 + random.uniform(1.0, 4.0) # chatter
                
            telemetry_batch.append(AcousticTelemetry(
                room_id=r,
                decibels=decibel,
                sound_type=sound_type,
                timestamp=self.time
            ))

        # Environmental
        for r in self.rooms:
            telemetry_batch.append(EnvironmentalTelemetry(
                room_id=r,
                temperature=self.temperatures[r],
                smoke_ppm=self.smoke_ppm[r],
                timestamp=self.time
            ))

        # Pressure Mats
        # Simulate Pressure Mats under Patient beds (ICU-1, ICU-2, Ward-3, Ward-4)
        for r in ["ICU-1", "ICU-2", "Ward-3", "Ward-4"]:
            room_occupants = [e for e in self.entities.values() if e.current_room == r and e.role == "patient"]
            mat_id = f"MAT-{r}"
            weight = 0.0
            is_occupied = False
            
            if room_occupants:
                patient = room_occupants[0]
                if patient.posture == "lying_down":
                    weight = random.uniform(65.0, 85.0)
                    is_occupied = True
                elif patient.posture == "sitting" and random.random() < 0.6:
                    # Sitting in bed/chair pressure mat
                    weight = random.uniform(60.0, 80.0)
                    is_occupied = True
                    
            telemetry_batch.append(PressureMatTelemetry(
                room_id=r,
                mat_id=mat_id,
                weight_kg=weight,
                is_occupied=is_occupied,
                timestamp=self.time
            ))

        # Door contacts
        # Connections are rooms with doors
        for u, v in self.connections:
            door_id = f"Door-{u}-{v}"
            # A door is open if an occupant recently moved between them, or default to random
            # If fire, doors can be obstructed or closed
            is_obstructed = self.blocked_doors.get(door_id, False)
            is_open = not is_obstructed and (random.random() < 0.3)
            
            telemetry_batch.append(DoorContactTelemetry(
                door_id=door_id,
                from_room=u,
                to_room=v,
                is_open=is_open,
                is_obstructed=is_obstructed,
                timestamp=self.time
            ))

        return telemetry_batch

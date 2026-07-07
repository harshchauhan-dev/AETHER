import pytest
from datetime import datetime
from aether.perception.simulator import BuildingSimulator
from aether.understanding.spatial_model import SpatialLayout
from aether.understanding.tracker import StateTracker
from aether.prediction.forecaster import Forecaster
from aether.decision.decision_engine import DecisionEngine
from aether.learning.memory import EnvironmentalMemory
from aether.interface.agent import AETHERAgent

def test_spatial_layout():
    layout = SpatialLayout()
    assert "ICU-1" in layout.graph.nodes
    assert "Staff-Station" in layout.graph.nodes
    assert layout.graph.has_edge("ICU-1", "Staff-Station")
    assert layout.get_room_type("ICU-1") == "patient_room"
    assert layout.get_room_type("Corridor") == "corridor"

def test_simulator_and_tracker():
    layout = SpatialLayout()
    sim = BuildingSimulator(rooms=list(layout.rooms.keys()), connections=layout.connections)
    
    # Add nurse and patient
    sim.add_entity("nurse_bob", "nurse", "Staff-Station")
    sim.add_entity("patient_alice", "patient", "ICU-1")
    
    tracker = StateTracker(layout)
    tracker.register_tag("TAG-NURSE_BOB", "nurse_bob", "nurse")
    tracker.register_tag("TAG-PATIENT_ALICE", "patient_alice", "patient")
    
    # Tick simulation
    telemetry = sim.tick()
    assert len(telemetry) > 0
    
    # Process in tracker
    tracker.process_telemetry(telemetry)
    
    # Check states
    assert "nurse_bob" in tracker.occupants
    assert "patient_alice" in tracker.occupants
    assert tracker.occupants["patient_alice"].current_room == "ICU-1"
    assert tracker.occupants["nurse_bob"].current_room == "Staff-Station"

def test_forecaster_and_decision():
    layout = SpatialLayout()
    sim = BuildingSimulator(rooms=list(layout.rooms.keys()), connections=layout.connections)
    sim.add_entity("nurse_bob", "nurse", "Staff-Station")
    sim.add_entity("patient_alice", "patient", "ICU-1")
    
    tracker = StateTracker(layout)
    tracker.register_tag("TAG-NURSE_BOB", "nurse_bob", "nurse")
    tracker.register_tag("TAG-PATIENT_ALICE", "patient_alice", "patient")
    
    forecaster = Forecaster(tracker, layout)
    engine = DecisionEngine(tracker, layout)
    
    # 1. Normal state
    telemetry = sim.tick()
    tracker.process_telemetry(telemetry)
    alerts = tracker.get_active_alerts()
    predictions = forecaster.predict()
    decisions = engine.get_recommendations()
    
    # No falls or fires yet
    assert len(alerts) == 0
    
    # 2. Trigger Fall
    sim.trigger_fall("patient_alice")
    telemetry = sim.tick()
    tracker.process_telemetry(telemetry)
    
    alerts = tracker.get_active_alerts()
    assert len(alerts) == 1
    assert alerts[0]["type"] == "fall_detected"
    
    # Check Decision - dispatch nurse_bob to ICU-1
    decisions = engine.get_recommendations()
    assert len(decisions) == 1
    assert decisions[0].action_type == "dispatch_responder"
    assert decisions[0].assigned_responder_id == "nurse_bob"
    assert decisions[0].target_room == "ICU-1"

def test_evacuation_routing_with_blocked_node():
    layout = SpatialLayout()
    sim = BuildingSimulator(rooms=list(layout.rooms.keys()), connections=layout.connections)
    sim.add_entity("patient_alice", "patient", "ICU-1") # Connects to Staff-Station
    
    tracker = StateTracker(layout)
    tracker.register_tag("TAG-PATIENT_ALICE", "patient_alice", "patient")
    
    forecaster = Forecaster(tracker, layout)
    engine = DecisionEngine(tracker, layout)
    
    # Trigger Fire in Staff-Station (which blocks ICU-1 -> Staff-Station transition)
    sim.trigger_fire("Staff-Station")
    # Mark it as hazard in layout by ticking multiple times to let temp rise
    for _ in range(4):
        telemetry = sim.tick()
        tracker.process_telemetry(telemetry)
    
    # Staff-Station is hazard, path from ICU-1 to exits should avoid Staff-Station
    # Since layout only connects ICU-1 to Staff-Station, ICU-1 has no other connections.
    # Let's check if trapped is recommended
    decisions = engine.get_recommendations()
    evacuation_recs = [d for d in decisions if d.action_type == "evacuate_occupants"]
    
    # Since Staff-Station is blocked, ICU-1 patient is trapped (no other way out)
    assert len(evacuation_recs) == 1
    assert "TRAPPED" in evacuation_recs[0].description

def test_memory_and_agent():
    layout = SpatialLayout()
    sim = BuildingSimulator(rooms=list(layout.rooms.keys()), connections=layout.connections)
    sim.add_entity("patient_alice", "patient", "ICU-1")
    
    tracker = StateTracker(layout)
    tracker.register_tag("TAG-PATIENT_ALICE", "patient_alice", "patient")
    
    forecaster = Forecaster(tracker, layout)
    engine = DecisionEngine(tracker, layout)
    memory = EnvironmentalMemory()
    
    # Record a tick
    telemetry = sim.tick()
    tracker.process_telemetry(telemetry)
    memory.log_tick(sim.time, tracker.occupants, layout.graph)
    
    heatmap = memory.get_room_occupancy_heatmap()
    assert "ICU-1" in heatmap
    assert heatmap["ICU-1"] == 1.0
    
    # Test agent
    hospital_states = {
        "metro_care": {
            "name": "Metro Care Center",
            "layout": layout,
            "tracker": tracker,
            "forecaster": forecaster,
            "engine": engine,
            "memory": memory,
            "ping": 10,
            "csi_quality": 0.98,
            "csi_packets": 500
        }
    }
    agent = AETHERAgent(hospital_states)
    res_help = agent.query("Show me where help is needed", "metro_care")
    assert "AETHER Tactical Fallback Mode" in res_help
    assert "Tactical GIS Mesh Emergency Overview" in res_help
    
    res_why = agent.query("Why did you raise this alert?", "metro_care")
    assert "AETHER AI Space Decision Support" in res_why

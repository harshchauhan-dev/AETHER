from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from ..understanding.tracker import StateTracker, OccupantState
from ..understanding.spatial_model import SpatialLayout

class PredictionAlert(BaseModel):
    alert_type: str  # fall_risk, inactivity_risk, evacuation_bottleneck, fire_propagation
    room_id: str
    entity_id: Optional[str] = None
    probability: float = Field(..., ge=0.0, le=1.0)
    description: str
    timestamp: datetime = Field(default_factory=datetime.now)

class Forecaster:
    def __init__(self, tracker: StateTracker, spatial_layout: SpatialLayout):
        self.tracker = tracker
        self.spatial_layout = spatial_layout

    def predict(self) -> List[PredictionAlert]:
        alerts: List[PredictionAlert] = []
        current_time = datetime.now()
        
        # 1. Fall Risk Forecast
        # Analyze patients who are standing or sitting but might be unstable
        for entity_id, occ in self.tracker.occupants.items():
            if occ.role == "patient" and occ.posture in ["standing", "sitting"]:
                # If they are out of bed (pressure mat not occupied) and moving slowly in a patient room
                # We can predict a moderate fall risk if they stay out of bed long
                if occ.current_room in ["ICU-1", "ICU-2", "Ward-3", "Ward-4"]:
                    # Check if pressure mat in this room is unoccupied (patient is out of bed)
                    # Let's say if they are out of bed for > 15s, fall risk goes up
                    if occ.posture == "standing":
                        alerts.append(PredictionAlert(
                            alert_type="fall_risk",
                            room_id=occ.current_room,
                            entity_id=entity_id,
                            probability=0.65,
                            description=f"Patient {entity_id} is out of bed and standing in {occ.current_room}. Potential fall risk.",
                            timestamp=current_time
                        ))

        # 2. Inactivity/Immobility Risk (Pre-alert before critical immobility)
        for entity_id, occ in self.tracker.occupants.items():
            if occ.role == "patient" and occ.posture in ["sitting", "lying_down"]:
                # If inactivity duration is getting close to the limit (e.g., > 30s)
                if 20.0 <= occ.inactivity_duration < 60.0:
                    alerts.append(PredictionAlert(
                        alert_type="inactivity_risk",
                        room_id=occ.current_room,
                        entity_id=entity_id,
                        probability=0.75,
                        description=f"Patient {entity_id} has been completely stationary for {int(occ.inactivity_duration)}s in {occ.current_room}.",
                        timestamp=current_time
                    ))

        # 3. Fire Propagation Risk
        hazards = self.spatial_layout.get_active_hazards()
        for hazard_room in hazards:
            # Check adjacent rooms in the NetworkX graph
            temp = self.spatial_layout.graph.nodes[hazard_room].get("temperature", 21.5)
            smoke = self.spatial_layout.graph.nodes[hazard_room].get("smoke_ppm", 0.0)
            
            # Risk level based on hazard severity
            prob = min(0.95, (temp - 21.5) / 100.0)
            if prob > 0.1:
                for neighbor in self.spatial_layout.graph.neighbors(hazard_room):
                    # If neighbor is not already a hazard, predict propagation
                    if not self.spatial_layout.graph.nodes[neighbor].get("hazard", False):
                        alerts.append(PredictionAlert(
                            alert_type="fire_propagation",
                            room_id=neighbor,
                            probability=prob,
                            description=f"High risk of hazard spreading from {hazard_room} to adjacent {neighbor} (Source Temp: {temp:.1f}°C).",
                            timestamp=current_time
                        ))

        # 4. Evacuation Bottleneck Risk
        if hazards:
            # If there's an active fire, people will move towards exits
            # Exit routes typically converge on the Corridor node
            # Count the number of occupants who are NOT in an exit or corridor yet but will route through it
            potential_evacuees = [occ for occ in self.tracker.occupants.values() 
                                  if occ.current_room not in ["Exit-1", "Exit-2"] and occ.posture != "fallen"]
            
            # Simple congestion forecast: if > 3 people need to pass through Corridor
            if len(potential_evacuees) >= 3:
                # Find if Corridor is heavily traversed
                alerts.append(PredictionAlert(
                    alert_type="evacuation_bottleneck",
                    room_id="Corridor",
                    probability=0.80,
                    description=f"Evacuation bottleneck risk in Corridor. {len(potential_evacuees)} people evacuating to Exit doors.",
                    timestamp=current_time
                ))
                
            # Check if exit doors are obstructed
            for node in ["Exit-1", "Exit-2"]:
                for neighbor in self.spatial_layout.graph.neighbors(node):
                    if self.spatial_layout.graph.has_edge(neighbor, node):
                        edge_data = self.spatial_layout.graph[neighbor][node]
                        if edge_data.get("obstructed", False):
                            alerts.append(PredictionAlert(
                                alert_type="evacuation_bottleneck",
                                room_id=node,
                                probability=0.99,
                                description=f"CRITICAL: Evacuation path to {node} is blocked by door obstruction!",
                                timestamp=current_time
                            ))

        return alerts

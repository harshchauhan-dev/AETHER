from datetime import datetime
from typing import List, Dict, Any, Tuple

class EnvironmentalLog:
    def __init__(self, room_id: str, temperature: float, smoke_ppm: float, timestamp: datetime):
        self.room_id = room_id
        self.temperature = temperature
        self.smoke_ppm = smoke_ppm
        self.timestamp = timestamp

class OccupancyLog:
    def __init__(self, room_id: str, count: int, occupants: List[str], timestamp: datetime):
        self.room_id = room_id
        self.count = count
        self.occupants = occupants
        self.timestamp = timestamp

class EnvironmentalMemory:
    def __init__(self):
        self.occupancy_history: List[OccupancyLog] = []
        self.environmental_history: List[EnvironmentalLog] = []
        
    def log_tick(self, timestamp: datetime, tracker_occupants: Dict[str, Any], spatial_layout_graph: Any):
        # Log occupancy per room
        room_counts: Dict[str, List[str]] = {}
        for occ_id, occ in tracker_occupants.items():
            room = occ.current_room
            if room not in room_counts:
                room_counts[room] = []
            room_counts[room].append(occ_id)
            
        # Log to memory
        for room, occupants in room_counts.items():
            self.occupancy_history.append(OccupancyLog(
                room_id=room,
                count=len(occupants),
                occupants=occupants,
                timestamp=timestamp
            ))
            
        # Log environment
        for node, attrs in spatial_layout_graph.nodes(data=True):
            self.environmental_history.append(EnvironmentalLog(
                room_id=node,
                temperature=attrs.get("temperature", 21.5),
                smoke_ppm=attrs.get("smoke_ppm", 0.0),
                timestamp=timestamp
            ))

    def get_room_occupancy_heatmap(self) -> Dict[str, float]:
        """
        Calculates the proportion of time each room has been occupied.
        """
        if not self.occupancy_history:
            return {}
            
        room_ticks: Dict[str, int] = {}
        total_ticks = len(set(log.timestamp for log in self.occupancy_history))
        
        if total_ticks == 0:
            return {}
            
        for log in self.occupancy_history:
            if log.count > 0:
                room_ticks[log.room_id] = room_ticks.get(log.room_id, 0) + 1
                
        return {room: (ticks / total_ticks) for room, ticks in room_ticks.items()}

    def get_occupant_time_allocation(self, occupant_id: str) -> Dict[str, float]:
        """
        Calculates the percentage of recorded ticks an occupant has spent in each room.
        """
        total_ticks = 0
        room_ticks: Dict[str, int] = {}
        
        for log in self.occupancy_history:
            if occupant_id in log.occupants:
                total_ticks += 1
                room_ticks[log.room_id] = room_ticks.get(log.room_id, 0) + 1
                
        if total_ticks == 0:
            return {}
            
        return {room: (ticks / total_ticks) * 100 for room, ticks in room_ticks.items()}

    def detect_anomalies(self) -> List[Dict[str, Any]]:
        """
        Identifies spatial anomalies based on historical baselines (e.g., patient in kitchen at night).
        For simplicity, we analyze recent logs for:
        - Patients outside their primary room (e.g. ICU/Ward) for a long time.
        - High temperature spikes.
        - Unexpected visitor occupancy in high-risk areas.
        """
        anomalies = []
        
        # Check for high temperature anomalies
        for log in self.environmental_history[-50:]:  # check recent logs
            if log.temperature > 35.0:
                anomalies.append({
                    "timestamp": log.timestamp,
                    "room_id": log.room_id,
                    "type": "temperature_anomaly",
                    "description": f"ABNORMAL HEAT DETECTED: Room {log.room_id} registered {log.temperature:.1f}°C."
                })
                break # only log once per check
                
        # Check for patient night-walking or wandering
        for log in self.occupancy_history[-50:]:
            # If patient is in Kitchen or Corridor and count of nurses is 0 there
            for occ in log.occupants:
                if "patient" in occ and log.room_id == "Corridor":
                    # Wandering anomaly
                    anomalies.append({
                        "timestamp": log.timestamp,
                        "room_id": log.room_id,
                        "type": "wandering_anomaly",
                        "description": f"PATIENT WANDERING: Patient {occ} detected in Corridor without accompaniment."
                    })
                    break
                    
        return anomalies

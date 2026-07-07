import networkx as nx
from typing import Dict, List, Tuple, Optional

class SpatialLayout:
    def __init__(self):
        self.graph = nx.Graph()
        
        # Room definitions and their 2D grid centroids (for layout visualization)
        self.rooms = {
            "ICU-1": {"type": "patient_room", "pos": (1.0, 3.0)},
            "ICU-2": {"type": "patient_room", "pos": (1.0, 1.0)},
            "Ward-3": {"type": "patient_room", "pos": (5.0, 3.0)},
            "Ward-4": {"type": "patient_room", "pos": (5.0, 1.0)},
            "Staff-Station": {"type": "staff", "pos": (3.0, 2.0)},
            "Kitchen": {"type": "kitchen", "pos": (3.0, 4.0)},
            "Corridor": {"type": "corridor", "pos": (3.0, 0.0)},
            "Exit-1": {"type": "exit", "pos": (6.0, 0.0)},
            "Exit-2": {"type": "exit", "pos": (0.0, 0.0)},
        }
        
        # Add nodes with attributes
        for room_id, info in self.rooms.items():
            self.graph.add_node(room_id, type=info["type"], pos=info["pos"], hazard=False, temperature=21.5, smoke_ppm=0.0)
            
        # Define door connections
        self.connections = [
            ("ICU-1", "Staff-Station"),
            ("ICU-2", "Staff-Station"),
            ("Ward-3", "Staff-Station"),
            ("Ward-4", "Staff-Station"),
            ("Kitchen", "Staff-Station"),
            ("Corridor", "Staff-Station"),
            ("Corridor", "Exit-1"),
            ("Corridor", "Exit-2"),
            ("ICU-2", "Corridor"),
            ("Ward-4", "Corridor"),
        ]
        
        for u, v in self.connections:
            # Default weight = 1.0 (representing ease of traversal)
            self.graph.add_edge(u, v, weight=1.0, obstructed=False)
            
    def get_room_type(self, room_id: str) -> str:
        return self.rooms.get(room_id, {}).get("type", "unknown")
        
    def get_coordinates(self, room_id: str) -> Tuple[float, float]:
        return self.rooms.get(room_id, {}).get("pos", (0.0, 0.0))

    def update_environmental_state(self, room_id: str, temp: float, smoke: float):
        if room_id in self.graph:
            self.graph.nodes[room_id]["temperature"] = temp
            self.graph.nodes[room_id]["smoke_ppm"] = smoke
            # If temp > 45C or smoke > 100ppm, mark as hazard
            is_hazard = temp > 45.0 or smoke > 100.0
            self.graph.nodes[room_id]["hazard"] = is_hazard
            
    def update_door_state(self, u: str, v: str, obstructed: bool):
        if self.graph.has_edge(u, v):
            self.graph[u][v]["obstructed"] = obstructed
            # Blocked doors have massive edge weight (impassable)
            self.graph[u][v]["weight"] = float("inf") if obstructed else 1.0

    def get_active_hazards(self) -> List[str]:
        return [n for n, attr in self.graph.nodes(data=True) if attr.get("hazard", False)]

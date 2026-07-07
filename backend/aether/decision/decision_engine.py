import networkx as nx
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from ..understanding.tracker import StateTracker, OccupantState
from ..understanding.spatial_model import SpatialLayout

class RecommendedAction(BaseModel):
    action_type: str  # dispatch_responder, evacuate_occupants, block_room
    target_room: str
    description: str
    route: Optional[List[str]] = None
    assigned_responder_id: Optional[str] = None
    severity: str = "medium"  # medium, high, critical

class DecisionEngine:
    def __init__(self, tracker: StateTracker, spatial_layout: SpatialLayout):
        self.tracker = tracker
        self.spatial_layout = spatial_layout

    def get_routing_graph(self) -> nx.Graph:
        """
        Creates a copy of the spatial layout graph, but blocks/penalizes nodes
        that contain hazards (like fire or smoke).
        """
        g_copy = self.spatial_layout.graph.copy()
        
        # Penalize nodes that have active hazards (fire/smoke)
        for node, attrs in self.spatial_layout.graph.nodes(data=True):
            if attrs.get("hazard", False):
                # Make all incoming edges to this node impassable
                for neighbor in list(g_copy.neighbors(node)):
                    g_copy[node][neighbor]["weight"] = float("inf")
                    
        return g_copy

    def find_shortest_safe_path(self, start: str, end: str) -> Optional[List[str]]:
        g = self.get_routing_graph()
        try:
            path = nx.shortest_path(g, source=start, target=end, weight="weight")
            # If path contains inf weight, it means no path is available
            path_weight = sum(g[path[i]][path[i+1]]["weight"] for i in range(len(path)-1))
            if path_weight == float("inf"):
                return None
            return path
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

    def get_recommendations(self) -> List[RecommendedAction]:
        recommendations: List[RecommendedAction] = []
        
        # 1. Fetch active alerts from understanding tracker
        alerts = self.tracker.get_active_alerts()
        
        # Get active nurse list
        nurses = [occ for occ in self.tracker.occupants.values() if occ.role == "nurse"]
        
        # Process dispatches for critical patient alerts
        for alert in alerts:
            alert_room = alert["room_id"]
            entity_id = alert["entity_id"]
            
            # Find closest nurse
            best_nurse: Optional[OccupantState] = None
            best_path: Optional[List[str]] = None
            best_dist = float("inf")
            
            for nurse in nurses:
                path = self.find_shortest_safe_path(nurse.current_room, alert_room)
                if path:
                    # Calculate weight/length
                    dist = len(path)
                    if dist < best_dist:
                        best_dist = dist
                        best_nurse = nurse
                        best_path = path
            
            if best_nurse:
                severity = "critical" if alert["type"] == "fall_detected" else "high"
                recommendations.append(RecommendedAction(
                    action_type="dispatch_responder",
                    target_room=alert_room,
                    description=f"DISPATCH responder {best_nurse.entity_id} from {best_nurse.current_room} to assist {entity_id} in {alert_room} due to {alert['type'].replace('_', ' ')}.",
                    route=best_path,
                    assigned_responder_id=best_nurse.entity_id,
                    severity=severity
                ))
            else:
                # No nurse could reach (maybe all paths blocked)
                recommendations.append(RecommendedAction(
                    action_type="dispatch_responder",
                    target_room=alert_room,
                    description=f"CRITICAL: Immediate assistance needed for {entity_id} in {alert_room}. NO RESPONDERS AVAILABLE/REACHABLE!",
                    severity="critical"
                ))

        # 2. Process Evacuations for active fire hazards
        hazards = self.spatial_layout.get_active_hazards()
        if hazards:
            # Everyone in the building (except in exit nodes) needs to be routed to safety
            for entity_id, occ in self.tracker.occupants.items():
                if occ.current_room in ["Exit-1", "Exit-2"] or occ.posture == "fallen":
                    continue  # Already safe or requires dispatch/stretcher (handled above)
                
                # Check path to both exits
                path_to_exit1 = self.find_shortest_safe_path(occ.current_room, "Exit-1")
                path_to_exit2 = self.find_shortest_safe_path(occ.current_room, "Exit-2")
                
                # Choose the shortest/safest route
                best_route = None
                chosen_exit = None
                
                if path_to_exit1 and path_to_exit2:
                    if len(path_to_exit1) <= len(path_to_exit2):
                        best_route = path_to_exit1
                        chosen_exit = "Exit-1"
                    else:
                        best_route = path_to_exit2
                        chosen_exit = "Exit-2"
                elif path_to_exit1:
                    best_route = path_to_exit1
                    chosen_exit = "Exit-1"
                elif path_to_exit2:
                    best_route = path_to_exit2
                    chosen_exit = "Exit-2"
                    
                if best_route:
                    # Only recommend if they are not already at the exit
                    if len(best_route) > 1:
                        recommendations.append(RecommendedAction(
                            action_type="evacuate_occupants",
                            target_room=chosen_exit,
                            description=f"EVACUATE {occ.role} {entity_id} from {occ.current_room} to {chosen_exit} via path: {' -> '.join(best_route)}.",
                            route=best_route,
                            severity="critical"
                        ))
                else:
                    # Occupant is trapped!
                    recommendations.append(RecommendedAction(
                        action_type="evacuate_occupants",
                        target_room=occ.current_room,
                        description=f"TRAPPED OCCUPANT: {occ.role} {entity_id} in {occ.current_room} has no safe escape route. All exits blocked by hazard!",
                        severity="critical"
                    ))
                    
        return recommendations

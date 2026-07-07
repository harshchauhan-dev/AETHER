from datetime import datetime
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from ..perception.sensors import (
    WiFiCSITelemetry,
    mmWaveTelemetry,
    BluetoothUWBTelemetry,
    AcousticTelemetry,
    EnvironmentalTelemetry,
    PressureMatTelemetry,
    DoorContactTelemetry,
)
from .spatial_model import SpatialLayout
import numpy as np
import math

class UnscentedKalmanFilter:
    def __init__(self, x: float, y: float, alpha: float = 0.05, beta: float = 2.0, kappa: float = 0.0):
        # State vector: [x, y, vx, vy, ax, ay] - kinematic state with acceleration
        self.x = np.array([x, y, 0.0, 0.0, 0.0, 0.0], dtype=float)
        # Covariance matrix P
        self.P = np.eye(6, dtype=float) * 0.5
        # Base process noise Q
        self.Q = np.eye(6, dtype=float) * 0.05
        # Measurement noise R (x, y coordinates from sensors)
        self.R = np.eye(2, dtype=float) * 0.1
        
        self.L = 6  # State dimension
        self.alpha = alpha
        self.beta = beta
        self.kappa = kappa
        
        # Scaling parameter lambda
        self.lambd = (self.alpha ** 2) * (self.L + self.kappa) - self.L
        
        # Weights for mean and covariance calculation
        self.w_m = np.zeros(2 * self.L + 1)
        self.w_c = np.zeros(2 * self.L + 1)
        
        self.w_m[0] = self.lambd / (self.L + self.lambd)
        self.w_c[0] = self.w_m[0] + (1 - self.alpha**2 + self.beta)
        
        for i in range(1, 2 * self.L + 1):
            self.w_m[i] = 1.0 / (2.0 * (self.L + self.lambd))
            self.w_c[i] = self.w_m[i]
            
        self.sigma_points = np.zeros((2 * self.L + 1, self.L))
        self.generate_sigma_points()

    def generate_sigma_points(self) -> np.ndarray:
        sigmas = np.zeros((2 * self.L + 1, self.L))
        sigmas[0] = self.x
        
        # Scaled covariance for sigma point generation
        P_scaled = (self.L + self.lambd) * self.P
        try:
            U = np.linalg.cholesky(P_scaled)
        except np.linalg.LinAlgError:
            # Regularize if not positive definite due to floating-point drift
            eps = 1e-6
            for _ in range(5):
                try:
                    U = np.linalg.cholesky(P_scaled + np.eye(self.L) * eps)
                    break
                except np.linalg.LinAlgError:
                    eps *= 10
            else:
                U = np.diag(np.sqrt(np.maximum(0.0, np.diag(P_scaled))))
                
        for i in range(self.L):
            sigmas[i + 1] = self.x + U[:, i]
            sigmas[i + 1 + self.L] = self.x - U[:, i]
            
        self.sigma_points = sigmas
        return sigmas

    def predict(self, dt: float):
        sigmas = self.generate_sigma_points()
        
        # Non-linear continuous kinematic motion model
        # x_t+1 = x_t + v_x * dt + 0.5 * a_x * dt^2
        # v_x_t+1 = v_x_t + a_x * dt
        # a_x_t+1 = a_x_t (constant acceleration model with decay)
        F = np.array([
            [1.0, 0.0, dt,  0.0, 0.5*dt**2, 0.0],
            [0.0, 1.0, 0.0, dt,  0.0, 0.5*dt**2],
            [0.0, 0.0, 1.0, 0.0, dt,  0.0],
            [0.0, 0.0, 0.0, 1.0, 0.0, dt ],
            [0.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 0.0, 1.0]
        ], dtype=float)
        
        # Propagate each sigma point through the process model
        sigmas_pred = np.zeros_like(sigmas)
        for i in range(2 * self.L + 1):
            sigmas_pred[i] = F @ sigmas[i]
            
        # Reconstruct predicted state mean
        x_pred = np.zeros(self.L)
        for i in range(2 * self.L + 1):
            x_pred += self.w_m[i] * sigmas_pred[i]
            
        # Adaptive process noise: higher velocities introduce larger kinematic disturbances
        speed = math.sqrt(x_pred[2]**2 + x_pred[3]**2)
        dynamic_Q = self.Q * (1.0 + speed * 0.4)
        
        # Reconstruct predicted state covariance
        P_pred = np.zeros((self.L, self.L))
        for i in range(2 * self.L + 1):
            diff = (sigmas_pred[i] - x_pred).reshape(-1, 1)
            P_pred += self.w_c[i] * (diff @ diff.T)
        P_pred += dynamic_Q
        
        self.x = x_pred
        self.P = P_pred
        self.sigma_points = sigmas_pred

    def update(self, z: np.ndarray):
        # Linear measurement model extracting position (x, y) from state vector
        H = np.array([
            [1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0, 0.0, 0.0]
        ], dtype=float)
        
        sigmas = self.generate_sigma_points()
        
        # Project sigma points to measurement space
        sigmas_meas = np.zeros((2 * self.L + 1, 2))
        for i in range(2 * self.L + 1):
            sigmas_meas[i] = H @ sigmas[i]
            
        # Compute predicted measurement mean
        z_pred = np.zeros(2)
        for i in range(2 * self.L + 1):
            z_pred += self.w_m[i] * sigmas_meas[i]
            
        # Compute measurement covariance S
        S = np.zeros((2, 2))
        for i in range(2 * self.L + 1):
            diff = (sigmas_meas[i] - z_pred).reshape(-1, 1)
            S += self.w_c[i] * (diff @ diff.T)
        S += self.R
        
        # Compute cross-covariance P_xz
        P_xz = np.zeros((self.L, 2))
        for i in range(2 * self.L + 1):
            diff_x = (sigmas[i] - self.x).reshape(-1, 1)
            diff_z = (sigmas_meas[i] - z_pred).reshape(-1, 1)
            P_xz += self.w_c[i] * (diff_x @ diff_z.T)
            
        # Compute Kalman Gain
        K = P_xz @ np.linalg.inv(S)
        
        # Update mean and covariance
        self.x = self.x + K @ (z - z_pred)
        self.P = self.P - K @ S @ K.T
        self.generate_sigma_points()

# Maintain class alias for backward compatibility
ExtendedKalmanFilter = UnscentedKalmanFilter

class OccupantState(BaseModel):
    entity_id: str
    role: str
    current_room: str
    posture: str = "standing"  # standing, sitting, lying_down, fallen
    activity: str = "unknown"  # walking, resting, sedentary, distressed
    breathing_rate: Optional[float] = None
    last_seen: datetime
    inactivity_duration: float = 0.0  # seconds spent in static state
    pos_x: float = 0.0
    pos_y: float = 0.0
    pos_z: float = 1.7
    tag_id: Optional[str] = None
    sigma_points: List[List[float]] = Field(default_factory=list)

class StateTracker:
    def __init__(self, spatial_layout: SpatialLayout):
        self.spatial_layout = spatial_layout
        self.occupants: Dict[str, OccupantState] = {}
        
        # Tag map: tag_id -> entity_id
        self.tag_map: Dict[str, str] = {}
        
        # Keep track of last telemetry timestamp
        self.last_update_time: Optional[datetime] = None
        
        # State-space Kalman tracking filter mapping
        self.kalman_filters: Dict[str, ExtendedKalmanFilter] = {}

    def register_tag(self, tag_id: str, entity_id: str, role: str):
        self.tag_map[tag_id] = entity_id
        if entity_id not in self.occupants:
            self.occupants[entity_id] = OccupantState(
                entity_id=entity_id,
                role=role,
                current_room="Staff-Station" if role == "nurse" else "ICU-1",
                last_seen=datetime.now(),
                tag_id=tag_id
            )

    def process_telemetry(self, telemetry_list: List[Any]):
        if not telemetry_list:
            return
            
        current_time = telemetry_list[0].timestamp if hasattr(telemetry_list[0], 'timestamp') else datetime.now()
        time_delta = 0.0
        if self.last_update_time:
            time_delta = (current_time - self.last_update_time).total_seconds()
        self.last_update_time = current_time
        
        # 1. First parse UWB/Bluetooth to pin positions of tagged responders/entities
        uwb_events = [t for t in telemetry_list if isinstance(t, BluetoothUWBTelemetry)]
        for t in uwb_events:
            entity_id = self.tag_map.get(t.tag_id)
            if not entity_id:
                # Dynamically create tag mappings
                if "nurse" in t.tag_id.lower():
                    entity_id = t.tag_id.replace("TAG-", "").lower()
                    self.register_tag(t.tag_id, entity_id, "nurse")
                else:
                    entity_id = t.tag_id.replace("TAG-", "").lower()
                    self.register_tag(t.tag_id, entity_id, "patient")
            
            occ = self.occupants[entity_id]
            occ.current_room = t.room_id
            occ.last_seen = t.timestamp
            
        # 2. Process environmental states
        env_events = [t for t in telemetry_list if isinstance(t, EnvironmentalTelemetry)]
        for t in env_events:
            self.spatial_layout.update_environmental_state(t.room_id, t.temperature, t.smoke_ppm)

        # 3. Process door states
        door_events = [t for t in telemetry_list if isinstance(t, DoorContactTelemetry)]
        for t in door_events:
            self.spatial_layout.update_door_state(t.from_room, t.to_room, t.is_obstructed)

        # 4. Process mmWave telemetry for physical locations/postures
        mmwave_events = [t for t in telemetry_list if isinstance(t, mmWaveTelemetry)]
        for t in mmwave_events:
            room = t.room_id
            # Find occupants currently in this room
            room_occupants = [occ for occ in self.occupants.values() if occ.current_room == room]
            
            # Map coordinates to occupants in the room
            # Simplification: if one occupant, map directly. If multiple, map by proximity
            for i, pos in enumerate(t.positions):
                x, y, z = pos
                vel = t.velocities[i] if i < len(t.velocities) else (0.0, 0.0, 0.0)
                speed = (vel[0]**2 + vel[1]**2 + vel[2]**2)**0.5
                
                # Proximity match
                matched_occ: Optional[OccupantState] = None
                best_dist = float("inf")
                
                # Check for untagged occupants first or match closest
                for occ in room_occupants:
                    dist = ((occ.pos_x - x)**2 + (occ.pos_y - y)**2)**0.5
                    if dist < best_dist:
                        best_dist = dist
                        matched_occ = occ
                        
                if matched_occ:
                    # Kalman filter tracking override
                    eid = matched_occ.entity_id
                    if eid not in self.kalman_filters:
                        self.kalman_filters[eid] = ExtendedKalmanFilter(x, y)
                    
                    kf = self.kalman_filters[eid]
                    dt = time_delta if time_delta > 0 else 1.0
                    kf.predict(dt)
                    kf.update(np.array([x, y]))

                    # Update coordinates from Kalman Filter state space
                    matched_occ.pos_x = float(kf.x[0])
                    matched_occ.pos_y = float(kf.x[1])
                    matched_occ.pos_z = z
                    matched_occ.last_seen = t.timestamp
                    
                    # Posture detection from height (z)
                    if t.has_sudden_drop or z < 0.35:
                        # Fall or laying down
                        if t.has_sudden_drop:
                            matched_occ.posture = "fallen"
                            matched_occ.activity = "distressed"
                        else:
                            matched_occ.posture = "lying_down"
                            matched_occ.activity = "resting"
                    elif z < 1.2:
                        matched_occ.posture = "sitting"
                        matched_occ.activity = "resting"
                    else:
                        matched_occ.posture = "standing"
                        matched_occ.activity = "walking" if speed > 0.2 else "sedentary"
                else:
                    # Create an untagged entity (Visitor)
                    visitor_id = f"visitor_{room.lower()}_{len(self.occupants) + 1}"
                    self.occupants[visitor_id] = OccupantState(
                        entity_id=visitor_id,
                        role="visitor",
                        current_room=room,
                        pos_x=x,
                        pos_y=y,
                        pos_z=z,
                        last_seen=t.timestamp,
                        posture="standing",
                        activity="walking" if speed > 0.2 else "sedentary"
                    )
                    # Initialize Kalman Filter state
                    self.kalman_filters[visitor_id] = ExtendedKalmanFilter(x, y)

        # 5. Process Pressure Mats (ICUs/Wards)
        mat_events = [t for t in telemetry_list if isinstance(t, PressureMatTelemetry)]
        for t in mat_events:
            if t.is_occupied:
                # Find patient in this room
                patients_in_room = [occ for occ in self.occupants.values() if occ.current_room == t.room_id and occ.role == "patient"]
                if patients_in_room:
                    p = patients_in_room[0]
                    p.posture = "lying_down"
                    p.activity = "resting"
                    p.pos_z = 0.3
                    p.last_seen = t.timestamp

        # 6. Process CSI breathing rate & movement
        csi_events = [t for t in telemetry_list if isinstance(t, WiFiCSITelemetry)]
        for t in csi_events:
            room = t.room_id
            room_occupants = [occ for occ in self.occupants.values() if occ.current_room == room]
            
            for occ in room_occupants:
                if t.breathing_rate:
                    occ.breathing_rate = t.breathing_rate
                
                # If CSI variance is very small (< 0.05) and posture is not standing, increase inactivity duration
                is_low_motion = t.amplitude_variance < 0.05
                if is_low_motion and occ.posture in ["sitting", "lying_down", "fallen"]:
                    occ.inactivity_duration += time_delta
                else:
                    occ.inactivity_duration = 0.0

        # 7. Acoustic Events (screams, crashes)
        acoustic_events = [t for t in telemetry_list if isinstance(t, AcousticTelemetry)]
        for t in acoustic_events:
            if t.sound_type in ["scream", "crash", "cry_for_help"]:
                # Mark room occupants as distressed/alerted
                room_occupants = [occ for occ in self.occupants.values() if occ.current_room == t.room_id]
                for occ in room_occupants:
                    occ.last_seen = t.timestamp
                    if occ.posture == "fallen" or occ.role == "patient":
                        occ.activity = "distressed"

        # 8. Update sigma points for all occupants that have an active UKF tracking filter
        for eid, occ in self.occupants.items():
            if eid in self.kalman_filters:
                kf = self.kalman_filters[eid]
                occ.sigma_points = [[float(pt[0]), float(pt[1])] for pt in kf.sigma_points]

    def get_room_occupancy(self, room_id: str) -> List[OccupantState]:
        return [occ for occ in self.occupants.values() if occ.current_room == room_id]

    def get_active_alerts(self) -> List[Dict[str, Any]]:
        alerts = []
        for occ in self.occupants.values():
            if occ.posture == "fallen":
                alerts.append({
                    "entity_id": occ.entity_id,
                    "room_id": occ.current_room,
                    "type": "fall_detected",
                    "severity": "critical",
                    "message": f"FALL DETECTED: Patient {occ.entity_id} has fallen in {occ.current_room}."
                })
            elif occ.role == "patient" and occ.inactivity_duration > 60.0:  # 60s for demo purposes
                alerts.append({
                    "entity_id": occ.entity_id,
                    "room_id": occ.current_room,
                    "type": "immobility_alert",
                    "severity": "warning",
                    "message": f"IMMOBILITY DETECTED: Patient {occ.entity_id} in {occ.current_room} has been inactive for {int(occ.inactivity_duration)}s."
                })
        return alerts

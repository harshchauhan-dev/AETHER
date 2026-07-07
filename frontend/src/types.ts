export interface OccupantState {
  entity_id: string;
  role: "patient" | "nurse" | "visitor" | "unknown";
  current_room: string;
  posture: "standing" | "sitting" | "lying_down" | "fallen";
  activity: string;
  breathing_rate: number | null;
  inactivity_duration: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  sigma_points?: any[];
}

export interface RoomState {
  room_id: string;
  room_type: string;
  temperature: number;
  smoke_ppm: number;
  is_hazard: boolean;
  pos: [number, number];
  room_width_m?: number;
  room_height_m?: number;
}

export interface Alert {
  entity_id: string | null;
  room_id: string;
  type: string;
  severity: string;
  message: string;
  confidence?: number;
  reasons?: string[];
}

export interface Prediction {
  alert_type: string;
  room_id: string;
  entity_id: string | null;
  probability: number;
  description: string;
  confidence?: number;
  reasons?: string[];
}

export interface ActionRecommendation {
  action_type: string;
  target_room: string;
  description: string;
  route: string[] | null;
  assigned_responder_id: string | null;
  severity: string;
}

export interface HospitalState {
  id: string;
  name: string;
  sim_time: string;
  step: number;
  ping: number;
  csi_quality: number;
  csi_packets: number;
  occupants: OccupantState[];
  rooms: RoomState[];
  alerts: Alert[];
  predictions: Prediction[];
  actions: ActionRecommendation[];
  hazards: string[];
  connections: [string, string][];
}

export interface HospitalMeta {
  id: string;
  name: string;
  coords: [number, number];  // [lat, lng] geographic coordinates
  active_alerts_count: number;
  ping: number;
  csi_quality: number;
  csi_packets: number;
  status: "normal" | "emergency";
}

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp?: string;
}

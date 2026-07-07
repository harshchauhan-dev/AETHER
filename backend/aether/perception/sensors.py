from typing import List, Optional, Tuple
from pydantic import BaseModel, Field
from datetime import datetime

class WiFiCSITelemetry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    room_id: str
    amplitude_variance: float = Field(..., description="CSI amplitude variance showing motion level")
    phase_variance: float = Field(..., description="CSI phase variance")
    breathing_rate: Optional[float] = Field(None, description="Inferred breathing rate in breaths/min if resting")

class mmWaveTelemetry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    room_id: str
    target_count: int = Field(..., description="Number of tracked point targets")
    # Coordinates of tracked targets: list of (x, y, z) in meters relative to room sensor
    positions: List[Tuple[float, float, float]] = Field(default_factory=list)
    # Velocity vectors of tracked targets: list of (vx, vy, vz)
    velocities: List[Tuple[float, float, float]] = Field(default_factory=list)
    has_sudden_drop: bool = Field(False, description="Flag representing sudden height drop indicative of a fall")

class BluetoothUWBTelemetry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    tag_id: str = Field(..., description="Identifier of the Bluetooth/UWB beacon tag")
    room_id: str = Field(..., description="Room where the tag is closest/located")
    rssi: float = Field(..., description="Received Signal Strength Indicator")
    distance: float = Field(..., description="Estimated distance in meters")

class AcousticTelemetry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    room_id: str
    decibels: float = Field(..., description="Ambient decibel level")
    sound_type: str = Field("normal", description="Classification of the sound (normal, scream, crash, cry_for_help)")

class EnvironmentalTelemetry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    room_id: str
    temperature: float = Field(..., description="Temperature in Celsius")
    smoke_ppm: float = Field(..., description="Smoke concentration in parts per million")

class PressureMatTelemetry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    room_id: str
    mat_id: str = Field(..., description="Identifier of the specific bed or chair pressure mat")
    weight_kg: float = Field(..., description="Measured weight on the mat")
    is_occupied: bool = Field(..., description="True if weight exceeds threshold (e.g. > 15kg)")

class DoorContactTelemetry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    door_id: str = Field(..., description="Identifier of the door (e.g., Door-ICU-1, Exit-Door-1)")
    from_room: str
    to_room: str
    is_open: bool = Field(..., description="True if open, False if closed")
    is_obstructed: bool = Field(False, description="True if door is blocked from opening/closing fully")

"""
AETHER Database Layer — SQLite persistence for multi-hospital telemetry, occupancy, alerts, and chat.
"""
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aether.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── ORM Models ──────────────────────────────────────────────────────────────

class OccupantHistoryRow(Base):
    __tablename__ = "occupant_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hospital_id = Column(String, index=True, default="metro_care")
    timestamp = Column(DateTime, default=datetime.utcnow)
    entity_id = Column(String, index=True)
    role = Column(String)
    room_id = Column(String, index=True)
    posture = Column(String)
    activity = Column(String)
    pos_x = Column(Float)
    pos_y = Column(Float)
    pos_z = Column(Float)
    breathing_rate = Column(Float, nullable=True)
    inactivity_duration = Column(Float, default=0.0)


class EnvironmentalHistoryRow(Base):
    __tablename__ = "environmental_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hospital_id = Column(String, index=True, default="metro_care")
    timestamp = Column(DateTime, default=datetime.utcnow)
    room_id = Column(String, index=True)
    temperature = Column(Float)
    smoke_ppm = Column(Float)
    is_hazard = Column(Boolean, default=False)


class AlertHistoryRow(Base):
    __tablename__ = "alert_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hospital_id = Column(String, index=True, default="metro_care")
    timestamp = Column(DateTime, default=datetime.utcnow)
    entity_id = Column(String, nullable=True)
    room_id = Column(String, index=True)
    alert_type = Column(String)
    severity = Column(String)
    message = Column(Text)


class ChatMessageRow(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hospital_id = Column(String, index=True, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    role = Column(String)   # "user" or "agent"
    content = Column(Text)


# ─── Create tables ───────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── CRUD helpers ────────────────────────────────────────────────────────────

def log_occupant_snapshot(db: Session, hospital_id: str, timestamp: datetime, occupants: Dict[str, Any]):
    """Persist a snapshot of every tracked occupant into occupant_history."""
    for occ_id, occ in occupants.items():
        row = OccupantHistoryRow(
            hospital_id=hospital_id,
            timestamp=timestamp,
            entity_id=occ.entity_id,
            role=occ.role,
            room_id=occ.current_room,
            posture=occ.posture,
            activity=occ.activity,
            pos_x=occ.pos_x,
            pos_y=occ.pos_y,
            pos_z=occ.pos_z,
            breathing_rate=occ.breathing_rate,
            inactivity_duration=occ.inactivity_duration,
        )
        db.add(row)
    db.commit()


def log_environmental_snapshot(db: Session, hospital_id: str, timestamp: datetime, graph_nodes):
    """Persist environmental readings per room."""
    for node, attrs in graph_nodes:
        row = EnvironmentalHistoryRow(
            hospital_id=hospital_id,
            timestamp=timestamp,
            room_id=node,
            temperature=attrs.get("temperature", 21.5),
            smoke_ppm=attrs.get("smoke_ppm", 0.0),
            is_hazard=attrs.get("hazard", False),
        )
        db.add(row)
    db.commit()


def log_alerts(db: Session, hospital_id: str, timestamp: datetime, alerts: List[Dict[str, Any]]):
    """Persist fired alerts."""
    for a in alerts:
        row = AlertHistoryRow(
            hospital_id=hospital_id,
            timestamp=timestamp,
            entity_id=a.get("entity_id"),
            room_id=a["room_id"],
            alert_type=a["type"],
            severity=a["severity"],
            message=a["message"],
        )
        db.add(row)
    db.commit()


def save_chat_message(db: Session, hospital_id: Optional[str], role: str, content: str):
    row = ChatMessageRow(hospital_id=hospital_id, role=role, content=content)
    db.add(row)
    db.commit()


def get_chat_history(db: Session, hospital_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, str]]:
    query = db.query(ChatMessageRow)
    if hospital_id:
        query = query.filter(ChatMessageRow.hospital_id == hospital_id)
    rows = query.order_by(ChatMessageRow.id.desc()).limit(limit).all()
    return [{"role": r.role, "content": r.content, "timestamp": r.timestamp.isoformat()} for r in reversed(rows)]


def get_occupancy_heatmap(db: Session, hospital_id: str) -> Dict[str, float]:
    """Return fraction of recorded snapshots in which each room was occupied for a specific hospital."""
    from sqlalchemy import func, distinct
    total_snapshots = (
        db.query(func.count(distinct(OccupantHistoryRow.timestamp)))
        .filter(OccupantHistoryRow.hospital_id == hospital_id)
        .scalar() or 1
    )
    rows = (
        db.query(OccupantHistoryRow.room_id, func.count(distinct(OccupantHistoryRow.timestamp)))
        .filter(OccupantHistoryRow.hospital_id == hospital_id)
        .group_by(OccupantHistoryRow.room_id)
        .all()
    )
    return {room: count / total_snapshots for room, count in rows}


def get_recent_alerts(db: Session, hospital_id: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
    query = db.query(AlertHistoryRow)
    if hospital_id:
        query = query.filter(AlertHistoryRow.hospital_id == hospital_id)
    rows = query.order_by(AlertHistoryRow.id.desc()).limit(limit).all()
    return [
        {
            "hospital_id": r.hospital_id,
            "entity_id": r.entity_id,
            "room_id": r.room_id,
            "type": r.alert_type,
            "severity": r.severity,
            "message": r.message,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in reversed(rows)
    ]


def clear_all_history(db: Session):
    """Wipe all historical tables (used on simulation reset)."""
    db.query(OccupantHistoryRow).delete()
    db.query(EnvironmentalHistoryRow).delete()
    db.query(AlertHistoryRow).delete()
    db.query(ChatMessageRow).delete()
    db.commit()

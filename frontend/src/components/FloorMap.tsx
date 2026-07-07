import { useEffect, useRef, useState } from "react";
import type { OccupantState, RoomState, ActionRecommendation } from "../types";

// ── Metric-scaled room layout ──
// Scale: 1 meter = 40 pixels
const M = 40;
const PAD = 30; // Canvas padding

// Room positions in meters from top-left origin, with real dimensions
const ROOM_LAYOUT: Record<string, { x: number; y: number; w: number; h: number }> = {
  "Kitchen":       { x: 4.5, y: 0,    w: 5.0, h: 3.0 },
  "ICU-1":         { x: 0,   y: 3.2,  w: 4.0, h: 5.0 },
  "ICU-2":         { x: 0,   y: 8.5,  w: 4.0, h: 5.0 },
  "Staff-Station": { x: 4.2, y: 3.2,  w: 6.0, h: 8.0 },
  "Ward-3":        { x: 10.5,y: 3.2,  w: 4.0, h: 5.0 },
  "Ward-4":        { x: 10.5,y: 8.5,  w: 4.0, h: 5.0 },
  "Corridor":      { x: 1.5, y: 13.8, w: 12.0,h: 2.0 },
  "Exit-1":        { x: 13.8,y: 13.8, w: 2.0, h: 2.0 },
  "Exit-2":        { x: -0.5,y: 13.8, w: 2.0, h: 2.0 },
};

// Door connections: each door is a gap between two rooms, defined as midpoints
const DOOR_DEFS: { from: string; to: string; x: number; y: number; vertical: boolean }[] = [
  { from: "ICU-1",    to: "Staff-Station", x: 4.0,  y: 5.2,  vertical: true },
  { from: "ICU-2",    to: "Staff-Station", x: 4.0,  y: 10.5, vertical: true },
  { from: "Ward-3",   to: "Staff-Station", x: 10.3, y: 5.2,  vertical: true },
  { from: "Ward-4",   to: "Staff-Station", x: 10.3, y: 10.5, vertical: true },
  { from: "Kitchen",  to: "Staff-Station", x: 6.5,  y: 3.0,  vertical: false },
  { from: "Corridor", to: "Staff-Station", x: 6.5,  y: 11.2, vertical: false },
  { from: "Corridor", to: "Exit-1",        x: 13.5, y: 14.3, vertical: true },
  { from: "Corridor", to: "Exit-2",        x: 1.5,  y: 14.3, vertical: true },
  { from: "ICU-2",    to: "Corridor",      x: 2.0,  y: 13.5, vertical: false },
  { from: "Ward-4",   to: "Corridor",      x: 12.5, y: 13.5, vertical: false },
];

function toPixel(meters: number): number {
  return PAD + meters * M;
}

function roomRect(id: string) {
  const r = ROOM_LAYOUT[id];
  if (!r) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: toPixel(r.x), y: toPixel(r.y), w: r.w * M, h: r.h * M };
}

function roomCenter(id: string) {
  const r = roomRect(id);
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

const TACTICAL_NAMES: Record<string, string> = {
  "Kitchen":       "Hangar Deck",
  "ICU-1":         "Recon Zone 1",
  "ICU-2":         "Recon Zone 2",
  "Staff-Station": "Command Bridge",
  "Ward-3":        "Storage Zone A",
  "Ward-4":        "Storage Zone B",
  "Corridor":      "Transit Corridor",
  "Exit-1":        "Escape Port A",
  "Exit-2":        "Escape Port B",
};

interface FloorMapProps {
  rooms: RoomState[];
  occupants: OccupantState[];
  hazards: string[];
  connections: [string, string][];
  actions: ActionRecommendation[];
  predictiveTime?: number | null;
  onRoomClick?: (roomId: string) => void;
  selectedRoomId?: string | null;
}

// Smooth position tracking for occupants
const occupantPositions: Record<string, { x: number; y: number }> = {};

export default function FloorMap({ 
  rooms, 
  occupants, 
  hazards, 
  connections, 
  actions, 
  predictiveTime = null,
  onRoomClick,
  selectedRoomId = null
}: FloorMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<"standard" | "thermal" | "confidence">("standard");
  const viewModeRef = useRef(viewMode);
  const selectedRoomIdRef = useRef(selectedRoomId);

  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);

  const getRoomAtCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = 660 / rect.width;
    const scaleY = 680 / rect.height;
    
    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;
    
    const metersX = (clickX - PAD) / M;
    const metersY = (clickY - PAD) / M;

    for (const [roomId, room] of Object.entries(ROOM_LAYOUT)) {
      if (metersX >= room.x && metersX <= room.x + room.w &&
          metersY >= room.y && metersY <= room.y + room.h) {
        return roomId;
      }
    }
    return null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const roomId = getRoomAtCoords(e.clientX, e.clientY);
    if (roomId && onRoomClick) {
      onRoomClick(roomId);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const roomId = getRoomAtCoords(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = roomId ? "pointer" : "default";
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = 660;
    const logicalHeight = 680;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      phase += 0.025;

      // ── Clear ──
      ctx.fillStyle = "#040406";
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      // ── 1. Subtle metric grid ──
      ctx.strokeStyle = "rgba(59, 130, 246, 0.03)";
      ctx.lineWidth = 0.5;
      for (let x = PAD; x < logicalWidth; x += M) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, logicalHeight); ctx.stroke();
      }
      for (let y = PAD; y < logicalHeight; y += M) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(logicalWidth, y); ctx.stroke();
      }

      // ── 2. Laser sweep ──
      const sweepX = (phase * 140) % (logicalWidth + 120) - 60;
      const grad = ctx.createLinearGradient(sweepX - 40, 0, sweepX + 40, 0);
      grad.addColorStop(0, "rgba(59, 130, 246, 0)");
      grad.addColorStop(0.5, "rgba(59, 130, 246, 0.04)");
      grad.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      // ── 3. Room adjacency links (dashed lines between centroids) ──
      connections.forEach(([u, v]) => {
        const cu = roomCenter(u);
        const cv = roomCenter(v);
        ctx.strokeStyle = "rgba(59, 130, 246, 0.04)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(cu.cx, cu.cy); ctx.lineTo(cv.cx, cv.cy); ctx.stroke();
        ctx.setLineDash([]);
      });

      // ── 3.1 Ambient RF wave ripples ──
      Object.keys(ROOM_LAYOUT).forEach(roomId => {
        const c = roomCenter(roomId);
        const isHaz = hazards.includes(roomId);
        const waveColor = isHaz ? "rgba(239, 68, 68, " : "rgba(59, 130, 246, ";
        ctx.save();
        ctx.setLineDash([2, 6]);
        for (let w = 0; w < 3; w++) {
          const wp = (phase * 1.2 + w * 0.8) % 2.5;
          const wR = 10 + wp * 28;
          const alpha = Math.max(0, 0.05 - wp * 0.02);
          ctx.strokeStyle = waveColor + alpha + ")";
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.arc(c.cx, c.cy, wR, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      });

      // ── 4. Evacuation & dispatch route lines ──
      const evacRoutes = actions.filter(a => a.action_type === "evacuate_occupants" && a.route);
      const dispatchRoutes = actions.filter(a => a.action_type === "dispatch_responder" && a.route);

      evacRoutes.forEach(action => {
        action.route!.forEach((_, ni) => {
          if (ni === action.route!.length - 1) return;
          const from = roomCenter(action.route![ni]);
          const to = roomCenter(action.route![ni + 1]);
          ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "#10b981"; ctx.shadowBlur = 8;
          ctx.setLineDash([10, 8]); ctx.lineDashOffset = -phase * 60;
          ctx.beginPath(); ctx.moveTo(from.cx, from.cy); ctx.lineTo(to.cx, to.cy); ctx.stroke();
          ctx.setLineDash([]); ctx.shadowBlur = 0;
        });
      });

      dispatchRoutes.forEach(action => {
        action.route!.forEach((_, ni) => {
          if (ni === action.route!.length - 1) return;
          const from = roomCenter(action.route![ni]);
          const to = roomCenter(action.route![ni + 1]);
          ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "#3b82f6"; ctx.shadowBlur = 8;
          ctx.setLineDash([8, 6]); ctx.lineDashOffset = -phase * 50;
          ctx.beginPath(); ctx.moveTo(from.cx, from.cy); ctx.lineTo(to.cx, to.cy); ctx.stroke();
          ctx.setLineDash([]); ctx.shadowBlur = 0;
        });
      });

      // ── 5. Room fills and architectural walls ──
      rooms.forEach(room => {
        const rr = roomRect(room.room_id);
        if (!rr.w) return;
        const isHaz = hazards.includes(room.room_id);
        const name = TACTICAL_NAMES[room.room_id] || room.room_id;
        const occupantCount = occupants.filter(o => o.current_room === room.room_id).length;

        // Room fill based on view mode
        const mode = viewModeRef.current;
        if (mode === "thermal") {
          const heat = Math.min(1, (room.temperature - 21.5) / 120);
          const c = roomCenter(room.room_id);
          const maxDim = Math.max(rr.w, rr.h);
          const gs = ctx.createRadialGradient(c.cx, c.cy, 2, c.cx, c.cy, maxDim * 0.8);
          gs.addColorStop(0, `rgba(${Math.floor(230 * heat + 20)}, ${Math.floor(80 * (1 - heat))}, ${Math.floor(20 * (1 - heat))}, ${0.15 + heat * 0.45})`);
          gs.addColorStop(0.7, `rgba(${Math.floor(180 * heat + 20)}, ${Math.floor(40 * (1 - heat))}, 20, ${0.06 + heat * 0.2})`);
          gs.addColorStop(1, "rgba(8, 8, 12, 0.45)");
          ctx.fillStyle = gs;
        } else if (mode === "confidence") {
          let cert = 99;
          if (isHaz) cert = 41;
          else if (hazards.some(hz => connections.some(([u, v]) => (u === room.room_id && v === hz) || (v === room.room_id && u === hz)))) cert = 72;
          const g = cert / 100;
          ctx.fillStyle = `rgba(${Math.floor(220 * (1 - g))}, ${Math.floor(200 * g)}, 60, ${0.06 + (1 - g) * 0.12})`;
        } else {
          if (isHaz || room.temperature > 30.0) {
            const c = roomCenter(room.room_id);
            const maxDim = Math.max(rr.w, rr.h);
            const gs = ctx.createRadialGradient(c.cx, c.cy, 5, c.cx, c.cy, maxDim * 0.95);
            gs.addColorStop(0, `rgba(239, 68, 68, ${0.24 + 0.08 * Math.sin(phase * 5)})`);
            gs.addColorStop(0.6, `rgba(239, 68, 68, ${0.09 + 0.03 * Math.sin(phase * 3)})`);
            gs.addColorStop(1, "rgba(8, 8, 12, 0.25)");
            ctx.fillStyle = gs;
          } else if (occupantCount > 0) {
            ctx.fillStyle = `rgba(59, 130, 246, ${0.03 + Math.min(1, occupantCount * 0.25) * 0.04})`;
          } else {
            ctx.fillStyle = "rgba(8, 8, 12, 0.7)";
          }
        }
        ctx.fillRect(rr.x, rr.y, rr.w, rr.h);

        // Dynamic Smoke Overlay
        if (room.smoke_ppm > 40.0 && mode === "standard") {
          ctx.save();
          ctx.beginPath(); ctx.rect(rr.x, rr.y, rr.w, rr.h); ctx.clip();
          const smokeDensity = Math.min(1.0, room.smoke_ppm / 800.0);
          ctx.fillStyle = `rgba(100, 100, 115, ${smokeDensity * 0.22})`;
          ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
          
          // Draw floating smoke puffs
          ctx.fillStyle = `rgba(80, 80, 85, ${smokeDensity * 0.10})`;
          for (let puff = 0; puff < 3; puff++) {
            const px = rr.x + ((puff * 0.35 + phase * 0.04) % 1.0) * rr.w;
            const py = rr.y + ((puff * 0.45 + phase * 0.02) % 1.0) * rr.h;
            ctx.beginPath();
            ctx.arc(px, py, 10 + puff * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Architectural walls — thick white lines around each room
        ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rr.x, rr.y, rr.w, rr.h);

        // Selected room highlight
        if (room.room_id === selectedRoomIdRef.current) {
          ctx.save();
          ctx.strokeStyle = "var(--accent)";
          ctx.lineWidth = 3;
          ctx.shadowColor = "var(--accent)";
          ctx.shadowBlur = 10 + Math.sin(phase * 6) * 3;
          ctx.strokeRect(rr.x - 1, rr.y - 1, rr.w + 2, rr.h + 2);
          ctx.restore();
        }

        // Hazard hash pattern
        if (isHaz && mode === "standard") {
          ctx.save();
          ctx.beginPath(); ctx.rect(rr.x, rr.y, rr.w, rr.h); ctx.clip();
          ctx.strokeStyle = "rgba(239, 68, 68, 0.12)";
          ctx.lineWidth = 1;
          for (let d = -rr.w; d < rr.w + rr.h; d += 10) {
            ctx.beginPath(); ctx.moveTo(rr.x + d, rr.y); ctx.lineTo(rr.x + d - rr.h, rr.y + rr.h); ctx.stroke();
          }

          // Expanding smoke during predictive playback
          if (predictiveTime !== null) {
            const c = roomCenter(room.room_id);
            const radius = 15 + (predictiveTime / 60) * 100;
            const gs = ctx.createRadialGradient(c.cx, c.cy, 5, c.cx, c.cy, radius);
            gs.addColorStop(0, "rgba(239, 68, 68, 0.4)");
            gs.addColorStop(0.6, "rgba(239, 68, 68, 0.12)");
            gs.addColorStop(1, "rgba(239, 68, 68, 0)");
            ctx.fillStyle = gs;
            ctx.beginPath(); ctx.arc(c.cx, c.cy, radius, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }

        // Room label
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "bold 8px 'DM Sans', sans-serif";
        ctx.textAlign = "start";
        ctx.fillText(name.toUpperCase(), rr.x + 6, rr.y + 13);

        // Equipment icons (simple line art)
        ctx.save();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
        ctx.lineWidth = 1;
        if (room.room_type === "patient_room") {
          // Bed icon: small rectangle with headboard
          const bx = rr.x + rr.w - 28, by = rr.y + rr.h - 18;
          ctx.strokeRect(bx, by, 18, 8);
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + 10); ctx.stroke();
        } else if (room.room_type === "staff") {
          // Desk icon
          const dx = rr.x + rr.w - 26, dy = rr.y + rr.h - 16;
          ctx.strokeRect(dx, dy, 16, 6);
          ctx.beginPath(); ctx.moveTo(dx + 2, dy + 6); ctx.lineTo(dx + 2, dy + 10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(dx + 14, dy + 6); ctx.lineTo(dx + 14, dy + 10); ctx.stroke();
        } else if (room.room_type === "exit") {
          // Exit arrow
          const ex = rr.x + rr.w / 2, ey = rr.y + rr.h / 2 + 4;
          ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(ex - 6, ey); ctx.lineTo(ex + 6, ey);
          ctx.moveTo(ex + 2, ey - 4); ctx.lineTo(ex + 6, ey); ctx.lineTo(ex + 2, ey + 4);
          ctx.stroke();
        } else if (room.room_type === "corridor") {
          // Directional arrows
          const cy = rr.y + rr.h / 2;
          ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
          for (let ax = rr.x + 20; ax < rr.x + rr.w - 20; ax += 40) {
            ctx.beginPath(); ctx.moveTo(ax, cy); ctx.lineTo(ax + 10, cy);
            ctx.moveTo(ax + 7, cy - 3); ctx.lineTo(ax + 10, cy); ctx.lineTo(ax + 7, cy + 3);
            ctx.stroke();
          }
        }
        ctx.restore();

        // Per-room live telemetry micro-overlay
        const tempStr = `${room.temperature.toFixed(1)}°C`;
        const smokeStr = room.smoke_ppm > 0 ? ` | ${room.smoke_ppm.toFixed(0)}ppm` : "";
        ctx.font = "6.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = room.temperature > 40 ? "rgba(239, 68, 68, 0.7)" : "rgba(255,255,255,0.35)";
        ctx.fillText(tempStr + smokeStr, rr.x + 6, rr.y + rr.h - 6);

        // Confidence mode: show certainty percentage
        if (mode === "confidence") {
          let cert = 99;
          if (isHaz) cert = 41;
          else if (hazards.some(hz => connections.some(([u, v]) => (u === room.room_id && v === hz) || (v === room.room_id && u === hz)))) cert = 72;
          ctx.fillStyle = cert > 90 ? "rgba(16,185,129,0.7)" : cert > 60 ? "rgba(245,158,11,0.7)" : "rgba(239,68,68,0.7)";
          ctx.font = "bold 10px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${cert}%`, rr.x + rr.w / 2, rr.y + rr.h / 2 + 4);
          ctx.textAlign = "start";
        }

        // Occupant count badge
        if (occupantCount > 0) {
          const bx = rr.x + rr.w - 16, by = rr.y + 4;
          ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
          ctx.beginPath(); ctx.arc(bx + 6, by + 6, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#60a5fa";
          ctx.font = "bold 8px 'DM Sans', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${occupantCount}`, bx + 6, by + 9);
          ctx.textAlign = "start";
        }
      });

      // ── 5.1 Door gap openings ──
      DOOR_DEFS.forEach(door => {
        const doorWidth = 0.9 * M; // 0.9m door opening
        ctx.fillStyle = "#040406";
        if (door.vertical) {
          ctx.fillRect(toPixel(door.x) - 1.5, toPixel(door.y) - doorWidth / 2, 5, doorWidth);
        } else {
          ctx.fillRect(toPixel(door.x) - doorWidth / 2, toPixel(door.y) - 1.5, doorWidth, 5);
        }
        // Small door indicator marks
        ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
        ctx.lineWidth = 1;
        if (door.vertical) {
          ctx.beginPath();
          ctx.moveTo(toPixel(door.x), toPixel(door.y) - doorWidth / 2 + 2);
          ctx.lineTo(toPixel(door.x), toPixel(door.y) + doorWidth / 2 - 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(toPixel(door.x) - doorWidth / 2 + 2, toPixel(door.y));
          ctx.lineTo(toPixel(door.x) + doorWidth / 2 - 2, toPixel(door.y));
          ctx.stroke();
        }
      });

      // ── 6. Occupant rendering with smooth lerp motion ──
      occupants.forEach((occ, i) => {
        const rr = roomRect(occ.current_room);
        if (!rr.w) return;

        // Target position within room
        let targetX = rr.x + (occ.pos_x / 5.0) * (rr.w - 20) + 10;
        let targetY = rr.y + (occ.pos_y / 5.0) * (rr.h - 20) + 10;

        // Predictive interpolation
        const occupantAction = actions.find(a =>
          (a.assigned_responder_id && a.assigned_responder_id.toLowerCase().includes(occ.entity_id.toLowerCase())) ||
          (a.action_type === "evacuate_occupants" && occ.role === "patient" && a.route && a.route[0] === occ.current_room)
        );
        if (predictiveTime !== null && occupantAction && occupantAction.route) {
          const ratio = Math.min(1, predictiveTime / 60);
          const startC = roomCenter(occ.current_room);
          const endC = roomCenter(occupantAction.route[occupantAction.route.length - 1]);
          targetX = startC.cx + (endC.cx - startC.cx) * ratio;
          targetY = startC.cy + (endC.cy - startC.cy) * ratio;
        }

        // Smooth lerp from previous position
        const key = occ.entity_id;
        if (!occupantPositions[key]) {
          occupantPositions[key] = { x: targetX, y: targetY };
        }
        occupantPositions[key].x += (targetX - occupantPositions[key].x) * 0.08;
        occupantPositions[key].y += (targetY - occupantPositions[key].y) * 0.08;
        const ox = occupantPositions[key].x;
        const oy = occupantPositions[key].y;

        const isFallen = occ.posture === "fallen";
        let color = "#cbd5e1";
        let symbol = "●";
        let label = occ.entity_id.toUpperCase();

        if (occ.role === "patient") {
          color = "#3b82f6"; symbol = "★";
          label = `CIV-${occ.entity_id.replace("civilian_", "")}`;
        } else if (occ.role === "nurse") {
          color = "#10b981"; symbol = "●";
          label = `AGT-${occ.entity_id.replace("field_agent_", "").toUpperCase()}`;
        } else if (occ.role === "visitor") {
          color = "#f59e0b"; symbol = "▲";
          label = `DRN-${occ.entity_id.replace("recon_drone_", "")}`;
        } else if (occ.role === "unknown") {
          color = "#ef4444"; symbol = "◆";
          label = `UNKN-${occ.entity_id.replace("unknown_", "")}`;
        }
        if (isFallen) color = "#ef4444";

        // Predicted path dotted line
        if (occupantAction && occupantAction.route) {
          ctx.save();
          ctx.strokeStyle = occ.role === "patient" ? "rgba(16, 185, 129, 0.35)" : "rgba(59, 130, 246, 0.35)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          const pts = occupantAction.route.map(rm => roomCenter(rm));
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          pts.forEach(p => ctx.lineTo(p.cx, p.cy));
          ctx.stroke();
          ctx.restore();
        }

        // Sonar echo rings
        for (let ring = 0; ring < 2; ring++) {
          const rp = (phase * 2 + ring * 1.2) % 3;
          const rR = 5 + rp * 8;
          const rA = Math.max(0, 0.3 - rp * 0.1);
          ctx.strokeStyle = `${color}${Math.floor(rA * 255).toString(16).padStart(2, "0")}`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(ox, oy, rR, 0, Math.PI * 2); ctx.stroke();
        }

        // Emergency beacon
        if (isFallen) {
          const pr = 5 + (Math.sin(phase * 8) + 1) * 10;
          ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(ox, oy, pr, 0, Math.PI * 2); ctx.stroke();
        }

        // Intruder warning ring
        if (occ.role === "unknown") {
          const pr = 8 + (Math.sin(phase * 6) + 1) * 6;
          ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.arc(ox, oy, pr, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw UKF Sigma Points
        if (occ.sigma_points && occ.sigma_points.length > 0) {
          ctx.save();
          ctx.fillStyle = color;
          let maxDist = 0;
          occ.sigma_points.forEach((sp: any[]) => {
            const spX = rr.x + (sp[0] / 5.0) * (rr.w - 20) + 10;
            const spY = rr.y + (sp[1] / 5.0) * (rr.h - 20) + 10;

            ctx.beginPath();
            ctx.arc(spX, spY, 1.2, 0, Math.PI * 2);
            ctx.fill();

            // Connective vector lines to centroid
            ctx.strokeStyle = color + "18"; // 9% alpha
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(spX, spY);
            ctx.stroke();

            const d = Math.sqrt((spX - ox)**2 + (spY - oy)**2);
            if (d > maxDist) maxDist = d;
          });

          // Draw covariance boundary ellipse
          ctx.strokeStyle = color + "2b"; // 17% alpha
          ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.arc(ox, oy, Math.max(6, maxDist), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Symbol
        ctx.fillStyle = color;
        ctx.font = `bold ${isFallen ? 14 : 11}px system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(symbol, ox, oy + 4);

        // Label
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 7px 'DM Sans', sans-serif";
        ctx.fillText(label + (isFallen ? " ▼DOWN" : ""), ox, i % 2 === 0 ? oy - 10 : oy + 16);

        // BPM readout
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "5.5px 'JetBrains Mono', monospace";
        const bpmStr = occ.breathing_rate ? `BPM:${occ.breathing_rate.toFixed(0)}` : "BPM:—";
        ctx.fillText(`${occ.posture.toUpperCase()} ${bpmStr}`, ox, i % 2 === 0 ? oy - 3 : oy + 23);
        ctx.textAlign = "start";
      });

      // ── 7. HUD Overlays ──
      // Top-left: Title + sim clock
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = "start";
      ctx.fillText("AETHER DIGITAL TWIN v2.0", 8, 14);

      const simTime = new Date();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "7px 'JetBrains Mono', monospace";
      ctx.fillText(`SIM TIME: ${simTime.toLocaleTimeString()}`, 8, 24);

      // Scale bar (bottom-left)
      const sbX = 8, sbY = logicalHeight - 16;
      const sbLen = 2 * M; // 2 meters
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sbX, sbY); ctx.lineTo(sbX + sbLen, sbY);
      ctx.moveTo(sbX, sbY - 3); ctx.lineTo(sbX, sbY + 3);
      ctx.moveTo(sbX + sbLen, sbY - 3); ctx.lineTo(sbX + sbLen, sbY + 3);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "6.5px 'JetBrains Mono', monospace";
      ctx.fillText("├── 2m ──┤", sbX, sbY - 5);

      // Predictive playback banner
      if (predictiveTime !== null) {
        ctx.save();
        ctx.fillStyle = "rgba(245, 158, 11, 0.06)";
        ctx.fillRect(logicalWidth / 2 - 160, 6, 320, 20);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(logicalWidth / 2 - 160, 6, 320, 20);
        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        const blink = Math.sin(phase * 10) > 0 ? "●" : " ";
        ctx.fillText(`${blink} PREDICTIVE FORECAST: T+${predictiveTime.toFixed(0)}s (PROJECTION ACTIVE)`, logicalWidth / 2, 19);
        ctx.restore();
      }

      // Bottom-right stats
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "7px 'JetBrains Mono', monospace";
      ctx.textAlign = "end";
      const zc = rooms.length, ac = occupants.length, hc = hazards.length;
      ctx.fillText(`ZONES: ${zc} | ASSETS: ${ac} | HAZARDS: ${hc}`, logicalWidth - 8, logicalHeight - 8);

      // Corner brackets
      ctx.strokeStyle = "rgba(59, 130, 246, 0.12)";
      ctx.lineWidth = 1.5;
      ctx.textAlign = "start";
      ctx.beginPath(); ctx.moveTo(3, 16); ctx.lineTo(3, 3); ctx.lineTo(16, 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(logicalWidth - 16, 3); ctx.lineTo(logicalWidth - 3, 3); ctx.lineTo(logicalWidth - 3, 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, logicalHeight - 16); ctx.lineTo(3, logicalHeight - 3); ctx.lineTo(16, logicalHeight - 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(logicalWidth - 16, logicalHeight - 3); ctx.lineTo(logicalWidth - 3, logicalHeight - 3); ctx.lineTo(logicalWidth - 3, logicalHeight - 16); ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [rooms, occupants, hazards, connections, actions, predictiveTime]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* View mode selector */}
      <div style={{
        position: "absolute", top: "6px", right: "6px", zIndex: 100,
        display: "flex", background: "rgba(4,4,6,0.9)", border: "1px solid var(--border)",
        borderRadius: "4px", padding: "0.15rem"
      }}>
        {(["standard", "thermal", "confidence"] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "0.2rem 0.5rem", fontSize: "0.62rem", fontWeight: viewMode === mode ? "bold" : "normal",
              background: viewMode === mode ? "rgba(59,130,246,0.15)" : "transparent",
              color: viewMode === mode ? "#60a5fa" : "var(--text-dim)",
              border: "none", borderRadius: "3px", cursor: "pointer", textTransform: "uppercase"
            }}
          >
            {mode === "standard" ? "Standard" : mode === "thermal" ? "Thermal" : "Confidence"}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        style={{ width: "100%", height: "100%", display: "block", borderRadius: "6px" }}
      />
    </div>
  );
}

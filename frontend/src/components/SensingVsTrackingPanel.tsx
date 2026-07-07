import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Radio, ShieldCheck, Compass } from "lucide-react";
import type { RoomState, OccupantState } from "../types";

interface SensingVsTrackingPanelProps {
  rooms: RoomState[];
  occupants: OccupantState[];
}

export default function SensingVsTrackingPanel({ rooms, occupants }: SensingVsTrackingPanelProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>("Ward-3");
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Get occupants in the selected room
  const roomOccupants = occupants.filter(o => o.current_room === selectedRoomId);
  const selectedRoom = rooms.find(r => r.room_id === selectedRoomId);

  // Animate circular radar scanner
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    const dpr = window.devicePixelRatio || 1;
    const logicalW = 200;
    const logicalH = 200;
    
    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;
    ctx.scale(dpr, dpr);

    const centerX = logicalW / 2;
    const centerY = logicalH / 2;
    const radius = Math.min(centerX, centerY) - 8;

    const renderRadar = () => {
      // Background
      ctx.fillStyle = "#040406";
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Radar rings
      ctx.strokeStyle = "rgba(59, 130, 246, 0.12)";
      ctx.lineWidth = 1;
      for (let r = radius / 3; r <= radius; r += radius / 3) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();

      // Rotating sweep line
      angle = (angle + 0.03) % (Math.PI * 2);
      ctx.strokeStyle = "rgba(59, 130, 246, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
      ctx.stroke();

      // Draw targets
      roomOccupants.forEach((occ, idx) => {
        // Map local coordinates (typically 0-5m) to radar bounds
        const maxRange = 5.0; 
        const normX = ((occ.pos_x || (1.5 + idx)) / maxRange) * 2 - 1; 
        const normY = ((occ.pos_y || (1.5 + idx)) / maxRange) * 2 - 1; 

        const targetX = centerX + normX * radius * 0.8;
        const targetY = centerY + normY * radius * 0.8;

        let targetAngle = Math.atan2(targetY - centerY, targetX - centerX);
        if (targetAngle < 0) targetAngle += Math.PI * 2;

        let angleDiff = angle - targetAngle;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        let alpha = 0;
        if (angleDiff < Math.PI / 2) {
          alpha = 1.0 - (angleDiff / (Math.PI / 2)); 
        } else {
          alpha = 0.08; 
        }

        let dotColor = "16, 185, 129"; // Green (Civilian/Patient)
        if (occ.role === "nurse") dotColor = "59, 130, 246"; // Blue (Field Agent)
        if (occ.role === "visitor") dotColor = "245, 158, 11"; // Amber (Recon Drone)
        if (occ.role === "unknown") dotColor = "239, 68, 68"; // Red (Intruder)

        // Draw UKF Sigma Points
        if (occ.sigma_points && occ.sigma_points.length > 0) {
          ctx.fillStyle = `rgba(${dotColor}, ${alpha * 0.45})`;
          let maxDist = 0;
          occ.sigma_points.forEach(sp => {
            const spNormX = (sp[0] / maxRange) * 2 - 1;
            const spNormY = (sp[1] / maxRange) * 2 - 1;
            const spX = centerX + spNormX * radius * 0.8;
            const spY = centerY + spNormY * radius * 0.8;

            ctx.beginPath();
            ctx.arc(spX, spY, 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Connective multi-path vector lines
            ctx.strokeStyle = `rgba(${dotColor}, ${alpha * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(spX, spY);
            ctx.stroke();

            const d = Math.sqrt((spX - targetX)**2 + (spY - targetY)**2);
            if (d > maxDist) maxDist = d;
          });

          // Draw dynamic UKF covariance ellipse boundary
          ctx.strokeStyle = `rgba(${dotColor}, ${alpha * 0.25})`;
          ctx.lineWidth = 0.85;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.arc(targetX, targetY, Math.max(8, maxDist), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw main body centroid dot
        ctx.fillStyle = `rgba(${dotColor}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing outer ring
        if (alpha > 0.65) {
          ctx.strokeStyle = `rgba(${dotColor}, ${alpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(targetX, targetY, 9 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Labels
        if (alpha > 0.4) {
          ctx.fillStyle = `rgba(244, 244, 247, ${alpha})`;
          ctx.font = "bold 6.5px 'JetBrains Mono', monospace";
          ctx.fillText(occ.entity_id.toUpperCase(), targetX + 8, targetY - 2);
          ctx.fillStyle = `rgba(130, 130, 146, ${alpha})`;
          ctx.font = "5.5px 'JetBrains Mono', monospace";
          ctx.fillText(`H:${occ.pos_z.toFixed(1)}m`, targetX + 8, targetY + 5);
        }
      });

      animId = requestAnimationFrame(renderRadar);
    };

    renderRadar();

    return () => cancelAnimationFrame(animId);
  }, [roomOccupants]);

  // Derived CSI metrics for selected room
  const csiVariance = selectedRoom ? (selectedRoom.is_hazard ? 5.8 : (roomOccupants.length * 1.45 + 0.12)) : 0.15;
  const csiPhase = selectedRoom ? (selectedRoom.is_hazard ? 8.2 : (roomOccupants.length * 1.82 + 0.25)) : 0.28;
  const tempReading = selectedRoom?.temperature || 21.5;
  const avgBpm = roomOccupants.some(o => o.breathing_rate) 
    ? (roomOccupants.find(o => o.breathing_rate)?.breathing_rate || 16) 
    : 0;

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", margin: 0 }}>
          <Radio size={14} style={{ color: "var(--accent)" }} />
          <span>RF Sensing Profile & Signal Diagnostics</span>
        </h3>
        <span className="badge badge-blue" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <ShieldCheck size={10} />
          <span>Passive Tech</span>
        </span>
      </div>
      <p className="panel-subtitle">Continuous diagnostic audit of ambient Wi-Fi channel state reflections mapped to ground targets.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.25rem" }}>
        {/* Left Side: Room details, Comparison, Slider */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Comparison Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.03)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: "6px", padding: "0.7rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.3rem", color: "var(--green)" }}>
                <EyeOff size={12} />
                <strong style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>UKF Space Fusion (Device-Free)</strong>
              </div>
              <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Unscented Kalman Filter (UKF) processing of Wi-Fi CSI amplitude/phase using 13 propagated sigma points. Non-linear kinematics. 100% Anonymous.
              </p>
            </div>
            <div style={{ background: "rgba(59, 130, 246, 0.03)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: "6px", padding: "0.7rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.3rem", color: "var(--accent)" }}>
                <Eye size={12} />
                <strong style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Active GPS/IMSI Tracking</strong>
              </div>
              <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                IMSI catching or MAC sniffing. Discloses client identifiers and subscriber profiles. Requires active transmitter power.
              </p>
            </div>
          </div>

          {/* Interactive Room Scanner Selector & Stats */}
          <div style={{ background: "#040406", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.85rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase" }}>Focused Zone Scanner</span>
              <select 
                value={selectedRoomId} 
                onChange={e => setSelectedRoomId(e.target.value)} 
                style={{
                  padding: "0.25rem 0.5rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                  borderRadius: "4px", color: "#fff", fontSize: "0.7rem", outline: "none", cursor: "pointer"
                }}
              >
                {rooms.map(r => (
                  <option key={r.room_id} value={r.room_id}>
                    {r.room_id === "Kitchen" ? "Hangar Deck" : 
                     r.room_id === "ICU-1" ? "Recon Zone 1" :
                     r.room_id === "ICU-2" ? "Recon Zone 2" :
                     r.room_id === "Staff-Station" ? "Command Bridge" :
                     r.room_id === "Ward-3" ? "Storage Zone A" :
                     r.room_id === "Ward-4" ? "Storage Zone B" :
                     r.room_id === "Corridor" ? "Transit Corridor" :
                     r.room_id === "Exit-1" ? "Escape Port A" :
                     r.room_id === "Exit-2" ? "Escape Port B" : r.room_id}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.72rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>Tracked Bodies:</span>
                  <span style={{ color: "#fff", fontWeight: "bold" }}>{roomOccupants.length} units</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>CSI Amp Variance:</span>
                  <span style={{ fontFamily: "JetBrains Mono", color: "var(--accent)" }}>{csiVariance.toFixed(2)} dB²</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>CSI Phase Variance:</span>
                  <span style={{ fontFamily: "JetBrains Mono", color: "var(--accent)" }}>{csiPhase.toFixed(2)} rad²</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>Zone Heat Index:</span>
                  <span style={{ color: selectedRoom?.is_hazard ? "var(--red)" : "var(--amber)", fontWeight: "bold" }}>{tempReading.toFixed(1)}°C</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>Respiration Rate:</span>
                  <span style={{ fontFamily: "JetBrains Mono", color: "var(--green)" }}>{avgBpm > 0 ? `${avgBpm.toFixed(1)} BPM` : "SCANNING..."}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>Multipath Loss:</span>
                  <span style={{ fontFamily: "JetBrains Mono", color: "#fff" }}>-{(csiVariance * 2 + 10.4).toFixed(1)} dB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Radar Visualizer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            position: "relative",
            width: "202px",
            height: "202px",
            borderRadius: "50%",
            border: "1.5px solid var(--border)",
            background: "#040406",
            overflow: "hidden",
            boxShadow: "0 0 15px rgba(59,130,246,0.08)"
          }}>
            <canvas ref={radarCanvasRef} style={{ width: "200px", height: "200px", display: "block" }} />
            
            {/* Overlay compass markings */}
            <div style={{ position: "absolute", top: "4px", left: "50%", transform: "translateX(-50%)", fontSize: "5.5px", fontFamily: "JetBrains Mono", color: "rgba(59,130,246,0.3)" }}>N</div>
            <div style={{ position: "absolute", bottom: "4px", left: "50%", transform: "translateX(-50%)", fontSize: "5.5px", fontFamily: "JetBrains Mono", color: "rgba(59,130,246,0.3)" }}>S</div>
            <div style={{ position: "absolute", left: "4px", top: "50%", transform: "translateY(-50%)", fontSize: "5.5px", fontFamily: "JetBrains Mono", color: "rgba(59,130,246,0.3)" }}>W</div>
            <div style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", fontSize: "5.5px", fontFamily: "JetBrains Mono", color: "rgba(59,130,246,0.3)" }}>E</div>
            
            {/* Center crosshair center dot */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "4px", height: "4px", borderRadius: "50%", background: "var(--accent)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.62rem", color: "var(--text-muted)", marginTop: "0.6rem", fontFamily: "JetBrains Mono, monospace" }}>
            <Compass size={11} className="pulse-icon" />
            <span>UKF SIGMA CENTROID & COVARIANCE ENVELOPE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

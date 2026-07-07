import { useEffect, useRef, useState } from "react";
import { Activity, Shield, BarChart3, Waves, Radio } from "lucide-react";
import type { OccupantState, RoomState } from "../types";

interface TelemetryFeedProps {
  occupants: OccupantState[];
  rooms: RoomState[];
  simTime: string;
  step: number;
}

type ViewMode = "waveform" | "spectrum" | "waterfall";

export default function TelemetryFeed({ occupants, rooms, simTime, step }: TelemetryFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("waveform");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    // Retina/High-DPI backing scale helper
    const dpr = window.devicePixelRatio || 1;
    let logicalW = 540;
    let logicalH = viewMode === "waterfall" ? 180 : 160;

    const resizeCanvas = () => {
      const parentW = canvas.parentElement?.clientWidth;
      logicalW = parentW ? parentW - 2 : 540;
      logicalH = viewMode === "waterfall" ? 180 : 160;
      
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
      ctx.scale(dpr, dpr);
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const activeThreats = rooms.some(r => r.is_hazard) || occupants.some(o => o.posture === "fallen");
    const occupantCount = occupants.length;

    const render = () => {
      phase += 0.045;

      if (viewMode === "waveform") {
        renderWaveform(ctx, logicalW, logicalH, phase, activeThreats, occupantCount);
      } else if (viewMode === "spectrum") {
        renderSpectrum(ctx, logicalW, logicalH, phase, activeThreats, occupantCount);
      } else {
        renderWaterfall(ctx, logicalW, logicalH, phase, activeThreats);
      }

      // High-contrast, sharp HUD overlay
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.fillText(`RF CENTER: 5.825 GHz  |  BW: 160 MHz  |  MIMO: 4×4`, 10, 16);
      ctx.fillText(`SUBCARRIERS: 64/64  |  SWEEP: ${step}  |  STREAM: ${simTime}`, 10, 28);

      ctx.fillStyle = activeThreats ? "#ef4444" : "#10b981";
      ctx.fillText(`SHIELD: ${activeThreats ? "⚠ PERTURBATION" : "✓ NOMINAL"}`, logicalW - 130, 16);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.fillText(`GAIN: +${(24 + Math.sin(phase) * 2).toFixed(1)} dB`, logicalW - 130, 28);
      ctx.fillText(`ASSETS: ${occupantCount}`, logicalW - 130, 40);

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [rooms, occupants, viewMode, step, simTime]);

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Activity size={15} style={{ color: "var(--accent)" }} />
          <span>RF Radiation & Wave Telemetry</span>
        </h3>
        <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
          {/* View mode toggles */}
          {([
            { mode: "waveform" as ViewMode, icon: <Waves size={9} />, label: "CSI Waves" },
            { mode: "spectrum" as ViewMode, icon: <BarChart3 size={9} />, label: "Spectrum" },
            { mode: "waterfall" as ViewMode, icon: <Radio size={9} />, label: "Waterfall" },
          ]).map(v => (
            <button
              key={v.mode}
              onClick={() => setViewMode(v.mode)}
              style={{
                padding: "0.18rem 0.4rem",
                fontSize: "0.56rem",
                fontWeight: viewMode === v.mode ? "bold" : "normal",
                background: viewMode === v.mode ? "rgba(37,99,235,0.2)" : "transparent",
                border: `1px solid ${viewMode === v.mode ? "var(--accent)" : "var(--border-subtle)"}`,
                borderRadius: 3,
                color: viewMode === v.mode ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: "0.15rem",
                textTransform: "uppercase",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              {v.icon} {v.label}
            </button>
          ))}
          <span className="badge badge-green" style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginLeft: "0.3rem" }}>
            <Shield size={10} />
            <span>Camera-Free</span>
          </span>
        </div>
      </div>

      {/* Band indicators */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
        {[
          { band: "2.4 GHz", status: "ACTIVE", color: "#10b981" },
          { band: "5 GHz", status: "PRIMARY", color: "#3b82f6" },
          { band: "60 GHz mmW", status: "SCANNING", color: "#f59e0b" },
          { band: "BLE 2.402", status: "BEACON", color: "#8b5cf6" },
        ].map(b => (
          <div key={b.band} style={{
            display: "flex", alignItems: "center", gap: "0.25rem",
            fontSize: "0.58rem", color: "var(--text-muted)",
            fontFamily: "JetBrains Mono, monospace",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: b.color, boxShadow: `0 0 6px ${b.color}` }} />
            <span>{b.band}</span>
            <span style={{ color: b.color, fontSize: "0.5rem", fontWeight: "bold" }}>{b.status}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "#030305", borderRadius: 6, border: "1px solid var(--border)", padding: "1px", overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ display: "block", background: "#030305", borderRadius: 5 }} />
      </div>

      {/* Bottom stats row */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
        {[
          { label: "Noise Floor", value: "-92 dBm", color: "var(--green)" },
          { label: "Channel Load", value: `${Math.min(95, 35 + step % 30)}%`, color: "var(--amber)" },
          { label: "Packet Error Rate", value: `${(0.012 + Math.random() * 0.015).toFixed(3)}%`, color: "var(--text-muted)" },
          { label: "Doppler Shift", value: `${(Math.random() * 0.6 - 0.3).toFixed(2)} Hz`, color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1,
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 5, padding: "0.3rem 0.4rem",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>{s.label}</div>
            <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: s.color, fontFamily: "JetBrains Mono, monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Waveform View ───
function renderWaveform(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number, activeThreats: boolean, occupantCount: number) {
  ctx.fillStyle = "rgba(3, 3, 5, 0.25)";
  ctx.fillRect(0, 0, width, height);

  const centerY = height / 2;

  // Grid
  ctx.strokeStyle = "rgba(59, 130, 246, 0.05)";
  ctx.lineWidth = 0.5;
  for (let y = 30; y < height; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  for (let x = 0; x < width; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }

  const waveLayers = [
    { amp: activeThreats ? 36 : 22, freq: 0.012, speed: 0.03, color: "rgba(16, 185, 129, 0.6)" },
    { amp: activeThreats ? 26 : 14, freq: 0.024, speed: 0.05, color: "rgba(59, 130, 246, 0.5)" },
    { amp: activeThreats ? 18 : 9,  freq: 0.042, speed: 0.07, color: "rgba(245, 158, 11, 0.4)" },
    { amp: activeThreats ? 10 : 5,  freq: 0.060, speed: 0.09, color: "rgba(139, 92, 246, 0.3)" },
  ];

  waveLayers.forEach((wave, idx) => {
    ctx.strokeStyle = wave.color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const wavePhase = phase * wave.speed * 45;
      const mod = 1 + 0.35 * Math.sin(x * 0.0035 * (occupantCount + 1) + phase * 0.4);
      const y = centerY + Math.sin(x * wave.freq + wavePhase) * wave.amp * mod * Math.sin(x * 0.004 + idx);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  const cursorX = (phase * 90) % width;
  ctx.strokeStyle = "rgba(59, 130, 246, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cursorX, 0); ctx.lineTo(cursorX, height); ctx.stroke();
}

// ─── Spectrum View ───
function renderSpectrum(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number, activeThreats: boolean, _occupantCount: number) {
  ctx.fillStyle = "rgba(3, 3, 5, 0.35)";
  ctx.fillRect(0, 0, width, height);

  const barCount = 64;
  const padding = 15;
  const barWidth = (width - padding * 2) / barCount;
  const maxH = height - 60;

  // Grid
  ctx.strokeStyle = "rgba(59, 130, 246, 0.04)";
  ctx.lineWidth = 0.5;
  for (let y = 40; y < height - 20; y += 30) {
    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "6.5px 'JetBrains Mono', monospace";
    ctx.fillText(`${-30 - Math.floor((y - 40) / 30) * 10} dBm`, width - 50, y + 2.5);
  }

  // Draw bars
  for (let i = 0; i < barCount; i++) {
    const baseH = 0.3 + 0.5 * Math.sin(i * 0.16 + phase * 0.35) + 0.2 * Math.cos(i * 0.08 + phase * 0.65);
    const threat = activeThreats ? 0.32 * Math.sin(i * 0.45 + phase * 2.2) : 0;
    const h = Math.max(5, Math.min(maxH, (baseH + threat) * maxH * 0.65));

    const x = padding + i * barWidth;
    const y = height - 16 - h;

    const ratio = h / maxH;
    let r = 16, g = 185, b = 129;
    if (ratio > 0.6) { r = 245; g = 158; b = 11; }
    if (ratio > 0.8) { r = 239; g = 68; b = 68; }

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.75)`;
    ctx.fillRect(x, y, barWidth - 1, h);

    // Peak holds
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`;
    ctx.fillRect(x, y - 2, barWidth - 1, 1.25);
  }
}

// ─── Waterfall View ───
function renderWaterfall(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number, activeThreats: boolean) {
  const existing = ctx.getImageData(0, 0, width, height - 1);
  ctx.putImageData(existing, 0, 1);

  for (let x = 0; x < width; x++) {
    const freq = x / width;
    const intensity =
      0.18 +
      0.32 * Math.sin(freq * 14 + phase * 2) +
      0.18 * Math.cos(freq * 22 + phase * 3.2) +
      0.08 * Math.sin(freq * 42 + phase * 5.4) +
      (activeThreats ? 0.24 * Math.sin(freq * 9 + phase * 6.5) : 0);

    const clampedI = Math.max(0, Math.min(1, intensity));

    let r: number, g: number, b: number;
    if (clampedI < 0.33) {
      const t = clampedI / 0.33;
      r = 0; g = Math.floor(t * 85); b = Math.floor(45 + t * 145);
    } else if (clampedI < 0.66) {
      const t = (clampedI - 0.33) / 0.33;
      r = Math.floor(t * 65); g = Math.floor(85 + t * 115); b = Math.floor(190 - t * 95);
    } else {
      const t = (clampedI - 0.66) / 0.34;
      r = Math.floor(65 + t * 190); g = Math.floor(200 - t * 85); b = Math.floor(95 - t * 95);
    }

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x, 0, 1, 1);
  }
}

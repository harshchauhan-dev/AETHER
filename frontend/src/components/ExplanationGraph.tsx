import { Share2 } from "lucide-react";
import type { HospitalState } from "../types";

interface ExplanationGraphProps {
  state: HospitalState | null;
}

export default function ExplanationGraph({ state }: ExplanationGraphProps) {
  if (!state) return null;

  const isFallen = state.occupants.some(o => o.posture === "fallen");
  const hasFire = state.rooms.some(r => r.is_hazard);

  // Define nodes based on active hazards
  const getCausalNodes = () => {
    if (isFallen) {
      return [
        { label: "RF Wave Shift", val: "CSI Subcarriers Flatline", status: "active", desc: "160MHz Multipath Signal" },
        { label: "mmWave Altitude", val: "Centroid Z-coord <0.15m", status: "active", desc: "Spatial Radar Scanner" },
        { label: "Vital Diagnostics", val: "Bradypnea Alert: 8 BPM", status: "warning", desc: "Passive Vital Extraction" },
        { label: "Safeguard Command", val: "RESCUER DISPATCHED", status: "critical", desc: "Consensus Emergency Action" }
      ];
    }
    if (hasFire) {
      return [
        { label: "Thermal Sensor", val: "Temp exceeds 45.0°C", status: "active", desc: "Thermal Scanner Array" },
        { label: "Particulate Probe", val: "Smoke level >180 PPM", status: "active", desc: "Sensing Attenuation Index" },
        { label: "Cost-Map Solver", val: "Evac Path Obstruction", status: "warning", desc: "Pathfinder Path Solver" },
        { label: "Safeguard Command", val: "QUARANTINE & REROUTING", status: "critical", desc: "Consensus Hazard Mitigation" }
      ];
    }
    return [
      { label: "Subcarrier Sweep", val: "Amplitude Sweep Nominal", status: "secure", desc: "Ambient 160MHz CSI Waves" },
      { label: "Postural Index", val: "Centroids match baseline", status: "secure", desc: "mmWave Spatial Radar" },
      { label: "Identity Whitelist", val: "Whitelisted MAC/IMSI Check", status: "secure", desc: "Security Credentials Pass" },
      { label: "System Posture", val: "AETHER SECURE & STANDBY", status: "secure", desc: "Nominal Operations" }
    ];
  };

  const nodes = getCausalNodes();

  // Color mappings
  const getColor = (status: string) => {
    if (status === "critical") return "var(--red)";
    if (status === "warning") return "var(--amber)";
    if (status === "secure") return "var(--green)";
    return "var(--accent)";
  };

  const getBg = (status: string) => {
    if (status === "critical") return "rgba(239, 68, 68, 0.04)";
    if (status === "warning") return "rgba(245, 158, 11, 0.04)";
    if (status === "secure") return "rgba(16, 185, 129, 0.04)";
    return "rgba(59, 130, 246, 0.04)";
  };

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <style>{`
        @keyframes causal-flow {
          to {
            stroke-dashoffset: -20;
          }
        }
        .flow-line {
          stroke-dasharray: 6, 4;
          animation: causal-flow 1.2s linear infinite;
        }
        @keyframes node-pulse {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.08); }
        }
        .pulse-halo {
          transform-origin: center;
          animation: node-pulse 2s infinite ease-in-out;
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", margin: 0 }}>
          <Share2 size={14} style={{ color: "var(--accent)" }} />
          <span>Causal Artificial Reasoning Explanation Flow</span>
        </h3>
        <span className="badge badge-green" style={{ textTransform: "uppercase" }}>Visual Logic Chain</span>
      </div>
      <p className="panel-subtitle">Real-time explainable AI pipeline illustrating causal inference propagation from raw radio signals to safety action dispatch.</p>

      {/* SVG Canvas Flowchart */}
      <div style={{ background: "#040406", border: "1px solid var(--border)", borderRadius: "6px", overflowX: "auto", padding: "1.25rem 0.5rem" }}>
        <svg width="600" height="96" viewBox="0 0 600 96" style={{ display: "block", margin: "0 auto", overflow: "visible" }}>
          <defs>
            {/* Arrow Markers for each state color */}
            {["accent", "green", "amber", "red"].map(color => (
              <marker
                key={color}
                id={`arrow-${color}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={`var(--${color === "accent" ? "blue-500" : color})` || "var(--accent)"} />
              </marker>
            ))}
          </defs>

          {/* Render Flow Connections */}
          {nodes.map((node, idx) => {
            if (idx === nodes.length - 1) return null;
            const nextNode = nodes[idx + 1];
            const startX = 65 + idx * 150 + 65; // Right edge of rect
            const endX = 65 + (idx + 1) * 150 - 65; // Left edge of rect
            const color = getColor(nextNode.status);
            
            return (
              <g key={`link-${idx}`}>
                {/* Background shadow line */}
                <line 
                  x1={startX} y1="48" x2={endX} y2="48" 
                  stroke="rgba(255,255,255,0.03)" strokeWidth="3" 
                />
                {/* Animated dash flow line */}
                <line 
                  x1={startX} y1="48" x2={endX} y2="48" 
                  stroke={color} strokeWidth="1.5"
                  className="flow-line"
                  style={{
                    opacity: node.status === "secure" && nextNode.status === "secure" ? 0.35 : 0.85
                  }}
                />
                {/* Floating flow node center indicators */}
                <circle cx={(startX + endX) / 2} cy="48" r="3" fill={color} />
              </g>
            );
          })}

          {/* Render Flow Nodes */}
          {nodes.map((node, idx) => {
            const cx = 65 + idx * 150;
            const cy = 48;
            const w = 124;
            const h = 58;
            const rx = cx - w / 2;
            const ry = cy - h / 2;
            const color = getColor(node.status);
            const bg = getBg(node.status);

            return (
              <g key={`node-${idx}`}>
                {/* Pulsing halo around active/warning/critical nodes */}
                {node.status !== "secure" && (
                  <rect 
                    x={rx - 4} y={ry - 4} width={w + 8} height={h + 8} rx="10"
                    fill="none" stroke={color} strokeWidth="1"
                    className="pulse-halo"
                    style={{
                      transformOrigin: `${cx}px ${cy}px`,
                      opacity: 0.15
                    }}
                  />
                )}

                {/* Node Box */}
                <rect 
                  x={rx} y={ry} width={w} height={h} rx="8"
                  fill={bg} stroke={color} strokeWidth={node.status !== "secure" ? 1.5 : 1}
                  style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.5))" }}
                />

                {/* Header Badge Line */}
                <line x1={rx} y1={ry + 18} x2={rx + w} y2={ry + 18} stroke={color} strokeWidth="0.5" strokeOpacity="0.2" />

                {/* Node Title */}
                <text 
                  x={cx} y={ry + 12} 
                  fill={color} 
                  fontSize="7" 
                  fontWeight="bold" 
                  textAnchor="middle"
                  letterSpacing="0.05em"
                >
                  {node.label.toUpperCase()}
                </text>

                {/* Subtitle Description */}
                <text 
                  x={cx} y={ry + 28} 
                  fill="rgba(255,255,255,0.4)" 
                  fontSize="5.5" 
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {node.desc}
                </text>

                {/* Node Value text */}
                <text 
                  x={cx} y={ry + 44} 
                  fill="#fff" 
                  fontSize="7.5" 
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {node.val}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

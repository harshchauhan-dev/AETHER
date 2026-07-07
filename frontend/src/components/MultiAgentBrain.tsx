import { Brain, ShieldCheck, HeartPulse, Compass, Radio, Terminal } from "lucide-react";
import type { HospitalState } from "../types";

interface MultiAgentBrainProps {
  state: HospitalState | null;
}

export default function MultiAgentBrain({ state }: MultiAgentBrainProps) {
  if (!state) {
    return (
      <div className="empty-state" style={{ padding: "3rem" }}>
        No active satellite link. Initialize telemetry streams to activate the Multi-Agent AI Brain.
      </div>
    );
  }

  // Determine threat states
  const isFallen = state.occupants.some(o => o.posture === "fallen");
  const hasFire = state.rooms.some(r => r.is_hazard);
  const activeAction = state.actions[0];
  const step = state.step;

  // Calculate sliding weights dynamically
  const getWeight = (base: number, salt: number) => {
    const variance = Math.sin(step * 0.4 + salt) * 1.5 + (Math.random() * 0.5 - 0.25);
    return Math.min(100, Math.max(70, base + (isFallen || hasFire ? 4.0 : 0) + variance)).toFixed(1);
  };

  // Dialogue stream simulator
  const getDialogueFeed = () => {
    const logs: { sender: string; text: string; color: string }[] = [];
    if (isFallen) {
      logs.push({ sender: "SENSOR AI", text: "CSI wave flatline registered at ICU-1. Z-coordinate drops below threshold (0.12m).", color: "var(--accent)" });
      logs.push({ sender: "MEDICAL AI", text: "Vital tracker lock complete: Respiration drops to 8 BPM (Bradypnea). Elevated risk.", color: "var(--red)" });
      logs.push({ sender: "SECURITY AI", text: "Subscriber whitelist check: TAG-PATIENT_1 matches civilian VIP protocol.", color: "var(--green)" });
      logs.push({ sender: "NAVIGATION AI", text: "Path finding resolved. Exit corridor check: CLEAR. Dispatching responder Bob.", color: "var(--amber)" });
      logs.push({ sender: "COMMANDER AI", text: "Consensus weight reached (98.4%). Dispatch order issued for rescue rotation.", color: "#a78bfa" });
    } else if (hasFire) {
      logs.push({ sender: "SENSOR AI", text: "Thermal attenuation registered in Storage Zone A. Amplitude phase shift active.", color: "var(--accent)" });
      logs.push({ sender: "MEDICAL AI", text: "Toxicity PPM threshold exceeded. Carbon monoxide projection: >180 PPM (Critical).", color: "var(--red)" });
      logs.push({ sender: "SECURITY AI", text: "Initiating perimeter quarantine. AES-256 cryptographic keys rotated.", color: "var(--green)" });
      if (activeAction && activeAction.route) {
        logs.push({ sender: "NAVIGATION AI", text: `Command Bridge BLOCKED. Rerouting civilians to Exit-2 via: ${activeAction.route.join(" ➔ ")}.`, color: "var(--amber)" });
      } else {
        logs.push({ sender: "NAVIGATION AI", text: "Preemptive cost-map solver alerts: Alternate escape route checks underway.", color: "var(--amber)" });
      }
      logs.push({ sender: "COMMANDER AI", text: "Consensus weights verified (97.1%). Deploying sector lock and emergency warning.", color: "#a78bfa" });
    } else {
      logs.push({ sender: "SENSOR AI", text: "Sweep #"+step+": Ambient RF subcarrier amplitude sweep nominal. Coherence: 94.6%.", color: "var(--accent)" });
      logs.push({ sender: "SECURITY AI", text: "Device signatures matched against whitelist. 0 active MAC/IMSI anomalies.", color: "var(--green)" });
      logs.push({ sender: "MEDICAL AI", text: "No chest wall displacement alarms. Occupants respiration rate nominal (14-18 BPM).", color: "var(--red)" });
      logs.push({ sender: "NAVIGATION AI", text: "Preemptive exit routes mapped. Cost-maps updated at 1Hz based on ambient flow density.", color: "var(--amber)" });
      logs.push({ sender: "COMMANDER AI", text: "Cognitive loop stable. All metrics balanced. Standing by in monitoring posture.", color: "#a78bfa" });
    }
    return logs;
  };

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", margin: 0 }}>
          <Brain size={15} style={{ color: "var(--accent)" }} />
          <span>Multi-Agent AI Reasoning & Consensus Core</span>
        </h3>
        <span className="badge badge-blue">COLLABORATIVE BRAIN</span>
      </div>
      <p className="panel-subtitle">Specialized AI agents weighting evidence and coordinating to build spatial ground-truth decisions.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr", gap: "1.25rem", marginTop: "1rem" }}>
        {/* Left Col: Weights & Confidence Matrix */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", background: "#040406", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.85rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.25rem" }}>
            Cognitive Weights & Trust Allocation
          </div>
          
          {[
            { name: "SENSOR AI", icon: <Radio size={12} />, weight: getWeight(93, 1), color: "var(--accent)" },
            { name: "SECURITY AI", icon: <ShieldCheck size={12} />, weight: getWeight(95, 2), color: "var(--green)" },
            { name: "MEDICAL AI", icon: <HeartPulse size={12} />, weight: getWeight(90, 3), color: "var(--red)" },
            { name: "NAVIGATION AI", icon: <Compass size={12} />, weight: getWeight(92, 4), color: "var(--amber)" },
            { name: "COMMANDER AI", icon: <Brain size={12} />, weight: getWeight(97, 5), color: "#a78bfa" },
          ].map(agent => (
            <div key={agent.name} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: agent.color, fontWeight: "bold" }}>
                  {agent.icon}
                  <span>{agent.name}</span>
                </span>
                <span style={{ fontFamily: "JetBrains Mono", color: "#fff", fontWeight: "bold" }}>{agent.weight}%</span>
              </div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ 
                  width: `${agent.weight}%`, 
                  height: "100%", 
                  background: agent.color, 
                  borderRadius: "3px", 
                  boxShadow: `0 0 8px ${agent.color}`,
                  transition: "width 0.5s ease" 
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Right Col: Rolling Dialogue Console */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase" }}>
            <Terminal size={12} />
            <span>AI COLLABORATIVE LOG & CONSENSUS DISCUSSIONS</span>
          </div>

          <div style={{
            flex: 1,
            background: "#040406",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "0.6rem",
            maxHeight: "180px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.65rem",
            lineHeight: 1.45
          }}>
            {getDialogueFeed().map((log, idx) => (
              <div key={idx} style={{ 
                borderBottom: idx < 4 ? "0.5px dashed rgba(255,255,255,0.03)" : "none",
                paddingBottom: "0.4rem"
              }}>
                <span style={{ color: log.color, fontWeight: "bold" }}>[{log.sender}]</span>:{" "}
                <span style={{ color: "rgba(255,255,255,0.85)" }}>{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

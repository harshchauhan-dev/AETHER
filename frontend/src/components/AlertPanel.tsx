import type { Alert, Prediction, ActionRecommendation } from "../types";
import { ShieldAlert, Sparkles, MapPin, Navigation, BrainCircuit } from "lucide-react";

interface AlertPanelProps {
  alerts: Alert[];
  predictions: Prediction[];
  actions: ActionRecommendation[];
}

export default function AlertPanel({ alerts, predictions, actions }: AlertPanelProps) {
  // Generate mock AI explainability reasons based on alert type
  const getExplainWhyReasons = (alert: Alert) => {
    const reasons: string[] = [];
    const type = alert.type.toLowerCase();
    
    if (type.includes("fall") || type.includes("motionless")) {
      reasons.push("CSI multipath phase amplitude flatline (0.3% baseline variance)");
      reasons.push("mmWave altitude coordinate dropped to ground plane (~0.12m)");
      reasons.push("Unusual stillness index exceeds 12-second trigger limit");
    } else if (type.includes("fire") || type.includes("smoke") || type.includes("heat")) {
      reasons.push("Thermal sensor exceeds critical threshold (>45°C)");
      reasons.push("Environmental particulate count spike (>150 PPM)");
      reasons.push("Rate-of-rise thermal vector is compounding");
    } else {
      reasons.push("Anomalous RF wave reflection amplitude shift detected");
      reasons.push("Restricted sector perimeter breached");
    }
    return reasons;
  };

  // Generate stable mock confidence score
  const getConfidenceScore = (seed: string, offset: number) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const score = 88.5 + (Math.abs(hash) % 110) * 0.1 + (offset % 5) * 0.1;
    return Math.min(99.9, score).toFixed(1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* 🔮 Top Level: AETHER AI Reasoning HUD card */}
      <div className="panel-card" style={{
        background: "rgba(59, 130, 246, 0.03)",
        border: "1px solid rgba(59, 130, 246, 0.25)",
        boxShadow: "0 0 10px rgba(59,130,246,0.08)",
        marginBottom: 0
      }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--accent)" }}>
          <BrainCircuit size={15} />
          <span>AETHER AI REASONER</span>
        </h3>
        <p className="panel-subtitle">Layer 4 Continuous Cognitive Inference Engine</p>
        
        {alerts.length > 0 ? (
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.85)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--red)", fontWeight: "bold" }}>
              <span className="pulse-icon">●</span>
              <span>ANOMALOUS ACTIVITY IDENTIFIED</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "0.35rem 0", color: "var(--text-muted)", fontSize: "0.7rem" }}>
              <span>Target Entity:</span>
              <span style={{ color: "#fff", fontWeight: "bold" }}>
                {alerts[0].entity_id ? alerts[0].entity_id.toUpperCase() : "UNIDENTIFIED RF SIGNATURE"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "0.35rem 0", color: "var(--text-muted)", fontSize: "0.7rem" }}>
              <span>Predicted Destination:</span>
              <span style={{ color: "var(--accent)", fontWeight: "bold" }}>TRANSIT CORRIDOR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.7rem" }}>
              <span>Recommended Action:</span>
              <span style={{ color: "var(--green)", fontWeight: "bold" }}>DEPLOY EMERGENCY ROUTING</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
            ✓ Monitoring all spatial subcarrier coordinates. Scanning 160MHz bandwidth. No anomalies logged.
          </div>
        )}
      </div>

      {/* 🔴 Active Emergencies (with confidence + explainability) */}
      <div className="panel-card" style={{ marginBottom: 0 }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <ShieldAlert size={15} style={{ color: alerts.length > 0 ? "var(--red)" : "var(--green)" }} />
          <span>Active Emergencies</span>
        </h3>
        <p className="panel-subtitle">Current real-time anomalies and occupant incidents</p>

        <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.50rem" }}>
          {alerts.length === 0 ? (
            <div className="empty-state">No active emergencies detected. All zones secure.</div>
          ) : (
            alerts.map((alert, i) => {
              const severityClass = alert.severity === "critical" ? "alert-critical" : "alert-warning";
              const confidence = getConfidenceScore(alert.type + alert.room_id, i);
              const explainWhy = getExplainWhyReasons(alert);

              return (
                <div key={i} className={`alert-item ${severityClass}`} style={{ margin: 0 }}>
                  <div className="alert-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{alert.type.replace("_", " ").toUpperCase()}</span>
                    <span style={{ fontSize: "0.62rem", color: alert.severity === "critical" ? "#ff8888" : "var(--amber)", fontWeight: "bold" }}>
                      {confidence}% CONFIDENCE
                    </span>
                  </div>
                  <div style={{ fontWeight: "500", marginTop: "0.15rem" }}>{alert.message}</div>
                  
                  {/* EXPLAIN WHY Section */}
                  <div style={{
                    marginTop: "0.45rem",
                    borderTop: "0.5px dashed rgba(255,255,255,0.08)",
                    paddingTop: "0.35rem",
                    fontSize: "0.65rem",
                    color: "rgba(255,255,255,0.65)"
                  }}>
                    <div style={{ fontWeight: "bold", fontSize: "0.58rem", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                      Inference Rationale:
                    </div>
                    {explainWhy.map((reason, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "0.25rem", margin: "0.15rem 0" }}>
                        <span style={{ color: "var(--accent)" }}>▸</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <MapPin size={9} />
                    <span>Location: {alert.room_id}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ⚡ Predictive Risks (with confidence) */}
      <div className="panel-card" style={{ marginBottom: 0 }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Sparkles size={15} style={{ color: "var(--amber)" }} />
          <span>Predictive Risks</span>
        </h3>
        <p className="panel-subtitle">Proactive threat probability vectors</p>

        <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {predictions.length === 0 ? (
            <div className="empty-state">No elevated risk profiles generated.</div>
          ) : (
            predictions.map((p, i) => {
              const confidence = (p.probability * 100).toFixed(1);
              return (
                <div key={i} className="alert-item alert-info" style={{ borderLeftColor: "var(--amber)", margin: 0 }}>
                  <div className="alert-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{p.alert_type.replace("_", " ").toUpperCase()}</span>
                    <span>{confidence}% RISK</span>
                  </div>
                  <div>{p.description}</div>
                  <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <MapPin size={9} />
                    <span>Target Zone: {p.room_id}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🚨 Decision Engine Actions */}
      <div className="panel-card" style={{ marginBottom: 0 }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Navigation size={15} style={{ color: "var(--accent)" }} />
          <span>Dispatch & Escape Rotations</span>
        </h3>
        <p className="panel-subtitle">Real-time response recommendations and exit vectors</p>

        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
          {actions.length === 0 ? (
            <div className="empty-state">System standby. No dispatch actions required.</div>
          ) : (
            actions.map((act, i) => (
              <div key={i} className="action-item">
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "0.78rem" }}>
                  <span style={{ color: act.severity === "critical" ? "var(--red)" : "var(--accent)" }}>
                    {act.action_type.replace("_", " ").toUpperCase()}
                  </span>
                  <span className={`badge ${act.severity === "critical" ? "badge-red" : "badge-blue"}`}>
                    {act.severity}
                  </span>
                </div>
                <div style={{ marginTop: "0.2rem", color: "var(--text)" }}>{act.description}</div>
                {act.assigned_responder_id && (
                  <div style={{ fontSize: "0.7rem", color: "var(--green)", marginTop: "0.25rem" }}>
                    Assigned Unit: <strong>{act.assigned_responder_id.toUpperCase()}</strong>
                  </div>
                )}
                {act.route && (
                  <div className="action-route">
                    Path Vector: {act.route.join(" → ")}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🤖 Idea 6: AETHER AI Self-Critique & Introspection */}
      <div className="panel-card" style={{
        background: "rgba(245, 158, 11, 0.02)",
        border: "1px solid rgba(245, 158, 11, 0.15)",
        marginBottom: 0
      }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--amber)" }}>
          <BrainCircuit size={15} />
          <span>AI Self-Critique & Error Bounds</span>
        </h3>
        <p className="panel-subtitle">Self-diagnosing predictive error probabilities & sensor limitations</p>

        <div style={{ fontSize: "0.68rem", display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.45rem" }}>
          {alerts.length > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.06)", paddingBottom: "0.2rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Signal Reflection Probability:</span>
                <span style={{ fontFamily: "JetBrains Mono", color: "var(--amber)" }}>12% (Medium Interference)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.06)", paddingBottom: "0.2rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Furniture/Obstacle Drift:</span>
                <span style={{ fontFamily: "JetBrains Mono" }}>±1.4 dB amplitude skew</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.06)", paddingBottom: "0.2rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Active RF Margin:</span>
                <span style={{ fontFamily: "JetBrains Mono", color: "var(--green)" }}>±3.2 dB (Nominal bounds)</span>
              </div>
              <div style={{ color: "rgba(255, 255, 255, 0.68)", fontStyle: "italic", fontSize: "0.62rem" }}>
                *Introspection feedback: High confidence on VIP fall; 12% probability anomaly could stem from multipath corridor fade.
              </div>
            </>
          ) : (
            <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
              ✓ Baseline noise floor at -94 dBm. Sensor uncertainty is within 0.8% threshold. Introspection scan nominal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { X, Search, ShieldAlert, Cpu, Thermometer, User, Wifi, Lock } from "lucide-react";
import type { OccupantState, RoomState, Alert, Prediction } from "../types";

interface KpiDetailsPanelProps {
  activeTab: "assets" | "threats" | "temperature" | "prediction" | null;
  onClose: () => void;
  occupants: OccupantState[];
  rooms: RoomState[];
  alerts: Alert[];
  predictions: Prediction[];
  sectorName: string;
}

export default function KpiDetailsPanel({
  activeTab,
  onClose,
  occupants,
  rooms,
  alerts,
  predictions,
  sectorName,
}: KpiDetailsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  if (!activeTab) return null;

  // Mock SIM / Device specifications for details mapping
  const getDeviceSpecs = (id: string) => {
    const hash = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
    const carriers = ["Reliance Jio Space Link", "Bharti Airtel UWB", "AETHER Local Mesh", "Starlink Orbit Relay"];
    const deviceTypes = ["iPhone 15 Pro (Dual-SIM)", "Samsung Galaxy S24 Ultra", "Recon UAV Controller", "Command Unit Hub"];
    const signalStrength = -55 - (hash % 25); // -55 to -80 dBm
    const imsi = `404-45-${100000 + (hash * 382) % 899999}`;
    
    // Determine network openness
    let networkMode = "SECURED (WPA3-SAE)";
    let openAlert = false;
    if (id.includes("civilian_1") || id.includes("1")) {
      networkMode = "OPEN AP CONNECTED (Vulnerable)";
      openAlert = true;
    } else if (id.includes("drone") || id.includes("visitor")) {
      networkMode = "SECURED (AES-256-GCM)";
    }
    
    return {
      carrier: carriers[hash % carriers.length],
      device: deviceTypes[hash % deviceTypes.length],
      signal: signalStrength,
      imsi,
      networkMode,
      openAlert
    };
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === "patient") return "badge-blue"; // Civilian
    if (role === "nurse") return "badge-green";   // Field Agent
    return "badge-amber";                        // Drone
  };

  const getRoleLabel = (role: string) => {
    if (role === "patient") return "Civilian VIP";
    if (role === "nurse") return "Field Agent";
    return "Recon Drone";
  };

  const filteredOccupants = occupants.filter(o => {
    const specs = getDeviceSpecs(o.entity_id);
    const matchesSearch = o.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      specs.carrier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      specs.device.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.current_room.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === "all" || o.role === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="panel-card" style={{
      border: "1px solid var(--accent)",
      boxShadow: "0 0 15px rgba(59, 130, 246, 0.15)",
      background: "rgba(8, 8, 12, 0.98)",
      position: "relative",
      marginTop: "0.5rem"
    }}>
      {/* Panel Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem" }}>
          {activeTab === "assets" && <User size={16} style={{ color: "var(--accent)" }} />}
          {activeTab === "threats" && <ShieldAlert size={16} style={{ color: "var(--red)" }} />}
          {activeTab === "temperature" && <Thermometer size={16} style={{ color: "var(--amber)" }} />}
          {activeTab === "prediction" && <Cpu size={16} style={{ color: "var(--green)" }} />}
          <span style={{ textTransform: "uppercase" }}>
            {activeTab === "assets" && `Tracked Assets Registry — ${sectorName}`}
            {activeTab === "threats" && `Threat Vector Analysis — ${sectorName}`}
            {activeTab === "temperature" && `Thermal Profiler logs — ${sectorName}`}
            {activeTab === "prediction" && `AI Spatial Predictions — ${sectorName}`}
          </span>
        </h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <X size={16} />
        </button>
      </div>

      {/* ── TAB CONTENT: ASSETS REGISTRY ── */}
      {activeTab === "assets" && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <Search size={12} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search asset ID, carrier, device specs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "0.35rem 0.5rem 0.35rem 1.6rem", fontSize: "0.75rem" }}
              />
            </div>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              style={{ padding: "0.35rem", fontSize: "0.75rem", minWidth: "120px" }}
            >
              <option value="all">All Classifications</option>
              <option value="patient">Civilians (VIP)</option>
              <option value="nurse">Field Agents</option>
              <option value="visitor">Recon Drones</option>
            </select>
          </div>

          {/* Assets Grid Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontWeight: "bold" }}>
                  <th style={{ padding: "0.4rem" }}>Asset Alias</th>
                  <th style={{ padding: "0.4rem" }}>Classification</th>
                  <th style={{ padding: "0.4rem" }}>Spatial Location (X, Y, Z)</th>
                  <th style={{ padding: "0.4rem" }}>SIM / Carrier specs</th>
                  <th style={{ padding: "0.4rem" }}>Signal Strength</th>
                  <th style={{ padding: "0.4rem" }}>Network Audit Status</th>
                  <th style={{ padding: "0.4rem" }}>Biometrics</th>
                </tr>
              </thead>
              <tbody>
                {filteredOccupants.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>
                      No tracked assets match current search filters.
                    </td>
                  </tr>
                ) : (
                  filteredOccupants.map(o => {
                    const specs = getDeviceSpecs(o.entity_id);
                    return (
                      <tr key={o.entity_id} style={{ borderBottom: "1px solid var(--border-subtle)", background: o.posture === "fallen" ? "rgba(239,68,68,0.05)" : "transparent" }}>
                        <td style={{ padding: "0.5rem", fontWeight: "bold" }}>
                          {o.entity_id.toUpperCase()}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <span className={`badge ${getRoleBadgeColor(o.role)}`} style={{ fontSize: "0.6rem" }}>
                            {getRoleLabel(o.role)}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                          X:{o.pos_x.toFixed(2)} | Y:{o.pos_y.toFixed(2)} | Z:{o.pos_z.toFixed(2)}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <div>{specs.device}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.62rem" }}>
                            {specs.carrier} (IMSI: {specs.imsi})
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem", fontFamily: "JetBrains Mono, monospace" }}>
                          <span style={{ color: specs.signal > -65 ? "var(--green)" : specs.signal > -75 ? "var(--amber)" : "var(--red)" }}>
                            {specs.signal} dBm
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: specs.openAlert ? "var(--red)" : "var(--green)", fontWeight: "bold" }}>
                            {specs.openAlert ? <Wifi size={10} /> : <Lock size={10} />}
                            <span>{specs.networkMode}</span>
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <div style={{ color: o.posture === "fallen" ? "var(--red)" : "inherit", fontWeight: o.posture === "fallen" ? "bold" : "normal" }}>
                            {o.posture.toUpperCase()}
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.62rem" }}>
                            Resp: {o.breathing_rate ? `${o.breathing_rate.toFixed(0)} BPM` : "—"}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: THREAT VECTORS ── */}
      {activeTab === "threats" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", minHeight: "150px" }}>
          <div>
            <h4 style={{ fontSize: "0.8rem", color: "var(--red)", marginBottom: "0.5rem" }}>Active Incidents ({alerts.length})</h4>
            {alerts.length === 0 ? (
              <div className="empty-state" style={{ height: "100px" }}>No active threat vectors logged.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {alerts.map((a, i) => (
                  <div key={i} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "4px", padding: "0.5rem", fontSize: "0.72rem" }}>
                    <div style={{ fontWeight: "bold", color: "var(--red)", textTransform: "uppercase" }}>
                      [{a.severity}] {a.type}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.85)", margin: "0.15rem 0" }}>{a.message}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.62rem" }}>Zone: {a.room_id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 style={{ fontSize: "0.8rem", color: "var(--amber)", marginBottom: "0.5rem" }}>Predictive Anomaly Projections ({predictions.length})</h4>
            {predictions.length === 0 ? (
              <div className="empty-state" style={{ height: "100px" }}>No impending predictions computed.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {predictions.map((p, i) => (
                  <div key={i} style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "4px", padding: "0.5rem", fontSize: "0.72rem" }}>
                    <div style={{ fontWeight: "bold", color: "var(--amber)" }}>
                      {(p.probability * 100).toFixed(0)}% Probability Anomaly Link
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.85)", margin: "0.15rem 0" }}>{p.description}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.62rem" }}>Zone: {p.room_id} | Target: {p.entity_id || "None"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: TEMPERATURE PROFILES ── */}
      {activeTab === "temperature" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem" }}>
            {rooms.map(r => {
              const tempColor = r.temperature > 30 ? "#ef4444" : r.temperature > 24 ? "#f59e0b" : "#10b981";
              return (
                <div key={r.room_id} style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${r.is_hazard ? "rgba(239,68,68,0.4)" : "var(--border-subtle)"}`,
                  borderRadius: 5, padding: "0.5rem",
                }}>
                  <div style={{ fontSize: "0.58rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>
                    {r.room_id}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "0.2rem" }}>
                    <span style={{ fontSize: "1rem", fontWeight: "bold", color: tempColor, fontFamily: "JetBrains Mono" }}>
                      {r.temperature.toFixed(1)}°C
                    </span>
                    <span style={{ fontSize: "0.58rem", color: "var(--text-muted)" }}>
                      Air Quality
                    </span>
                  </div>
                  {/* Smoke Bar */}
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: "0.3rem", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, (r.smoke_ppm / 500) * 100)}%`, height: "100%", background: r.smoke_ppm > 100 ? "#ef4444" : "#10b981" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.5rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                    <span>{r.smoke_ppm.toFixed(0)} PPM</span>
                    <span>CO2</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: TARGET PROBABILITY DETAILED LOGS ── */}
      {activeTab === "prediction" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.85)" }}>
          <div style={{ background: "#040406", border: "1px solid var(--border)", borderRadius: "4px", padding: "0.75rem" }}>
            <h4 style={{ color: "var(--green)", fontWeight: "bold", fontSize: "0.8rem", marginBottom: "0.35rem" }}>AETHER Spatial Anomaly Inference Model</h4>
            <p style={{ color: "var(--text-muted)", fontSize: "0.7rem", lineHeight: "1.4" }}>
              The system calculates threat probabilities continuously using RF CSI multipath signal fading profiles. 
              By cross-referencing activity duration offsets, breathing rate variance, and thermal index trends, 
              AETHER generates real-time Bayesian prediction vectors.
            </p>
          </div>
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.25rem", color: "var(--text-muted)" }}>
              <span>Bayesian Prediction Chain Link</span>
              <span>Certainty Weight</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.4rem" }}>
              {[
                { name: "CSI Signal Fading Envelope Match (Postural Change)", val: "0.94" },
                { name: "Respiration Phase Deviation Indicator", val: "0.82" },
                { name: "Thermal Flux Vector Correlation (Zone temperature change)", val: "0.68" },
                { name: "Drone Trajectory Avoidance Buffer Clearance", val: "0.12" },
              ].map((link, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{link.name}</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--green)", fontWeight: "bold" }}>{link.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

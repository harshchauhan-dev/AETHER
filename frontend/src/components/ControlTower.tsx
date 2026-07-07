import React, { useState } from "react";
import { Play, Pause, PlayCircle, RotateCcw, AlertTriangle, Flame, HelpCircle as HelpIcon, Sparkles } from "lucide-react";
import type { RoomState, OccupantState } from "../types";

interface ControlTowerProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSingleTick: () => void;
  onReset: () => void;
  rooms: RoomState[];
  occupants: OccupantState[];
  onTriggerFall: (entityId: string) => void;
  onTriggerFire: (roomId: string) => void;
}

export default function ControlTower({
  isPlaying,
  onTogglePlay,
  onSingleTick,
  onReset,
  rooms,
  occupants,
  onTriggerFall,
  onTriggerFire,
}: ControlTowerProps) {
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");

  // Counterfactual "What If?" states
  const [whatIfRoom, setWhatIfRoom] = useState("");
  const [whatIfBlockedRoom, setWhatIfBlockedRoom] = useState("");
  const [cfResult, setCfResult] = useState<{
    consequences: string[];
    safeguards: string[];
    riskIndex: string;
  } | null>(null);

  const patients = occupants.filter(o => o.role === "patient");

  const handleFallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPatient) {
      onTriggerFall(selectedPatient);
    }
  };

  const handleFireSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoom) {
      onTriggerFire(selectedRoom);
    }
  };

  const runCounterfactualSimulation = () => {
    if (!whatIfRoom && !whatIfBlockedRoom) return;

    const consequences: string[] = [];
    const safeguards: string[] = [];
    let riskIndex = "LOW";

    if (whatIfRoom && whatIfBlockedRoom) {
      riskIndex = "CRITICAL";
      consequences.push(`Thermal Flare in ${whatIfRoom.toUpperCase()} combined with block on ${whatIfBlockedRoom.toUpperCase()} cuts off all primary exit paths.`);
      consequences.push("CSI Wave reflection propagation SNR is projected to collapse below 8dB.");
      safeguards.push(`Reroute all field agents immediately through alternative transit vectors.`);
      safeguards.push("Engage Starlink high-priority orbit downlink bypass to secure local node telemetry.");
    } else if (whatIfRoom) {
      riskIndex = "ELEVATED";
      consequences.push(`Flare in ${whatIfRoom.toUpperCase()} creates localized atmospheric smoke attenuation (~220 PPM).`);
      consequences.push("Standard transit corridor route will become hazardous within 35 seconds.");
      safeguards.push(`Preemptively direct civilians in adjacent rooms to move toward Escape Port A.`);
    } else if (whatIfBlockedRoom) {
      riskIndex = "MODERATE";
      consequences.push(`Block on ${whatIfBlockedRoom.toUpperCase()} forces responders to take longer detours.`);
      consequences.push("Average emergency response latency increases by 18 seconds.");
      safeguards.push("Pre-assign secondary responder units to secure fallback perimeters.");
    }

    setCfResult({ consequences, safeguards, riskIndex });
  };

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <h3 className="panel-title">Signal Uplink & Live Controller</h3>
      <p className="panel-subtitle">Engage satellite streams, sweep frequencies, or inject live anomalies</p>

      <div className="btn-row">
        <button onClick={onTogglePlay} className={`btn ${isPlaying ? "btn-danger" : "btn-accent"}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          <span>{isPlaying ? "Disconnect Stream" : "Live Stream Lock"}</span>
        </button>
        <button onClick={onSingleTick} disabled={isPlaying} className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
          <PlayCircle size={14} />
          <span>Sweep Frequency</span>
        </button>
        <button onClick={onReset} className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
          <RotateCcw size={14} />
          <span>Flush Memory</span>
        </button>
      </div>

      <div className="trigger-row" style={{ marginTop: "1rem" }}>
        {/* Trigger Fall Group */}
        <form onSubmit={handleFallSubmit} className="trigger-group">
          <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "bold" }}>Inject CSI Altitude Drop</label>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">Select target asset...</option>
              {patients.map(p => (
                <option key={p.entity_id} value={p.entity_id}>
                  {p.entity_id === "civilian_1" ? "CIVILIAN_1 (VIP)" :
                   p.entity_id === "civilian_2" ? "CIVILIAN_2" :
                   p.entity_id === "civilian_3" ? "CIVILIAN_3" :
                   p.entity_id === "civilian_4" ? "CIVILIAN_4" : p.entity_id}
                </option>
              ))}
            </select>
            <button type="submit" disabled={!selectedPatient} className="btn btn-danger" style={{ padding: "0.35rem 0.5rem", flex: "0 0 auto", display: "flex", alignItems: "center", gap: "0.2rem" }} title="Trigger CSI Disruption">
              <AlertTriangle size={13} />
            </button>
          </div>
        </form>

        {/* Trigger Fire Group */}
        <form onSubmit={handleFireSubmit} className="trigger-group">
          <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "bold" }}>Inject Thermal Flare Vector</label>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">Select sector zone...</option>
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
            <button type="submit" disabled={!selectedRoom} className="btn btn-danger" style={{ padding: "0.35rem 0.5rem", flex: "0 0 auto", display: "flex", alignItems: "center", gap: "0.2rem" }} title="Trigger Thermal Signature">
              <Flame size={13} />
            </button>
          </div>
        </form>
      </div>

      {/* 🔮 Phase 4: Counterfactual Simulation ("What If?") Deck */}
      <div style={{
        marginTop: "1.25rem",
        borderTop: "1px solid var(--border)",
        paddingTop: "1rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.55rem" }}>
          <HelpIcon size={14} style={{ color: "var(--accent)" }} />
          <strong style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--accent)" }}>
            Phase 4: Counterfactual "What If?" Simulator
          </strong>
        </div>
        <p className="panel-subtitle" style={{ marginBottom: "0.6rem" }}>
          Simulate hypothetical disaster scenarios to calculate preventative escape routing weights.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <select
              value={whatIfRoom}
              onChange={(e) => setWhatIfRoom(e.target.value)}
              style={{ flex: 1, fontSize: "0.7rem", padding: "0.3rem" }}
            >
              <option value="">What if Flare Ignites in...</option>
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

            <select
              value={whatIfBlockedRoom}
              onChange={(e) => setWhatIfBlockedRoom(e.target.value)}
              style={{ flex: 1, fontSize: "0.7rem", padding: "0.3rem" }}
            >
              <option value="">And Escape path is blocked in...</option>
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

          <button
            onClick={runCounterfactualSimulation}
            disabled={!whatIfRoom && !whatIfBlockedRoom}
            className="btn btn-accent"
            style={{
              padding: "0.4rem 0.5rem",
              fontSize: "0.7rem",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem"
            }}
          >
            <Sparkles size={11} />
            <span>SOLVE COUNTERFACTUAL MODEL</span>
          </button>
        </div>

        {/* Counterfactual Projection results card */}
        {cfResult && (
          <div style={{
            marginTop: "0.75rem",
            background: "rgba(59, 130, 246, 0.04)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "6px",
            padding: "0.55rem 0.75rem",
            fontSize: "0.68rem"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <span style={{ color: "var(--accent)", fontWeight: "bold" }}>🔮 COUNTERFACTUAL PROJECTION REPORT</span>
              <span className={`badge ${
                cfResult.riskIndex === "CRITICAL" ? "badge-red" : 
                cfResult.riskIndex === "ELEVATED" ? "badge-amber" : "badge-blue"
              }`} style={{ fontSize: "0.55rem" }}>
                {cfResult.riskIndex} RISK
              </span>
            </div>
            
            <div style={{ marginBottom: "0.35rem" }}>
              <div style={{ color: "var(--text-muted)", fontWeight: "bold", fontSize: "0.6rem" }}>CONSEQUENCE CHAIN:</div>
              {cfResult.consequences.map((c, idx) => (
                <div key={idx} style={{ color: "rgba(255,255,255,0.85)", margin: "0.15rem 0" }}>• {c}</div>
              ))}
            </div>

            <div>
              <div style={{ color: "var(--text-muted)", fontWeight: "bold", fontSize: "0.6rem" }}>PREEMPTIVE SAFEGUARDS:</div>
              {cfResult.safeguards.map((s, idx) => (
                <div key={idx} style={{ color: "var(--green)", margin: "0.15rem 0" }}>✓ {s}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

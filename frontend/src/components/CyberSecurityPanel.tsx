import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert, Eye, Server, Terminal, Settings } from "lucide-react";

interface CyberSecurityPanelProps {
  isActive: boolean;
  hasThreats: boolean;
  step: number;
}

interface IDSEntry {
  id: number;
  timestamp: string;
  type: "info" | "warning" | "critical";
  message: string;
}

export default function CyberSecurityPanel({ isActive, hasThreats, step }: CyberSecurityPanelProps) {
  const [idsLog, setIdsLog] = useState<IDSEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"ids" | "compliance" | "vectors">("ids");
  const logRef = useRef<HTMLDivElement | null>(null);

  // Advanced cybersecurity techniques tracking
  const [dnsQueries, setDnsQueries] = useState(0);
  const [portScans, setPortScans] = useState(0);
  const [mitmAlerts, setMitmAlerts] = useState(0);

  useEffect(() => {
    if (step === 0) {
      setIdsLog([{
        id: 0,
        timestamp: new Date().toISOString().slice(11, 19),
        type: "info",
        message: "AETHER IDS Shield initiated. Passive listening on RF CSI subcarrier bands..."
      }]);
      setDnsQueries(12);
      setPortScans(0);
      setMitmAlerts(0);
      return;
    }

    const now = new Date().toISOString().slice(11, 19);
    const newEntries: IDSEntry[] = [];

    // Increment telemetry counters
    setDnsQueries(prev => prev + Math.floor(Math.random() * 5) + 1);

    // Simulate detection parameters
    const roll = Math.random();
    if (roll < 0.12) {
      newEntries.push({
        id: Date.now(),
        timestamp: now,
        type: "warning",
        message: `Rogue AP detected: BSSID ${randomMAC()} Channel ${Math.floor(Math.random() * 11) + 1} (${Math.floor(Math.random() * 20) - 75} dBm)`
      });
      setPortScans(prev => prev + 1);
    } else if (roll < 0.22) {
      newEntries.push({
        id: Date.now(),
        timestamp: now,
        type: "critical",
        message: `Deauth flood detected: 802.11 frames/sec threshold exceeded from MAC ${randomMAC()}`
      });
      setMitmAlerts(prev => prev + 1);
    } else if (roll < 0.35) {
      newEntries.push({
        id: Date.now(),
        timestamp: now,
        type: "info",
        message: `Uplink Handshake secured for station index: ${randomMAC().slice(0, 8)}`
      });
    } else if (roll < 0.45 && hasThreats) {
      newEntries.push({
        id: Date.now(),
        timestamp: now,
        type: "critical",
        message: `Signal interference anomaly: SNR dropped below 15dB. Potential active jammer nearby.`
      });
      setMitmAlerts(prev => prev + 1);
    } else if (roll < 0.55) {
      newEntries.push({
        id: Date.now(),
        timestamp: now,
        type: "warning",
        message: `DNS Tunneling payload signature check: Potential leakage vector on port 53`
      });
      setDnsQueries(prev => prev + 25);
    }

    if (newEntries.length > 0) {
      setIdsLog(prev => {
        const merged = [...prev, ...newEntries];
        return merged.length > 40 ? merged.slice(-40) : merged;
      });
    }
  }, [step, hasThreats]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [idsLog, activeTab]);

  // Cyber metrics
  const wpa3Status = isActive ? "SAE-WPA3 (ACTIVE)" : "STANDBY";
  const firewallStatus = isActive ? (hasThreats ? "ELEVATED IPS" : "NOMINAL PROTECTION") : "SHIELD OFFLINE";
  const encryptCipher = "AES-256-GCM";
  const threatLevel = hasThreats ? "CRITICAL" : (isActive ? "SECURE" : "STANDBY");

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          {hasThreats ? <ShieldAlert size={15} style={{ color: "var(--red)" }} /> : <ShieldCheck size={15} style={{ color: "var(--green)" }} />}
          <span>Defense Shield & Cyber security Monitor</span>
        </h3>
        <span className={`badge ${hasThreats ? "badge-red" : "badge-green"}`} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Eye size={10} />
          <span>{threatLevel}</span>
        </span>
      </div>
      <p className="panel-subtitle">Multi-vector intrusion prevention system, DNS payload verification, and threat classification.</p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.6rem" }}>
        {[
          { id: "ids" as const, label: "IDS Log Feed", icon: <Terminal size={10} /> },
          { id: "compliance" as const, label: "Compliance & Specs", icon: <Server size={10} /> },
          { id: "vectors" as const, label: "Attack Vectors", icon: <Settings size={10} /> }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1,
              padding: "0.25rem 0.4rem",
              fontSize: "0.6rem",
              fontWeight: activeTab === t.id ? "bold" : "normal",
              background: activeTab === t.id ? "rgba(37,99,235,0.15)" : "transparent",
              border: `1px solid ${activeTab === t.id ? "var(--accent)" : "var(--border-subtle)"}`,
              borderRadius: 3,
              color: activeTab === t.id ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.2rem",
              textTransform: "uppercase"
            }}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: IDS LOG FEED ── */}
      {activeTab === "ids" && (
        <div>
          {/* Live Mini Counters */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem", marginBottom: "0.5rem" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "0.3rem 0.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: "bold" }}>DNS VERIFIED</div>
              <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: "var(--green)", fontFamily: "JetBrains Mono" }}>{dnsQueries}</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "0.3rem 0.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: "bold" }}>PORT CHECKS</div>
              <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: portScans > 0 ? "var(--amber)" : "var(--text-muted)", fontFamily: "JetBrains Mono" }}>{portScans}</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "0.3rem 0.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: "bold" }}>MITM ALERTS</div>
              <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: mitmAlerts > 0 ? "var(--red)" : "var(--text-muted)", fontFamily: "JetBrains Mono" }}>{mitmAlerts}</div>
            </div>
          </div>

          <div
            ref={logRef}
            style={{
              background: "#040406",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "0.5rem",
              maxHeight: "115px",
              overflowY: "auto",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.64rem",
              lineHeight: "1.5"
            }}
          >
            {idsLog.map(entry => (
              <div
                key={entry.id}
                style={{
                  color: entry.type === "critical" ? "#ef4444" : entry.type === "warning" ? "#f59e0b" : "rgba(255,255,255,0.55)"
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.3)" }}>[{entry.timestamp}]</span>{" "}
                <span style={{ fontWeight: entry.type !== "info" ? "bold" : "normal", fontSize: "0.58rem" }}>
                  [{entry.type.toUpperCase()}]
                </span>{" "}
                {entry.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: COMPLIANCE & SPECS ── */}
      {activeTab === "compliance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.25rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Encryption Protocol:</span>
            <span style={{ fontFamily: "JetBrains Mono", color: "var(--green)" }}>{encryptCipher}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.25rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Uplink Auth Mode:</span>
            <span style={{ fontFamily: "JetBrains Mono", color: "var(--green)" }}>{wpa3Status}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.25rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Firewall Configuration:</span>
            <span style={{
              fontFamily: "JetBrains Mono",
              color: firewallStatus.includes("ELEVATED") ? "var(--red)" : firewallStatus.includes("NOMINAL") ? "var(--green)" : "var(--text-muted)"
            }}>{firewallStatus}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>FIPS 140-3 Compliance:</span>
            <span style={{ color: "var(--green)" }}>✓ SECURE & VERIFIED</span>
          </div>
        </div>
      )}

      {/* ── TAB 3: ATTACK VECTORS ── */}
      {activeTab === "vectors" && (
        <div style={{ fontSize: "0.7rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {[
            { name: "CSI Multi-Path Spoofing", score: "99.8%", status: "Shield Protected" },
            { name: "WiFi Frame Injection", score: "98.7%", status: "Shield Protected" },
            { name: "RF Rogue Transmitter Beaconing", score: "96.4%", status: "Protected" },
            { name: "IMSI Catching Detection", score: "99.1%", status: "Shield Protected" }
          ].map(vec => (
            <div key={vec.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", padding: "0.3rem 0.5rem", borderRadius: 4 }}>
              <span style={{ fontWeight: "bold" }}>{vec.name}</span>
              <div style={{ display: "flex", gap: "0.4rem", fontFamily: "JetBrains Mono" }}>
                <span style={{ color: "var(--accent)" }}>{vec.score}</span>
                <span style={{ color: "var(--green)" }}>{vec.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function randomMAC(): string {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
  return `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
}

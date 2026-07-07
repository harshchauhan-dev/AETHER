import { useEffect, useState } from "react";
import { Cpu, Wifi, Activity } from "lucide-react";

interface NetworkHealthProps {
  ping: number;
  csiQuality: number;
  csiPackets: number;
  simTime: string;
}

export default function NetworkHealth({ ping, csiQuality, csiPackets, simTime }: NetworkHealthProps) {
  const [pingHistory, setPingHistory] = useState<number[]>(Array(15).fill(ping));
  const [snrHistory, setSnrHistory] = useState<number[]>(Array(15).fill(csiQuality * 30));
  const [packetHistory, setPacketHistory] = useState<number[]>(Array(15).fill(csiPackets));

  useEffect(() => {
    setPingHistory(prev => [...prev.slice(1), ping]);
    // Map quality fraction (0.8 - 1.0) to decibel scale SNR (24dB - 30dB)
    const dbValue = parseFloat((csiQuality * 30).toFixed(1));
    setSnrHistory(prev => [...prev.slice(1), dbValue]);
    setPacketHistory(prev => [...prev.slice(1), csiPackets]);
  }, [simTime]);

  const drawSparkline = (data: number[], minVal: number, maxVal: number): string => {
    const width = 140;
    const height = 40;
    const padding = 2;
    const pointsCount = data.length;
    const range = maxVal - minVal || 1;

    return data.map((val, idx) => {
      const x = (idx / (pointsCount - 1)) * (width - padding * 2) + padding;
      const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    }).join(" ");
  };

  const currentPing = pingHistory[pingHistory.length - 1] || 0;
  const currentSnr = snrHistory[snrHistory.length - 1] || 0;
  const currentPackets = packetHistory[packetHistory.length - 1] || 0;

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <Wifi size={14} style={{ color: "var(--accent)" }} />
        <span>Satellite Uplink & CSI Mesh Analytics</span>
      </h3>
      <p className="panel-subtitle">Orbital pings and urban wireless channel state waveforms</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.85rem", marginTop: "0.5rem" }}>
        {/* Latency Sparkline */}
        <div style={{ background: "rgba(10,10,15,0.6)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.55rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: "bold" }}>
            <span>ORBITAL PING</span>
            <Activity size={10} />
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold", margin: "0.15rem 0", fontFamily: "JetBrains Mono" }}>
            {currentPing} <span style={{ fontSize: "0.7rem", fontWeight: "normal", color: "var(--text-muted)" }}>ms</span>
          </div>
          <svg width="100%" height="40" style={{ marginTop: "0.25rem", overflow: "visible" }}>
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              points={drawSparkline(pingHistory, 0, 35)}
            />
          </svg>
        </div>

        {/* Packet Rate Sparkline */}
        <div style={{ background: "rgba(10,10,15,0.6)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.55rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: "bold" }}>
            <span>CSI PACKET RATE</span>
            <Cpu size={10} />
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold", margin: "0.15rem 0", fontFamily: "JetBrains Mono" }}>
            {currentPackets} <span style={{ fontSize: "0.7rem", fontWeight: "normal", color: "var(--text-muted)" }}>p/s</span>
          </div>
          <svg width="100%" height="40" style={{ marginTop: "0.25rem", overflow: "visible" }}>
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              points={drawSparkline(packetHistory, 300, 700)}
            />
          </svg>
        </div>

        {/* SNR Sparkline */}
        <div style={{ background: "rgba(10,10,15,0.6)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.55rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: "bold" }}>
            <span>UPLINK SNR</span>
            <Wifi size={10} />
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold", margin: "0.15rem 0", fontFamily: "JetBrains Mono" }}>
            {currentSnr.toFixed(1)} <span style={{ fontSize: "0.7rem", fontWeight: "normal", color: "var(--text-muted)" }}>dB</span>
          </div>
          <svg width="100%" height="40" style={{ marginTop: "0.25rem", overflow: "visible" }}>
            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.5"
              points={drawSparkline(snrHistory, 20, 32)}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

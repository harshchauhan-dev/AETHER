import { useEffect, useRef } from "react";
import { Clock, Activity } from "lucide-react";

interface TimelineEvent {
  id: number;
  time: string;
  msg: string;
  type: "info" | "warning" | "alert";
}

interface TimelineLogPanelProps {
  events: TimelineEvent[];
}

export default function TimelineLogPanel({ events }: TimelineLogPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <Clock size={15} style={{ color: "var(--accent)" }} />
        <span>Space Telemetry Event Timeline</span>
      </h3>
      <p className="panel-subtitle">Chronological log of classified RF activities and trajectory alerts</p>

      <div
        ref={containerRef}
        style={{
          background: "#040406",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "0.6rem",
          maxHeight: "180px",
          overflowY: "auto",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.65rem",
          lineHeight: "1.6",
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem"
        }}
      >
        {events.length === 0 ? (
          <div className="empty-state" style={{ padding: "1.5rem 0" }}>
            <Activity size={12} style={{ display: "block", margin: "0 auto 0.35rem", color: "var(--text-dim)" }} />
            <span>Standby. Initialize uplink sweep to populate timeline logs...</span>
          </div>
        ) : (
          events.map((e) => {
            let color = "rgba(255,255,255,0.6)";
            let badge = "●";
            if (e.type === "alert") {
              color = "var(--red)";
              badge = "🚨";
            } else if (e.type === "warning") {
              color = "var(--amber)";
              badge = "⚠";
            } else {
              color = "#10b981";
              badge = "▸";
            }

            return (
              <div key={e.id} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", color }}>
                <span style={{ color: "rgba(255,255,255,0.25)", flex: "none" }}>{e.time}</span>
                <span style={{ flex: "none" }}>{badge}</span>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>{e.msg}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

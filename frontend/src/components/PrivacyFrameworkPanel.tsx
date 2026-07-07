import { Shield, Lock, EyeOff, CheckCircle } from "lucide-react";

export default function PrivacyFrameworkPanel() {
  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem" }}>
          <Shield size={14} style={{ color: "var(--green)" }} />
          <span>Privacy & Security Compliance Frameworks</span>
        </h3>
        <span className="badge badge-green" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <CheckCircle size={10} />
          <span>FIPS COMPLIANT</span>
        </span>
      </div>
      <p className="panel-subtitle">AETHER's core privacy preserving data processing configurations under international frameworks.</p>

      {/* Compliance Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem", marginBottom: "0.85rem" }}>
        <div style={{ background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 6, padding: "0.55rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.56rem", color: "var(--text-muted)", fontWeight: "bold" }}>GDPR INDEX</div>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--green)", fontFamily: "JetBrains Mono" }}>99.8%</div>
          <div style={{ fontSize: "0.52rem", color: "var(--text-dim)", marginTop: "0.15rem" }}>Zero PII Capture</div>
        </div>

        <div style={{ background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 6, padding: "0.55rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.56rem", color: "var(--text-muted)", fontWeight: "bold" }}>DIFFERENTIAL NOISE</div>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--accent)", fontFamily: "JetBrains Mono" }}>ε = 0.15</div>
          <div style={{ fontSize: "0.52rem", color: "var(--text-dim)", marginTop: "0.15rem" }}>Laplacian Perturbation</div>
        </div>

        <div style={{ background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 6, padding: "0.55rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.56rem", color: "var(--text-muted)", fontWeight: "bold" }}>K-ANONYMITY</div>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--amber)", fontFamily: "JetBrains Mono" }}>k = 5</div>
          <div style={{ fontSize: "0.52rem", color: "var(--text-dim)", marginTop: "0.15rem" }}>Indistinguishable Target</div>
        </div>
      </div>

      {/* Details list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.72rem" }}>
          <Lock size={12} style={{ color: "var(--green)", marginTop: "0.1rem", flex: "none" }} />
          <div>
            <strong>AES-256 Payload Encryption:</strong> All raw CSI amplitude maps are processed locally at the edge receiver and encrypted using ephemeral AES key vectors before database persistence.
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.72rem" }}>
          <EyeOff size={12} style={{ color: "var(--green)", marginTop: "0.1rem", flex: "none" }} />
          <div>
            <strong>MAC and IMSI Hashing:</strong> Wi-Fi MAC addresses and Cellular subscriber IDs are hashed using double SHA-256 salts on interface connection, guaranteeing that specific users cannot be linked back to real identities.
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.72rem" }}>
          <Shield size={12} style={{ color: "var(--green)", marginTop: "0.1rem", flex: "none" }} />
          <div>
            <strong>Consent Frameworks & CCPA Compliance:</strong> Real-time mapping data is processed on-device. Telemetry snapshots logged to local SQLite DB are automatically pruned after 24 hours.
          </div>
        </div>
      </div>
    </div>
  );
}

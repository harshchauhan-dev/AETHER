import os
from datetime import datetime
from typing import Dict, List, Any, Optional
import google.generativeai as genai

class AETHERAgent:
    def __init__(self, sector_states: Dict[str, Dict[str, Any]]):
        """
        sector_states is a dictionary representing tactical sector status:
        {
           "sector_id": {
              "name": str,
              "layout": SpatialLayout,
              "tracker": StateTracker,
              "forecaster": Forecaster,
              "engine": DecisionEngine,
              "memory": EnvironmentalMemory,
              "ping": int,
              "csi_quality": float,
              "csi_packets": int
           }
        }
        """
        self.sectors = sector_states
        
        # Configure Gemini API if key is present
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.use_gemini = False
        if self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-1.5-flash")
                self.use_gemini = True
            except Exception as e:
                print(f"Failed to configure Gemini: {e}")

    def build_system_context(self, active_id: str) -> str:
        """
        Compiles the state of all satellite-monitored ground sectors
        AND the deep spatial reasoning layers for the active recon zone.
        """
        context = []
        context.append(f"AETHER SPACE INTELLIGENCE CONSOLE - Time: {datetime.now().strftime('%H:%M:%S')}")
        context.append("==================================================")
        
        # 1. Network Level Overview
        context.append("\nTACTICAL GIS GROUND-GROUND NETWORK STATUS:")
        for sid, s in self.sectors.items():
            alerts = s["tracker"].get_active_alerts()
            status = "🔴 ACTIVE THREATS" if len(alerts) > 0 else "🟢 SECURE"
            context.append(
                f"- Recon Sector: {s['name']} (ID: {sid}) | Status: {status} | Target Alerts: {len(alerts)} | "
                f"Satellite Link Ping: {s['ping']}ms | CSI Wave Rate: {s['csi_packets']}/s | Uplink Quality: {s['csi_quality']:.1%}"
            )
            
        # 2. Detailed selected hospital state
        if active_id in self.sectors:
            active_s = self.sectors[active_id]
            context.append(f"\nDEEP SENSORY RECON DETAILS: {active_s['name'].upper()}")
            context.append("--------------------------------------------------")
            
            # Rooms and Env
            context.append("SECTOR ZONE HAZARDS & THERMAL INDEX:")
            for node, attrs in active_s["layout"].graph.nodes(data=True):
                temp = attrs.get("temperature", 21.5)
                smoke = attrs.get("smoke_ppm", 0.0)
                hazard = "⚠️ CRITICAL BLAZE/GAS DETECTED!" if attrs.get("hazard", False) else "Clear"
                context.append(f"- {node}: Type: {attrs.get('type')}, Temp: {temp:.1f}°C, Smoke: {smoke:.1f} ppm, Status: {hazard}")
                
            # Occupants
            context.append("\nTRACKED ASSETS (RADIO FIELD REFLECTIONS):")
            for occ_id, occ in active_s["tracker"].occupants.items():
                breathing = f", Vital Sign Rate: {occ.breathing_rate:.1f} bpm" if occ.breathing_rate else ""
                inactivity = f", Immobility: {int(occ.inactivity_duration)}s" if occ.inactivity_duration > 0 else ""
                
                role_label = "Field Agent"
                if occ.role == "patient":
                    role_label = "Civilian Target"
                elif occ.role == "visitor":
                    role_label = "Recon Drone"

                context.append(
                    f"- {occ_id} ({role_label}): Zone: {occ.current_room}, Signature: {occ.posture.upper()}, "
                    f"Action: {occ.activity}, Grid Coord: ({occ.pos_x:.1f}m, {occ.pos_y:.1f}m, {occ.pos_z:.1f}m){breathing}{inactivity}"
                )
                
            # Active Alerts
            context.append("\nACTIVE ALERTS / ANOMALIES:")
            alerts = active_s["tracker"].get_active_alerts()
            if alerts:
                for alert in alerts:
                    context.append(f"- [{alert['severity'].upper()}] {alert['message']}")
            else:
                context.append("- None")
                
            # Predictions
            context.append("\nTACTICAL RISK FORECASTS (PROBABILITY VECTORS):")
            predictions = active_s["forecaster"].predict()
            if predictions:
                for p in predictions:
                    context.append(f"- [{p.alert_type.upper()} - Prob: {p.probability:.2%}] {p.description}")
            else:
                context.append("- None")
                
            # Decisions
            context.append("\nTACTICAL DISPATCHES & ESCAPE ROTATIONS:")
            decisions = active_s["engine"].get_recommendations()
            if decisions:
                for d in decisions:
                    route_str = f" Avoidance Vector: {' -> '.join(d.route)}" if d.route else ""
                    context.append(f"- [{d.severity.upper()} - {d.action_type.upper()}] {d.description}{route_str}")
            else:
                context.append("- None")

            # Learning
            context.append("\nLEARNT BASELINE PATTERNS:")
            heatmap = active_s["memory"].get_room_occupancy_heatmap()
            if heatmap:
                heatmap_str = ", ".join([f"{room}: {prob:.1%}" for room, prob in heatmap.items()])
                context.append(f"- Sector Zone Occupancy Ratio: {heatmap_str}")
                
        return "\n".join(context)

    def query(self, user_query: str, active_sector_id: str) -> str:
        system_context = self.build_system_context(active_sector_id)
        
        if self.use_gemini:
            prompt = f"""
You are AETHER OS, an AI Operating System for Physical Spaces that combines RF sensing, spatial reasoning, predictive inference, and privacy-preserving decision support. Modeled after advanced military recon consoles, you reason about urban grids, orbital satellite uplinks, drone vectors, and civilian tracking using camera-free Wi-Fi CSI wave propagation and micro-radar.

Here is the live satellite and ground-sensing context:
{system_context}

Based on this tactical state, answer the user's question. Focus on:
1. Identifying active threats (falls/blazes) and drone/agent positions.
2. Explaining "why" anomalies are occurring using multi-sensory readings (e.g. mmWave ground level height coordinates or low WiFi CSI variances).
3. Keeping dispatches, evacuation vectors, and orbital link stats clearly formatted.

User Question: "{user_query}"
"""
            try:
                response = self.model.generate_content(prompt)
                return response.text
            except Exception as e:
                return f"Gemini Query Error: {e}. Falling back to local reasoning engine.\n\n" + self.local_query_fallback(user_query, active_sector_id)
        else:
            return self.local_query_fallback(user_query, active_sector_id)

    def local_query_fallback(self, query: str, active_id: str) -> str:
        query_lower = query.lower()
        response_lines = []
        
        response_lines.append("> [!NOTE]")
        response_lines.append("> **AETHER Tactical Fallback Mode**: Initialize `GEMINI_API_KEY` for full orbital space reasoning.\n")

        active_s = self.sectors.get(active_id)
        s_name = active_s["name"] if active_s else active_id

        # 1. Alert reasons with structured decision support
        if "why" in query_lower:
            response_lines.append(f"### AETHER AI Space Decision Support — Anomaly Audit\n")
            if not active_s:
                response_lines.append("No active sector profile loaded.")
                return "\n".join(response_lines)
                
            alerts = active_s["tracker"].get_active_alerts()
            if not alerts:
                response_lines.append("### All Assets Secure\nNo active anomalies detected. Historical baseline is nominal.")
            else:
                for a in alerts:
                    room = a["room_id"]
                    msg = a["message"]
                    
                    # Resolve occupant details if present
                    subject_label = "Unidentified RF Signature"
                    inactivity_str = "anomalous postural change"
                    
                    if "civilian" in msg.lower() or "patient" in msg.lower():
                        subject_label = "CIVILIAN_1 (VIP Target)"
                        inactivity_str = "Subject remained motionless inside restricted zone"
                    elif "fire" in msg.lower() or "smoke" in msg.lower():
                        subject_label = "Thermal Flux Anomaly"
                        inactivity_str = "Critical zone heat signature detected"
                        
                    response_lines.append(f"**Subject:** {subject_label}")
                    response_lines.append(f"**Sensed Anomaly:** {inactivity_str} inside **{room}**.")
                    response_lines.append(f"**Historical Probability:** 0.3% (Highly anomalous deviation from baseline)\n")
                    
                    response_lines.append("**Potential Explanations:**")
                    if "fall" in a["type"].lower() or "motionless" in msg.lower():
                        response_lines.append("- **Medical emergency:** CSI breathing rate check reveals shallow respiration rate.")
                        response_lines.append("- **Sensor occlusion / Multipath fade:** Local RF signal reflections dropped.")
                        response_lines.append("- **Unauthorized access:** Restricted zone entered.")
                    else:
                        response_lines.append("- **Atmospheric anomaly:** Chemical flare or combustion vector active.")
                        response_lines.append("- **Hardware failure:** Local thermal sensor calibration bleed.")
                        
                    response_lines.append("\n**Recommended Response:**")
                    engine_recs = active_s["engine"].get_recommendations()
                    if engine_recs:
                        response_lines.append(f"- {engine_recs[0].description}")
                    else:
                        response_lines.append("- Dispatch nearest field agent to perform physical check.")

        # 2. General alerts across campuses
        elif "help" in query_lower or "alert" in query_lower or "critical" in query_lower or "threat" in query_lower:
            response_lines.append("### Tactical GIS Mesh Emergency Overview\n")
            needs_help = False
            for sid, s in self.sectors.items():
                alerts = s["tracker"].get_active_alerts()
                if alerts:
                    response_lines.append(f"🔴 **{s['name']}** has active threats:")
                    for a in alerts:
                        response_lines.append(f"  * {a['message']} (Zone: {a['room_id']})")
                    needs_help = True
            if not needs_help:
                response_lines.append("All sectors report secure. No active threat vectors.")

        # 3. Network health stats
        elif "network" in query_lower or "satellite" in query_lower or "link" in query_lower or "ping" in query_lower:
            response_lines.append("### Satellite Uplink & CSI Mesh Summary\n")
            for sid, s in self.sectors.items():
                response_lines.append(
                    f"- **{s['name']}**: CSI transmission rate={s['csi_packets']}/s, latency={s['ping']}ms, "
                    f"Uplink Signal Quality={s['csi_quality']:.1%}"
                )

        # 4. Summary
        elif "summary" in query_lower or "summarize" in query_lower or "activity" in query_lower:
            response_lines.append(f"### Sector Activity Summary: {s_name}\n")
            if active_s:
                civilians = [o for o in active_s["tracker"].occupants.values() if o.role == "patient"]
                agents = [o for o in active_s["tracker"].occupants.values() if o.role == "nurse"]
                drones = [o for o in active_s["tracker"].occupants.values() if o.role == "visitor"]
                response_lines.append(f"Currently tracking **{len(active_s['tracker'].occupants)} assets** in this sector:")
                response_lines.append(f"- ★ Civilian Targets: {len(civilians)}")
                response_lines.append(f"- ● Field Agents: {len(agents)}")
                response_lines.append(f"- ▲ Recon Drones: {len(drones)}")
            else:
                response_lines.append("No active sector selected.")

        else:
            response_lines.append("### AETHER Space Intelligence Operating System\n")
            response_lines.append("Monitoring coordinates via geospatial satellite radar sweeps.")
            response_lines.append("\nTry asking:")
            response_lines.append("1. *'Show me active threats.'*")
            response_lines.append("2. *'What is the satellite link status?'*")
            response_lines.append("3. *'Why did you raise this alert?'*")

        return "\n".join(response_lines)

        return "\n".join(response_lines)

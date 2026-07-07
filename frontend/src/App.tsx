import { useState, useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import type { HospitalMeta, HospitalState, ChatMessage } from "./types";
import FloorMap from "./components/FloorMap";
import ChatConsole from "./components/ChatConsole";
import TelemetryFeed from "./components/TelemetryFeed";
import GisMap from "./components/GisMap";
import NetworkHealth from "./components/NetworkHealth";
import CyberSecurityPanel from "./components/CyberSecurityPanel";
import KpiDetailsPanel from "./components/KpiDetailsPanel";
import SensingVsTrackingPanel from "./components/SensingVsTrackingPanel";
import PrivacyFrameworkPanel from "./components/PrivacyFrameworkPanel";
import TimelineLogPanel from "./components/TimelineLogPanel";
import MultiAgentBrain from "./components/MultiAgentBrain";
import ExplanationGraph from "./components/ExplanationGraph";

const API_BASE = "https://9739acc9-4124-429c-b6dd-a2a80e320e6c-00-104s00nlz66h8.sisko.replit.dev/api";
const WS_BASE = "wss://9739acc9-4124-429c-b6dd-a2a80e320e6c-00-104s00nlz66h8.sisko.replit.dev/api/ws";

const TACTICAL_NAMES: Record<string, string> = {
  "Kitchen":       "Hangar Deck",
  "ICU-1":         "Recon Zone 1",
  "ICU-2":         "Recon Zone 2",
  "Staff-Station": "Command Bridge",
  "Ward-3":        "Storage Zone A",
  "Ward-4":        "Storage Zone B",
  "Corridor":      "Transit Corridor",
  "Exit-1":        "Escape Port A",
  "Exit-2":        "Escape Port B",
};

export default function App() {
  const [hospitals, setHospitals] = useState<HospitalMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>("metro_care");
  const [state, setState] = useState<HospitalState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [activeKpiTab, setActiveKpiTab] = useState<"assets" | "threats" | "temperature" | "prediction" | null>(null);
  const [activeConsoleTab, setActiveConsoleTab] = useState<"tactical" | "sigint" | "security" | "cognitive" | "analytics" | "settings">("tactical");
  const [booting, setBooting] = useState(true);
  const [predictiveTime, setPredictiveTime] = useState<number | null>(null);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [simLog, setSimLog] = useState<{ tick: number; time: string; msg: string }[]>([]);
  const [injectorRoom, setInjectorRoom] = useState<string>("Ward-3");
  const [injectorEvent, setInjectorEvent] = useState<string>("fire");
  const [bootLines, setBootLines] = useState<string[]>([]);  // Custom Simulator Parameters
  const [fireSpreadRate, setFireSpreadRate] = useState<number>(8.5);
  const [csiNoiseLevel, setCsiNoiseLevel] = useState<string>("moderate");
  const [occupantSpeed, setOccupantSpeed] = useState<string>("normal");
  const [convectionRate, setConvectionRate] = useState<number>(0.15);
  const [socialForceWeight, setSocialForceWeight] = useState<number>(1.5);
  const [desiredVelocity, setDesiredVelocity] = useState<number>(1.2);
  // Macro simulation automation
  const [isExecutingMacro, setIsExecutingMacro] = useState<boolean>(false);
  const [macroStepIndex, setMacroStepIndex] = useState<number>(-1);

  // Selected Room Inspector
  const [inspectedRoomId, setInspectedRoomId] = useState<string | null>(null);

  // Custom Scheduled Scenario Builder
  const [customScenarioEvents, setCustomScenarioEvents] = useState<{ id: number; delay: number; room: string; type: "fire" | "intruder" | "sensor_fail" | "fall" }[]>([]);
  const [isScenarioRunning, setIsScenarioRunning] = useState<boolean>(false);
  const [currentScenarioTick, setCurrentScenarioTick] = useState<number>(0);
  const [runningScenarioEvents, setRunningScenarioEvents] = useState<{ delay: number; room: string; type: string; triggered: boolean }[]>([]);
  
  // Custom scenario builder form inputs
  const [schedulerRoom, setSchedulerRoom] = useState<string>("Ward-3");
  const [schedulerEvent, setSchedulerEvent] = useState<"fire" | "intruder" | "sensor_fail" | "fall">("fire");
  const [schedulerDelay, setSchedulerDelay] = useState<number>(5);
  
  // Entity Spawner Form Inputs
  const [missionProgress, setMissionProgress] = useState<{
    missionNum: string;
    scenario: string;
    steps: { label: string; status: "done" | "active" | "todo" }[];
  } | null>({
    missionNum: "0000",
    scenario: "System Baseline Guard Scan",
    steps: [
      { label: "Sensor AI collecting CSI subcarriers", status: "done" },
      { label: "Security AI verifying credentials", status: "done" },
      { label: "Medical AI scanning respiration BPMs", status: "done" },
      { label: "A* Pathfinding AI verifying safe exit corridors", status: "done" },
      { label: "Commander AI maintaining spatial safety", status: "done" }
    ]
  });
  
  // Real-time timeline log events state
  const [timelineEvents, setTimelineEvents] = useState<{ id: number; time: string; msg: string; type: "info" | "warning" | "alert" }[]>([]);

  // Startup typewriter terminal simulation sequence
  useEffect(() => {
    const sequences = [
      "AETHER OS v4.8 ONLINE...",
      "SCANNING ENVIRONMENT OVER COHERENT CSI WAVEFORMS...",
      "BUILDING DIGITAL TWIN SYNCHRONIZED...",
      "8 SECURE OCCUPANTS LOCATED IN SECTOR GRID...",
      "NO THREAT VECTORS DETECTED IN AMBIECE.",
      "AETHER IS ACTIVE AND MONITORING."
    ];

    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < sequences.length) {
        setBootLines(prev => [...prev, sequences[currentLine]]);
        currentLine++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setBooting(false);
        }, 600);
      }
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // Fetch all sectors metadata (GIS Map)
  const fetchHospitals = async () => {
    try {
      const res = await fetch(`${API_BASE}/hospitals`);
      if (!res.ok) throw new Error("Failed to fetch sector list");
      const data = await res.json();
      setHospitals(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch detailed state for selected sector
  const fetchHospitalState = async (hid: string) => {
    try {
      const res = await fetch(`${API_BASE}/hospitals/${hid}/state`);
      if (!res.ok) throw new Error("Failed to fetch sector state");
      const data: HospitalState = await res.json();
      setState(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Could not connect to AETHER Network Engine. Make sure the backend server is running.");
    }
  };

  // Fetch heatmap for selected sector
  const fetchHeatmap = async (hid: string) => {
    try {
      const res = await fetch(`${API_BASE}/history/heatmap?hospital_id=${hid}`);
      if (res.ok) {
        const data = await res.json();
        setHeatmap(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch chat history for selected sector
  const fetchChatHistory = async (hid: string) => {
    try {
      const res = await fetch(`${API_BASE}/history/chat?hospital_id=${hid}`);
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Initial load: fetch simulation status, campuses, and initial selected sector data
  useEffect(() => {
    const initApp = async () => {
      try {
        const res = await fetch(`${API_BASE}/simulation/status`);
        if (res.ok) {
          const data = await res.json();
          setIsPlaying(data.is_playing);
          setSimSpeed(data.sim_speed);
          if (data.fire_spread_rate !== undefined) setFireSpreadRate(data.fire_spread_rate);
          if (data.csi_noise_level !== undefined) setCsiNoiseLevel(data.csi_noise_level);
          if (data.occupant_speed !== undefined) setOccupantSpeed(data.occupant_speed);
          if (data.convection_rate !== undefined) setConvectionRate(data.convection_rate);
          if (data.social_force_weight !== undefined) setSocialForceWeight(data.social_force_weight);
          if (data.desired_velocity !== undefined) setDesiredVelocity(data.desired_velocity);
        }
      } catch (err) {
        console.error("Error fetching simulation status on init:", err);
      }
      fetchHospitals();
      fetchHospitalState(selectedId);
      fetchHeatmap(selectedId);
      fetchChatHistory(selectedId);
    };
    initApp();
  }, []);

  // When selected sector changes, sync non-WS states
  useEffect(() => {
    fetchHospitalState(selectedId);
    fetchHeatmap(selectedId);
    fetchChatHistory(selectedId);
  }, [selectedId]);

  // WebSocket Connection Hook with graceful HTTP polling fallback
  useEffect(() => {
    let ws: WebSocket | null = null;
    let fallbackInterval: any = null;
    let isMounted = true;

    const connectWs = () => {
      if (!isMounted) return;
      const wsUrl = `${WS_BASE}/${selectedId}`;
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMounted) return;
        console.log(`WebSocket connected for sector: ${selectedId}`);
        setIsWsConnected(true);
        setError(null);
        if (fallbackInterval) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data: HospitalState = JSON.parse(event.data);
          setState(data);
          // Refresh hospital list for active alerts badge count
          fetchHospitals();
        } catch (err) {
          console.error("WebSocket message parsing error:", err);
        }
      };

      ws.onclose = (event) => {
        if (!isMounted) return;
        console.log(`WebSocket closed for sector: ${selectedId}. Code: ${event.code}`);
        setIsWsConnected(false);
        
        // Start polling fallback if disconnected unexpectedly
        if (event.code !== 1000 && !fallbackInterval) {
          console.log("WebSocket connection lost. Starting fallback HTTP polling...");
          startFallbackPolling();
        }

        // Retry connection after 5 seconds
        setTimeout(() => {
          if (isMounted && !ws && !isWsConnected) {
            connectWs();
          }
        }, 5000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        if (isMounted) {
          setIsWsConnected(false);
        }
      };
    };

    const startFallbackPolling = () => {
      if (fallbackInterval) clearInterval(fallbackInterval);
      fallbackInterval = setInterval(() => {
        fetchHospitalState(selectedId);
      }, 1500);
    };

    connectWs();

    return () => {
      isMounted = false;
      if (ws) ws.close(1000, "Component unmounted");
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [selectedId]);

  // Decoupled tick-reactive logger and heatmap updater
  useEffect(() => {
    if (!state) return;
    const nowStr = new Date().toISOString().slice(11, 19);
    const logMsg = state.hazards.length > 0
      ? `TICK #${state.step} — ${state.hazards.length} active hazard(s), ${state.occupants.length} assets tracked`
      : `TICK #${state.step} — All zones nominal, ${state.occupants.length} assets tracked`;

    setSimLog(prev => {
      if (prev.length > 0 && prev[prev.length - 1].tick === state.step) {
        return prev;
      }
      return [...prev, { tick: state.step, time: nowStr, msg: logMsg }].slice(-100);
    });

    if (state.step % 5 === 0) {
      fetchHeatmap(selectedId);
    }
  }, [state?.step, selectedId]);

  // Handle timeline event appending on state tick / change
  useEffect(() => {
    if (!state) return;
    const nowStr = new Date().toISOString().slice(11, 19);

    if (state.step === 0) {
      setTimelineEvents([
        { id: 1, time: nowStr, msg: `Sector linked: ${state.name} surveillance locked`, type: "info" },
        { id: 2, time: nowStr, msg: "CSI Subcarrier grid tracking active (160MHz)", type: "info" }
      ]);
      return;
    }

    const newEvents: { id: number; time: string; msg: string; type: "info" | "warning" | "alert" }[] = [];

    // Check if new alerts appeared
    state.alerts.forEach((alert, i) => {
      newEvents.push({
        id: Date.now() + i + 100,
        time: nowStr,
        msg: `ALERT: ${alert.message} in ${alert.room_id}`,
        type: "alert"
      });
    });

    // Check if predictions exist
    state.predictions.forEach((pred, i) => {
      newEvents.push({
        id: Date.now() + i + 200,
        time: nowStr,
        msg: `Risk Vector: Impending ${pred.alert_type.replace("_", " ")} (${(pred.probability * 100).toFixed(0)}% prob)`,
        type: "warning"
      });
    });

    // General classification sweep logs
    if (state.step % 3 === 0) {
      newEvents.push({
        id: Date.now() + 300,
        time: nowStr,
        msg: `Multipath fading sweep complete. ${state.occupants.length} assets tracked.`,
        type: "info"
      });
    }

    if (newEvents.length > 0) {
      setTimelineEvents(prev => {
        const combined = [...prev, ...newEvents];
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.msg === v.msg) === i);
        return unique.slice(-35);
      });
    }
  }, [state?.step, state?.id]);

  const handleConfigureSimulation = async (
    fireRate: number,
    noise: string,
    speed: string,
    convRate: number = convectionRate,
    sfWeight: number = socialForceWeight,
    desVel: number = desiredVelocity
  ) => {
    try {
      const res = await fetch(`${API_BASE}/simulation/configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fire_spread_rate: fireRate,
          csi_noise_level: noise,
          occupant_speed: speed,
          convection_rate: convRate,
          social_force_weight: sfWeight,
          desired_velocity: desVel
        })
      });
      if (res.ok) {
        const data = await res.json();
        setFireSpreadRate(data.fire_spread_rate);
        setCsiNoiseLevel(data.csi_noise_level);
        setOccupantSpeed(data.occupant_speed);
        setConvectionRate(data.convection_rate);
        setSocialForceWeight(data.social_force_weight);
        setDesiredVelocity(data.desired_velocity);
        setSimLog(prev => [...prev, {
          tick: state?.step || 0,
          time: new Date().toISOString().slice(11, 19),
          msg: `CONFIG UPDATE — CA Convection: ${data.convection_rate.toFixed(2)}, SFM Repulsion: ${data.social_force_weight.toFixed(1)}, Speed Limit: ${data.desired_velocity.toFixed(1)}m/s`
        }]);
      }
    } catch (err) {
      console.error("Error updating simulator config:", err);
    }
  };

  const runMacro = async (macroName: string) => {
    if (isExecutingMacro) return;
    setIsExecutingMacro(true);
    setMacroStepIndex(0);
    setSimLog(prev => [...prev, { tick: state?.step || 0, time: new Date().toISOString().slice(11, 19), msg: `MACRO START: ${macroName}` }]);

    try {
      if (macroName === "Intruder Drill") {
        setMacroStepIndex(1);
        await handleTriggerIntruder("Staff-Station");
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        setMacroStepIndex(2);
        await handleSetSpeed(5);
        
        await new Promise(resolve => setTimeout(resolve, 4000));
        setMacroStepIndex(3);
        await handlePause();
        setSimLog(prev => [...prev, { tick: state?.step || 0, time: new Date().toISOString().slice(11, 19), msg: "MACRO COMPLETE: Intruder Drill" }]);
      } else if (macroName === "Evacuation Cascade") {
        setMacroStepIndex(1);
        await handleTriggerFire("Ward-3");
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        setMacroStepIndex(2);
        await handleTriggerSensorFail("ICU-1");

        await new Promise(resolve => setTimeout(resolve, 2000));
        setMacroStepIndex(3);
        const patient = state?.occupants.find(o => o.role === "patient");
        if (patient) {
          await handleTriggerFall(patient.entity_id);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        setMacroStepIndex(4);
        await handleSetSpeed(2);
        setSimLog(prev => [...prev, { tick: state?.step || 0, time: new Date().toISOString().slice(11, 19), msg: "MACRO COMPLETE: Evacuation Cascade" }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExecutingMacro(false);
      setMacroStepIndex(-1);
    }
  };

  // Custom scheduled scenario runner loop
  useEffect(() => {
    if (!isScenarioRunning || !state) return;

    setCurrentScenarioTick(prev => {
      const nextTick = prev + 1;
      
      const updatedEvents = [...runningScenarioEvents];
      let triggeredAny = false;

      updatedEvents.forEach(evt => {
        if (evt.delay === nextTick && !evt.triggered) {
          evt.triggered = true;
          triggeredAny = true;
          
          setSimLog(prevLog => [...prevLog, { 
            tick: state.step, 
            time: new Date().toISOString().slice(11, 19), 
            msg: `TIMELINE DRILL: Triggering ${evt.type.toUpperCase()} in ${evt.room}` 
          }]);

          if (evt.type === "fire") {
            handleTriggerFire(evt.room);
          } else if (evt.type === "intruder") {
            handleTriggerIntruder(evt.room);
          } else if (evt.type === "sensor_fail") {
            handleTriggerSensorFail(evt.room);
          } else if (evt.type === "fall") {
            const occupant = state.occupants.find(o => o.current_room === evt.room);
            if (occupant) {
              handleTriggerFall(occupant.entity_id);
            } else {
              setSimLog(prevLog => [...prevLog, { 
                tick: state.step, 
                time: new Date().toISOString().slice(11, 19), 
                msg: `TIMELINE DRILL WARN: No occupants in ${evt.room} to fall.` 
              }]);
            }
          }
        }
      });

      if (triggeredAny) {
        setRunningScenarioEvents(updatedEvents);
      }

      const allTriggered = updatedEvents.every(e => e.triggered);
      if (allTriggered) {
        setIsScenarioRunning(false);
        setSimLog(prevLog => [...prevLog, { 
          tick: state.step, 
          time: new Date().toISOString().slice(11, 19), 
          msg: "TIMELINE DRILL COMPLETE — All scheduled events triggered." 
        }]);
      }

      return nextTick;
    });
  }, [state?.step, isScenarioRunning]);

  const handleResume = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start simulation");
      const data = await res.json();
      setIsPlaying(data.is_playing);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartCustomScenario = async () => {
    if (customScenarioEvents.length === 0) return;
    
    if (!isPlaying) {
      await handleResume();
    }
    
    setCurrentScenarioTick(0);
    setRunningScenarioEvents(customScenarioEvents.map(e => ({
      delay: e.delay,
      room: e.room,
      type: e.type,
      triggered: false
    })));
    setIsScenarioRunning(true);
  };

  // Actions

  const handlePause = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/pause`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to pause simulation");
      const data = await res.json();
      setIsPlaying(data.is_playing);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetSpeed = async (speed: number) => {
    try {
      const res = await fetch(`${API_BASE}/simulation/speed?speed=${speed}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to set simulation speed");
      const data = await res.json();
      setSimSpeed(data.sim_speed);
      setIsPlaying(data.is_playing);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSingleTick = async () => {
    try {
      const res = await fetch(`${API_BASE}/tick?active_id=${selectedId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to tick simulation");
      const data: HospitalState = await res.json();
      setState(data);
      fetchHospitals();
      fetchHeatmap(selectedId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch(`${API_BASE}/reset?active_id=${selectedId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset");
      const data: HospitalState = await res.json();
      setState(data);
      setIsPlaying(false);
      fetchHospitals();
      setHeatmap({});
      setChatHistory([]);
      setSimLog(prev => [...prev, { tick: 0, time: new Date().toISOString().slice(11, 19), msg: "SIMULATION RESET — All states cleared" }]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerIntruder = async (roomId: string) => {
    try {
      const res = await fetch(`${API_BASE}/trigger/intruder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospital_id: selectedId, target: roomId }),
      });
      if (!res.ok) throw new Error("Failed to trigger intruder");
      const data: HospitalState = await res.json();
      setState(data);
      fetchHospitals();
      setSimLog(prev => [...prev, { tick: data.step, time: new Date().toISOString().slice(11, 19), msg: `INTRUDER INJECTED in ${roomId}` }]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerSensorFail = async (roomId: string) => {
    try {
      const res = await fetch(`${API_BASE}/trigger/sensor_fail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospital_id: selectedId, target: roomId }),
      });
      if (!res.ok) throw new Error("Failed to trigger sensor failure");
      const data: HospitalState = await res.json();
      setState(data);
      fetchHospitals();
      setSimLog(prev => [...prev, { tick: data.step, time: new Date().toISOString().slice(11, 19), msg: `SENSOR NODE FAILURE in ${roomId}` }]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerFall = async (entityId: string) => {
    try {
      const res = await fetch(`${API_BASE}/trigger/fall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospital_id: selectedId, target: entityId }),
      });
      if (!res.ok) throw new Error("Failed to trigger fall");
      const data: HospitalState = await res.json();
      setState(data);
      fetchHospitals();
      fetchHeatmap(selectedId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerFire = async (roomId: string) => {
    try {
      const res = await fetch(`${API_BASE}/trigger/fire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospital_id: selectedId, target: roomId }),
      });
      if (!res.ok) throw new Error("Failed to trigger fire");
      const data: HospitalState = await res.json();
      setState(data);
      fetchHospitals();
      fetchHeatmap(selectedId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerEvacSequence = async () => {
    try {
      // 1. Initial state setup - starting mission progress tracker
      setMissionProgress({
        missionNum: "0248",
        scenario: "Storage Zone A Fire Anomaly Evacuation",
        steps: [
          { label: "Sensor AI collecting CSI subcarriers", status: "active" },
          { label: "Security AI verifying credentials", status: "todo" },
          { label: "Medical AI scanning respiration BPMs", status: "todo" },
          { label: "A* Pathfinding AI verifying safe exit corridors", status: "todo" },
          { label: "Commander AI maintaining spatial safety", status: "todo" }
        ]
      });

      // 2. Trigger Fire Anomaly on backend in Ward-3 (Storage Zone A)
      const res = await fetch(`${API_BASE}/trigger/fire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospital_id: selectedId, target: "Ward-3" }),
      });
      if (!res.ok) throw new Error("Failed to trigger fire evacuation");
      const data: HospitalState = await res.json();
      setState(data);
      fetchHospitals();
      fetchHeatmap(selectedId);

      // 3. Animate specialized AI agents' collaborative checks step by step
      setTimeout(() => {
        setMissionProgress(prev => {
          if (!prev) return null;
          return {
            ...prev,
            steps: [
              { label: "Sensor AI collecting CSI subcarriers", status: "done" },
              { label: "Security AI verifying credentials", status: "active" },
              { label: "Medical AI scanning respiration BPMs", status: "todo" },
              { label: "A* Pathfinding AI verifying safe exit corridors", status: "todo" },
              { label: "Commander AI maintaining spatial safety", status: "todo" }
            ]
          };
        });
      }, 800);

      setTimeout(() => {
        setMissionProgress(prev => {
          if (!prev) return null;
          return {
            ...prev,
            steps: [
              { label: "Sensor AI collecting CSI subcarriers", status: "done" },
              { label: "Security AI verifying credentials", status: "done" },
              { label: "Medical AI scanning respiration BPMs", status: "active" },
              { label: "A* Pathfinding AI verifying safe exit corridors", status: "todo" },
              { label: "Commander AI maintaining spatial safety", status: "todo" }
            ]
          };
        });
      }, 1600);

      setTimeout(() => {
        setMissionProgress(prev => {
          if (!prev) return null;
          return {
            ...prev,
            steps: [
              { label: "Sensor AI collecting CSI subcarriers", status: "done" },
              { label: "Security AI verifying credentials", status: "done" },
              { label: "Medical AI scanning respiration BPMs", status: "done" },
              { label: "A* Pathfinding AI verifying safe exit corridors", status: "active" },
              { label: "Commander AI maintaining spatial safety", status: "todo" }
            ]
          };
        });
      }, 2400);

      setTimeout(() => {
        setMissionProgress(prev => {
          if (!prev) return null;
          return {
            ...prev,
            steps: [
              { label: "Sensor AI collecting CSI subcarriers", status: "done" },
              { label: "Security AI verifying credentials", status: "done" },
              { label: "Medical AI scanning respiration BPMs", status: "done" },
              { label: "A* Pathfinding AI verifying safe exit corridors", status: "done" },
              { label: "Commander AI maintaining spatial safety", status: "active" }
            ]
          };
        });
      }, 3200);

      setTimeout(() => {
        setMissionProgress(prev => {
          if (!prev) return null;
          return {
            ...prev,
            steps: [
              { label: "Sensor AI collecting CSI subcarriers", status: "done" },
              { label: "Security AI verifying credentials", status: "done" },
              { label: "Medical AI scanning respiration BPMs", status: "done" },
              { label: "A* Pathfinding AI verifying safe exit corridors", status: "done" },
              { label: "Commander AI maintaining spatial safety", status: "done" }
            ]
          };
        });
      }, 4000);

    } catch (err) {
      console.error(err);
    }
  };

  const handlePredictivePlayback = () => {
    if (predictiveTime !== null) return;
    let t = 0;
    setPredictiveTime(0);
    const timer = setInterval(() => {
      t += 1;
      if (t <= 60) {
        setPredictiveTime(t);
      } else {
        clearInterval(timer);
        setPredictiveTime(null);
      }
    }, 60);
  };

  const handleSendMessage = async (msg: string) => {
    setIsSendingChat(true);
    setChatHistory(prev => [...prev, { role: "user", content: msg }]);

    const lower = msg.toLowerCase();
    if (lower.includes("fire") || lower.includes("evacuate") || lower.includes("start")) {
      // Trigger actual evacuation sequence & fire simulation
      await handleTriggerEvacSequence();
      
      // Inject the scifi predictive operator reply block in chat history
      setTimeout(() => {
        setChatHistory(prev => [...prev, {
          role: "agent",
          content: `AETHER ONLINE • COGNITIVE SANDBOX
Running predictive A* (A-Star) Dynamic incident simulation...

[Estimated Smoke Spread]: 72 seconds
[Exit A Blocked]: after 48 seconds (structural obstruction predicted)
[A* Computed Evac Route]: Escape Port B (Exit-2) avoiding hazard zones
[Estimated Evacuation Time]: 2m 14s
[Expected Survival Rate]: 99.4% (using EKF tracking)

Status: A* dynamic routes mapped and broadcasted to response drones.`
        }]);
        setIsSendingChat(false);
      }, 900);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, hospital_id: selectedId }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data.history);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: "agent", content: "Connection error with Gemini agent." }]);
    } finally {
      setIsSendingChat(false);
    }
  };

  if (error || !state) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", textAlign: "center" }}>
        <AlertOctagon size={48} style={{ color: "var(--red)", marginBottom: "1rem" }} />
        <h2>AETHER OS Server Connection Error</h2>
        <p style={{ color: "var(--text-muted)", margin: "0.5rem 0 1.5rem 0", maxWidth: "450px" }}>
          {error || "Connecting to regional AETHER network node..."}
        </p>
        <button onClick={() => fetchHospitalState(selectedId)} className="btn btn-accent" style={{ padding: "0.6rem 1.5rem" }}>
          Retry Connection
        </button>
      </div>
    );
  }

  // Calculate metrics
  const activeHospital = hospitals.find(x => x.id === selectedId);
  const avgTemp = state.rooms.reduce((acc: number, r: any) => acc + r.temperature, 0) / state.rooms.length;

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="boot-console">
          <div className="boot-line-header">AETHER OS v4.8 ONLINE</div>
          {bootLines.map((line, idx) => (
            <div key={idx} className="boot-line">
              &gt; {line}
            </div>
          ))}
          <div className="boot-line">
            &gt; Initializing neural space sweeps...<span className="terminal-cursor" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
      {/* 🛰️ Left Sidebar Navigation (Linear / Apple style) */}
      <aside style={{
        width: "240px",
        background: "rgba(8, 8, 12, 0.95)",
        borderRight: "1px solid var(--border)",
        padding: "1.5rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        flexShrink: 0
      }}>
        {/* Branding header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingLeft: "0.25rem" }}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="AETHER OS Logo" style={{ height: "30px", width: "30px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: "bold", fontSize: "1.05rem", color: "#fff", letterSpacing: "-0.015em" }}>AETHER OS</span>
            <span style={{ fontSize: "0.52rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Space AI Engine</span>
          </div>
        </div>

        {/* Dynamic Sweep / Stream counters */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "6px",
          padding: "0.55rem 0.75rem",
          fontSize: "0.68rem",
          color: "var(--text-muted)",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Uplink Sweep:</span>
            <span style={{ fontFamily: "JetBrains Mono", color: "#fff" }}>#{state.step}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Stream Time:</span>
            <span style={{ fontFamily: "JetBrains Mono", color: "var(--accent)" }}>{state.sim_time}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.15rem" }}>
            <span>Uplink Status:</span>
            <span style={{
              fontSize: "0.65rem",
              fontWeight: "bold",
              color: isWsConnected ? "var(--green)" : "var(--amber)",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem"
            }}>
              <span className={`status-dot ${isWsConnected ? "live" : "polling"}`} />
              {isWsConnected ? "LIVE" : "POLLING"}
            </span>
          </div>
        </div>

        {/* Sidebar Nav buttons */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1 }}>
          {[
            { id: "tactical" as const, label: "Operations Dashboard", icon: "🛰️" },
            { id: "sigint" as const, label: "RF Sensing", icon: "📡" },
            { id: "cognitive" as const, label: "AI Reasoning Hub", icon: "🧠" },
            { id: "security" as const, label: "Cyber Security", icon: "🛡️" },
            { id: "analytics" as const, label: "Analytics", icon: "📊" },
            { id: "settings" as const, label: "Simulation Console", icon: "⚙️" }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveConsoleTab(item.id);
                setActiveKpiTab(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.6rem 0.85rem",
                background: activeConsoleTab === item.id ? "rgba(255,255,255,0.04)" : "transparent",
                border: "none",
                borderRadius: "6px",
                color: activeConsoleTab === item.id ? "#fff" : "var(--text-muted)",
                textAlign: "left",
                fontSize: "0.8rem",
                fontWeight: activeConsoleTab === item.id ? "600" : "normal",
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar footer credits */}
        <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", paddingLeft: "0.25rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
          <div>Inventor: Harsh</div>
          <div style={{ color: "var(--accent)", marginTop: "0.1rem" }}>Patent Pending</div>
        </div>
      </aside>

      {/* 🖥️ Main Workspace Container */}
      <main style={{
        flex: 1,
        padding: "2.25rem 3rem",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        background: "#060609"
      }}>
        {/* Error notification header */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--red)" }}>
            {error}
          </div>
        )}

        {/* KPI Details Drawers (Progressive disclosure popup overlay) */}
        <KpiDetailsPanel
          activeTab={activeKpiTab}
          onClose={() => setActiveKpiTab(null)}
          occupants={state.occupants}
          rooms={state.rooms}
          alerts={state.alerts}
          predictions={state.predictions}
          sectorName={state.name}
        />

        {/* 1. OPERATIONS DASHBOARD WORKSPACE (Minimalist, Digital Twin Hero) */}
        {activeConsoleTab === "tactical" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Minimalist Top Branding Header & Inline KPIs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: "bold", letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
                  Operations Dashboard — {state.name.toUpperCase()}
                </h2>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0.2rem 0 0 0" }}>
                  Active physical space operating system logs
                </p>
              </div>

              {/* Progressively Disclosable Inline KPI Badges & Evacuation simulator */}
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.76rem" }}>
                  <span 
                    onClick={() => setActiveKpiTab("assets")}
                    style={{ cursor: "pointer", color: "var(--accent)", borderBottom: "1.5px dashed var(--accent)" }}
                  >
                    {state.occupants.length} Occupants
                  </span>
                  <span 
                    style={{ color: "var(--green)", fontWeight: "bold" }}
                  >
                    AETHER: MONITORING • LEARNING • PREDICTING • READY
                  </span>
                  <span 
                    onClick={() => setActiveKpiTab("temperature")}
                    style={{ cursor: "pointer", color: "var(--amber)", borderBottom: "1.5px dashed var(--amber)" }}
                  >
                    {avgTemp.toFixed(0)}°C Heat Index
                  </span>
                </div>

                <button 
                  onClick={handlePredictivePlayback}
                  className="btn btn-accent"
                  disabled={predictiveTime !== null}
                  style={{
                    padding: "0.4rem 0.85rem",
                    fontSize: "0.72rem",
                    fontWeight: "bold",
                    background: predictiveTime !== null ? "var(--border-subtle)" : "linear-gradient(135deg, var(--accent), #8b5cf6)",
                    border: "none",
                    borderRadius: "4px",
                    color: "#fff",
                    cursor: predictiveTime !== null ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    boxShadow: "0 0 10px rgba(59,130,246,0.2)"
                  }}
                >
                  🔮 Forecast Next 60s
                </button>

                <button 
                  onClick={handleTriggerEvacSequence}
                  className="btn btn-accent"
                  style={{
                    padding: "0.4rem 0.85rem",
                    fontSize: "0.72rem",
                    fontWeight: "bold",
                    background: "linear-gradient(135deg, var(--red), var(--amber))",
                    border: "none",
                    borderRadius: "4px",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    boxShadow: "0 0 10px rgba(239,68,68,0.2)"
                  }}
                >
                  ⚡ Simulate Evacuation
                </button>
              </div>
            </div>

            {/* Environmental Live Gauge Matrix */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>
              {/* Gauge 1: Spatial Safety Factor */}
              <div className="glass-card" style={{ padding: "0.85rem 1rem", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                  Spatial Safety Factor
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "1.35rem", fontWeight: "bold", color: state.hazards.length > 0 ? "var(--red)" : "var(--green)" }}>
                    {Math.max(0, 100 - state.hazards.length * 25).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono" }}>
                    {state.hazards.length} THREATS ACTIVE
                  </span>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.02)", borderRadius: "2px", overflow: "hidden", marginTop: "0.4rem" }}>
                  <div style={{
                    width: `${Math.max(0, 100 - state.hazards.length * 25)}%`,
                    height: "100%",
                    background: state.hazards.length > 0 ? "var(--red)" : "var(--green)",
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>

              {/* Gauge 2: Evacuation Port Status */}
              <div className="glass-card" style={{ padding: "0.85rem 1rem", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                  Evacuation Port Status
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "1.35rem", fontWeight: "bold", color: "var(--accent)" }}>
                    {((state.rooms.filter(r => r.room_type === "exit" && !r.is_hazard).length / 2) * 100).toFixed(0)}% CLEAR
                  </span>
                  <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono" }}>
                    {state.rooms.filter(r => r.room_type === "exit" && r.is_hazard).length} PORTS BLOCKED
                  </span>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.02)", borderRadius: "2px", overflow: "hidden", marginTop: "0.4rem" }}>
                  <div style={{
                    width: `${(state.rooms.filter(r => r.room_type === "exit" && !r.is_hazard).length / 2) * 100}%`,
                    height: "100%",
                    background: "var(--accent)",
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>

              {/* Gauge 3: Ambient Thermal Stress */}
              <div className="glass-card" style={{ padding: "0.85rem 1rem", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                  Mean Ambient Thermal Stress
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "1.35rem", fontWeight: "bold", color: avgTemp > 30 ? "var(--amber)" : "#fff" }}>
                    {avgTemp.toFixed(1)} °C
                  </span>
                  <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono" }}>
                    {state.rooms.filter(r => r.temperature > 30).length} OVERHEATED ZONES
                  </span>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.02)", borderRadius: "2px", overflow: "hidden", marginTop: "0.4rem" }}>
                  <div style={{
                    width: `${Math.min(100, (avgTemp / 100) * 100)}%`,
                    height: "100%",
                    background: avgTemp > 30 ? "var(--amber)" : "var(--accent)",
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>
            </div>

            {/* HERO DIGITAL TWIN CANVAS WITH INLINE ROOM INSPECTOR */}
            <div style={{ display: "grid", gridTemplateColumns: inspectedRoomId ? "1.6fr 1.05fr" : "1fr", gap: "1.25rem" }}>
              <div className="panel-card" style={{
                flex: 1,
                minHeight: "460px",
                display: "flex",
                flexDirection: "column",
                background: "rgba(8, 8, 12, 0.4)",
                border: "1px solid var(--border-subtle)",
                marginBottom: 0,
                padding: "1.25rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div>
                    <h3 className="panel-title" style={{ fontSize: "0.85rem", color: "#fff", margin: 0 }}>LIVE DIGITAL TWIN</h3>
                    <p className="panel-subtitle" style={{ margin: 0 }}>CSI subcarrier spatial tracking nodes (Click rooms to inspect)</p>
                  </div>
                  {inspectedRoomId && (
                    <button 
                      onClick={() => setInspectedRoomId(null)}
                      style={{
                        padding: "0.2rem 0.5rem", fontSize: "0.62rem", background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer"
                      }}
                    >
                      Clear Inspection ×
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, minHeight: "380px", position: "relative" }}>
                   <FloorMap
                     rooms={state.rooms}
                     occupants={state.occupants}
                     hazards={state.hazards}
                     connections={state.connections}
                     actions={state.actions}
                     predictiveTime={predictiveTime}
                     onRoomClick={(roomId) => setInspectedRoomId(roomId)}
                     selectedRoomId={inspectedRoomId}
                   />
                </div>
              </div>

              {/* Live Room Inspector Panel */}
              {inspectedRoomId && (() => {
                const room = state.rooms.find(r => r.room_id === inspectedRoomId);
                const roomOccs = state.occupants.filter(o => o.current_room === inspectedRoomId);
                const isRoomHaz = state.hazards.includes(inspectedRoomId);
                
                if (!room) return null;
                const name = TACTICAL_NAMES[inspectedRoomId] || inspectedRoomId;

                return (
                  <div className="panel-card" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "0.85rem", background: "rgba(8, 8, 12, 0.75)" }}>
                    <div>
                      <span style={{ fontSize: "0.55rem", color: "var(--accent)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        TELEMETRY INSPECT
                      </span>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: "bold", color: "#fff", margin: "0.15rem 0 0 0" }}>
                        {name.toUpperCase()}
                      </h3>
                      <span style={{ fontSize: "0.62rem", fontFamily: "JetBrains Mono", color: "var(--text-dim)" }}>
                        ID: {inspectedRoomId} | Type: {room.room_type.toUpperCase()}
                      </span>
                    </div>

                    {/* Room Stats */}
                    <div style={{ background: "#040406", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.65rem", display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.7rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                        <span style={{ color: "var(--text-dim)" }}>Zone Status:</span>
                        <span style={{ color: isRoomHaz ? "var(--red)" : "var(--green)", fontWeight: "bold" }}>
                          {isRoomHaz ? "⚠ HAZARD ACTIVE" : "✓ NOMINAL SCAN"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                        <span style={{ color: "var(--text-dim)" }}>Temperature:</span>
                        <span style={{ color: room.temperature > 40 ? "var(--red)" : "#fff", fontWeight: "bold", fontFamily: "JetBrains Mono" }}>
                          {room.temperature.toFixed(1)} °C
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.2rem" }}>
                        <span style={{ color: "var(--text-dim)" }}>Smoke Level:</span>
                        <span style={{ color: room.smoke_ppm > 50 ? "var(--amber)" : "#fff", fontWeight: "bold", fontFamily: "JetBrains Mono" }}>
                          {room.smoke_ppm.toFixed(0)} PPM
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-dim)" }}>Occupants inside:</span>
                        <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
                          {roomOccs.length} units
                        </span>
                      </div>
                    </div>

                    {/* Room Occupants list */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Units in Zone ({roomOccs.length})
                      </div>
                      <div style={{
                        flex: 1, overflowY: "auto", maxHeight: "120px", display: "flex", flexDirection: "column", gap: "0.35rem"
                      }}>
                        {roomOccs.length === 0 ? (
                          <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", padding: "0.3rem 0" }}>No tracked bodies in this zone.</div>
                        ) : (
                          roomOccs.map(occ => (
                            <div key={occ.entity_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", padding: "0.35rem 0.5rem", borderRadius: "4px", fontSize: "0.68rem" }}>
                              <div>
                                <strong style={{ color: occ.role === "patient" ? "var(--accent)" : occ.role === "nurse" ? "var(--green)" : "var(--amber)" }}>
                                  {occ.entity_id.toUpperCase()}
                                </strong>
                                <div style={{ fontSize: "0.55rem", color: "var(--text-dim)" }}>Role: {occ.role} | Posture: {occ.posture}</div>
                              </div>
                              <span style={{ fontFamily: "JetBrains Mono", fontWeight: "bold", color: occ.posture === "fallen" ? "var(--red)" : "var(--green)" }}>
                                {occ.breathing_rate ? `${occ.breathing_rate.toFixed(0)} BPM` : "—"}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Direct Injection Buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Direct Zone Triggers
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                        <button 
                          onClick={() => handleTriggerFire(inspectedRoomId)}
                          style={{ padding: "0.3rem", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", color: "#f87171", fontSize: "0.62rem", cursor: "pointer", fontWeight: "bold" }}
                        >
                          🔥 Ignite Fire
                        </button>
                        <button 
                          onClick={() => handleTriggerIntruder(inspectedRoomId)}
                          style={{ padding: "0.3rem", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "4px", color: "var(--amber)", fontSize: "0.62rem", cursor: "pointer", fontWeight: "bold" }}
                        >
                          👤 Drop Intruder
                        </button>
                      </div>
                      <button 
                        onClick={() => handleTriggerSensorFail(inspectedRoomId)}
                        style={{ width: "100%", padding: "0.35rem", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "4px", color: "#60a5fa", fontSize: "0.62rem", cursor: "pointer", fontWeight: "bold" }}
                      >
                        📡 Fail CSI Sensor Node
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Bottom Support Info Grid Row (Progressive disclosure quadrants) */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: "1.25rem" }}>
              
              {/* Col 1: AETHER AI Core (first-person voice) + Live Mission tracker */}
              <div className="panel-card" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <h4 style={{ color: "var(--accent)", fontSize: "0.72rem", fontWeight: "bold", textTransform: "uppercase", margin: "0 0 0.35rem 0", letterSpacing: "0.03em" }}>
                    AETHER AI Core
                  </h4>
                  {state.alerts.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      <p style={{ fontSize: "0.71rem", lineHeight: "1.45", margin: 0, color: "#fff", background: "rgba(239,68,68,0.03)", borderLeft: "2px solid var(--red)", padding: "0.4rem 0.5rem", borderRadius: "2px" }}>
                        "I have detected a thermal anomaly in Storage Zone A. Exit A is compromised. I am calculating safest route vectors. Directing civilians and drones to Exit B via Transit Corridor."
                      </p>
                      
                      <div style={{ 
                        background: "rgba(0,0,0,0.4)", 
                        border: "1px dashed var(--border)", 
                        borderRadius: "4px", 
                        padding: "0.5rem", 
                        fontFamily: "JetBrains Mono, monospace", 
                        fontSize: "0.6rem", 
                        lineHeight: "1.5",
                        color: "var(--text-muted)"
                      }}>
                        <div style={{ color: "var(--accent)", fontWeight: "bold", marginBottom: "0.2rem" }}>AETHER COGNITIVE TRACE</div>
                        <div>[15:52:10] Attenuation increased in Storage Zone A (+12.4dB).</div>
                        <div>[15:52:11] Comparing against 842 historical signatures...</div>
                        <div>[15:52:12] Profile matches thermal combustion baseline (94.1%).</div>
                        <div style={{ color: "var(--green)" }}>✓ Classification verified: Fire Ignition (81%)</div>
                        <div>• Evacuation directive issued for escape routes.</div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.71rem", color: "var(--text-muted)", margin: 0 }}>
                      "All 9 spatial zones secure. Coherent CSI subcarriers nominal. I am actively protecting this space. Standing by."
                    </p>
                  )}
                </div>

                {missionProgress && (
                  <div style={{ borderTop: "1px dashed var(--border-subtle)", paddingTop: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: "bold", color: "var(--accent)", fontFamily: "JetBrains Mono" }}>
                        MISSION #{missionProgress.missionNum}
                      </span>
                      <span style={{ fontSize: "0.62rem", color: "var(--text-dim)", textTransform: "uppercase" }}>
                        {missionProgress.scenario}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.68rem" }}>
                      {missionProgress.steps.map((step, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ 
                            color: step.status === "done" ? "var(--green)" : step.status === "active" ? "var(--amber)" : "var(--text-dim)" 
                          }}>
                            {step.status === "done" ? "✓" : step.status === "active" ? "⟳" : "□"}
                          </span>
                          <span style={{ 
                            color: step.status === "done" ? "rgba(255,255,255,0.75)" : step.status === "active" ? "#fff" : "var(--text-dim)",
                            fontWeight: step.status === "active" ? "bold" : "normal"
                          }}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Col 2: Active Alerts */}
              <div className="panel-card" style={{ marginBottom: 0 }}>
                <h4 style={{ color: state.alerts.length > 0 ? "var(--red)" : "var(--green)", fontSize: "0.72rem", fontWeight: "bold", textTransform: "uppercase", margin: "0 0 0.35rem 0", letterSpacing: "0.03em" }}>
                  Active Alerts
                </h4>
                <div style={{ maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {state.alerts.length === 0 ? (
                    <div className="empty-state" style={{ padding: "0.5rem 0", fontSize: "0.68rem" }}>No active threat alerts.</div>
                  ) : (
                    state.alerts.map((a, i) => (
                      <div key={i} style={{ fontSize: "0.7rem", color: "#fff", background: "rgba(239,68,68,0.05)", borderLeft: "2px solid var(--red)", padding: "0.25rem" }}>
                        <strong>{a.type.toUpperCase()}:</strong> {a.message}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Col 3: Predictions */}
              <div className="panel-card" style={{ marginBottom: 0 }}>
                <h4 style={{ color: "var(--amber)", fontSize: "0.72rem", fontWeight: "bold", textTransform: "uppercase", margin: "0 0 0.35rem 0", letterSpacing: "0.03em" }}>
                  Impending Risks
                </h4>
                <div style={{ maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {state.predictions.length === 0 ? (
                    <div className="empty-state" style={{ padding: "0.5rem 0", fontSize: "0.68rem" }}>No predictive risks.</div>
                  ) : (
                    state.predictions.map((p, i) => (
                      <div key={i} style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        • {p.alert_type.replace("_", " ")} ({(p.probability * 100).toFixed(0)}%)
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Col 4: Timeline */}
              <TimelineLogPanel events={timelineEvents} />

            </div>
          </div>
        )}

        {/* 2. RF SENSING WORKSPACE */}
        {activeConsoleTab === "sigint" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "bold", letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
              Radio Frequency Sensing Diagnostics
            </h2>
            <SensingVsTrackingPanel rooms={state.rooms} occupants={state.occupants} />
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem" }}>
              <TelemetryFeed
                occupants={state.occupants}
                rooms={state.rooms}
                simTime={state.sim_time}
                step={state.step}
              />
              <div className="panel-card" style={{ marginBottom: 0 }}>
                <h3 className="panel-title">Active RF Diagnostics</h3>
                <p className="panel-subtitle">Calculated CSI Multipath Reflection Profiles</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.3rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Spatial Amplitude Decay:</span>
                    <span style={{ fontFamily: "JetBrains Mono" }}>-34.2 dB/m</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.3rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Frequency Selective Fading:</span>
                    <span style={{ fontFamily: "JetBrains Mono" }}>PASSIVE BAND NOMINAL</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.3rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>CSI Amplitude Phase Coherence:</span>
                    <span style={{ fontFamily: "JetBrains Mono", color: "var(--green)" }}>94.6% MATCH</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Multipath Delay Spread:</span>
                    <span style={{ fontFamily: "JetBrains Mono" }}>14.8 ns</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. AI REASONING WORKSPACE */}
        {activeConsoleTab === "cognitive" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "bold", letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
              Multi-Agent AI & Causal Reasoning Hub
            </h2>
            <ExplanationGraph state={state} />
            <MultiAgentBrain state={state} />
          </div>
        )}

        {/* 4. CYBER SECURITY WORKSPACE */}
        {activeConsoleTab === "security" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "bold", letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
              Cyber Intrusion Detection & Privacy Compliance
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
              <CyberSecurityPanel
                isActive={isPlaying}
                hasThreats={state.alerts.length > 0 || state.hazards.length > 0}
                step={state.step}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <PrivacyFrameworkPanel />
                {/* Cryptographic Logs card */}
                <div className="panel-card" style={{ marginBottom: 0 }}>
                  <h3 className="panel-title">Cryptographic Encryption Keys</h3>
                  <p className="panel-subtitle">Ephemeral key negotiation & payload hashes</p>
                  <div style={{
                    background: "#040406",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.6rem",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.62rem",
                    lineHeight: "1.6",
                    maxHeight: "260px",
                    overflowY: "auto",
                    marginTop: "0.5rem"
                  }}>
                    <div style={{ color: "var(--green)" }}>[LOG] Ephemeral Ed25519 payload key negotiated</div>
                    <div style={{ color: "rgba(255,255,255,0.4)" }}>SHA-256 Hash: 9f86d081884c7d659a2feaa0c55...</div>
                    <div style={{ color: "var(--green)" }}>[LOG] GDPR k-anonymity index verification OK (k=5)</div>
                    <div style={{ color: "rgba(255,255,255,0.4)" }}>Noise Factor (Laplacian): 0.150</div>
                    <div style={{ color: "var(--green)" }}>[LOG] Enforcing AES-256-GCM cipher map rotation</div>
                    <div style={{ color: "rgba(255,255,255,0.4)" }}>Salt vector: 0x9f32e9a8f102bc04...</div>
                    <div style={{ color: "var(--amber)" }}>[WARN] Vulnerable connection detected on civilian_1 (Unencrypted)</div>
                  </div>
                </div>
              </div>
              <ChatConsole
                chatHistory={chatHistory}
                onSendMessage={handleSendMessage}
                onClearHistory={handleReset}
                isSending={isSendingChat}
              />
            </div>
          </div>
        )}

        {/* 5. HISTORICAL ANALYTICS WORKSPACE */}
        {activeConsoleTab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "bold", letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
              Layer 5 Continuous Spatial Learning
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem" }}>
              <div className="panel-card" style={{ marginBottom: 0 }}>
                <h3 className="panel-title">SQLite Spatial Baselines</h3>
                <p className="panel-subtitle">Occupancy ratios per room sector</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
                  {Object.keys(heatmap).length === 0 ? (
                    <div className="empty-state">No occupancy logs for this sector. Engage live stream.</div>
                  ) : (
                    Object.entries(heatmap).map(([room, ratio]) => (
                      <div key={room} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}>
                        <span style={{ width: "110px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.68rem" }}>
                          {room === "Kitchen" ? "Hangar Deck" : 
                           room === "ICU-1" ? "Recon Zone 1" :
                           room === "ICU-2" ? "Recon Zone 2" :
                           room === "Staff-Station" ? "Command Bridge" :
                           room === "Ward-3" ? "Storage Zone A" :
                           room === "Ward-4" ? "Storage Zone B" :
                           room === "Corridor" ? "Transit Corridor" :
                           room === "Exit-1" ? "Escape Port A" :
                           room === "Exit-2" ? "Escape Port B" : room}
                        </span>
                        <div style={{ flex: 1, height: "8px", background: "var(--border-subtle)", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${ratio * 100}%`, height: "100%", background: "var(--accent)", borderRadius: "4px" }} />
                        </div>
                        <span style={{ width: "35px", textAlign: "right", fontWeight: "bold" }}>{(ratio * 100).toFixed(0)}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel-card" style={{ marginBottom: 0 }}>
                <h3 className="panel-title">Baseline Deviations</h3>
                <p className="panel-subtitle">Anomalous density drift analysis</p>
                <div style={{ fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <div>
                    ✓ Today's average movement deviation: <strong style={{ color: "var(--green)" }}>4.2%</strong> (Nominal).
                  </div>
                  <div>
                    • Transit corridor density: <strong style={{ color: "var(--accent)" }}>Normal</strong> (Expected flow rate matched).
                  </div>
                  <div style={{ borderTop: "1px dashed var(--border-subtle)", paddingTop: "0.5rem", color: "var(--text-muted)", fontSize: "0.7rem" }}>
                    *AETHER learns building patterns over 30-day sliding windows. Baseline calculations refresh at midnight.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. SETTINGS & SIMULATION INJECTION WORKSPACE */}
        {activeConsoleTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "bold", letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
              ⚙ Simulation Console
            </h2>

            {/* ── Scenario Presets & Macro Drills ── */}
            <div className="glass-card" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.6rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                  Scenario Macro Presets & Automated Drills
                </span>
                {isExecutingMacro && (
                  <span style={{ fontSize: "0.65rem", color: "var(--amber)", fontWeight: "bold" }} className="pulse-icon">
                    ⚡ EXECUTING AUTOMATED DRILL (STEP {macroStepIndex === 0 ? "INIT" : macroStepIndex})
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.5rem" }}>
                {[
                  { icon: "🔥", label: "Fire Ingress", desc: "Storage Zone A", type: "event", action: () => handleTriggerFire("Ward-3") },
                  { icon: "🤕", label: "Fall Accident", desc: "Patient in Ward", type: "event", action: () => { const civ = state.occupants.find(o => o.role === "patient"); if (civ) handleTriggerFall(civ.entity_id); } },
                  { icon: "👤", label: "Intruder Alert", desc: "Command Bridge", type: "event", action: () => handleTriggerIntruder("Staff-Station") },
                  { icon: "📡", label: "RF Sensor Fail", desc: "Recon Zone 1", type: "event", action: () => handleTriggerSensorFail("ICU-1") },
                  
                  // Automated macros
                  { icon: "🧠", label: "Intruder Drill", desc: "5x Speed Macro", type: "macro", disabled: isExecutingMacro, action: () => runMacro("Intruder Drill") },
                  { icon: "⚡", label: "Evac Cascade", desc: "Sequential Incidents", type: "macro", disabled: isExecutingMacro, action: () => runMacro("Evacuation Cascade") },
                ].map((preset, i) => (
                  <button key={i} onClick={preset.action} disabled={preset.disabled} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem",
                    padding: "0.6rem 0.4rem", 
                    background: preset.type === "macro" ? "rgba(139, 92, 246, 0.08)" : "rgba(255,255,255,0.02)", 
                    border: `1px solid ${preset.type === "macro" ? "rgba(139, 92, 246, 0.3)" : "var(--border)"}`,
                    borderRadius: "6px", cursor: preset.disabled ? "not-allowed" : "pointer", 
                    opacity: preset.disabled ? 0.5 : 1,
                    color: "var(--text-muted)", transition: "all 0.15s"
                  }}
                  onMouseEnter={e => { if (!preset.disabled) { e.currentTarget.style.background = preset.type === "macro" ? "rgba(139,92,246,0.18)" : "rgba(59,130,246,0.08)"; e.currentTarget.style.borderColor = preset.type === "macro" ? "rgba(139,92,246,0.5)" : "rgba(59,130,246,0.3)"; } }}
                  onMouseLeave={e => { if (!preset.disabled) { e.currentTarget.style.background = preset.type === "macro" ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = preset.type === "macro" ? "rgba(139, 92, 246, 0.3)" : "var(--border)"; } }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{preset.icon}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#fff" }}>{preset.label}</span>
                    <span style={{ fontSize: "0.55rem", color: "var(--text-dim)" }}>{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
              {/* ── Physics Engine Customizer ── */}
              <div className="glass-card" style={{ padding: "1rem" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginBottom: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                  Interactive Physics Engine Configuration
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {/* Slider: Fire Spread rate */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                      <span style={{ color: "var(--text-dim)" }}>Fire Propagation Increment:</span>
                      <span style={{ fontWeight: "bold", color: "var(--red)" }}>{fireSpreadRate.toFixed(1)} °C/sec</span>
                    </div>
                    <input 
                      type="range" min="1.0" max="30.0" step="0.5" 
                      value={fireSpreadRate}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setFireSpreadRate(val);
                        handleConfigureSimulation(val, csiNoiseLevel, occupantSpeed, convectionRate, socialForceWeight, desiredVelocity);
                      }}
                      style={{ width: "100%", accentColor: "var(--red)", cursor: "pointer" }}
                    />
                  </div>

                  {/* Slider: CA Convection Rate */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                      <span style={{ color: "var(--text-dim)" }}>CA Thermal Convection Rate:</span>
                      <span style={{ fontWeight: "bold", color: "var(--amber)" }}>{convectionRate.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0.05" max="0.5" step="0.01" 
                      value={convectionRate}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setConvectionRate(val);
                        handleConfigureSimulation(fireSpreadRate, csiNoiseLevel, occupantSpeed, val, socialForceWeight, desiredVelocity);
                      }}
                      style={{ width: "100%", accentColor: "var(--amber)", cursor: "pointer" }}
                    />
                  </div>

                  {/* Slider: Social Force Repulsion Weight */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                      <span style={{ color: "var(--text-dim)" }}>SFM Social Repulsion Weight:</span>
                      <span style={{ fontWeight: "bold", color: "var(--green)" }}>{socialForceWeight.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="5.0" step="0.1" 
                      value={socialForceWeight}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setSocialForceWeight(val);
                        handleConfigureSimulation(fireSpreadRate, csiNoiseLevel, occupantSpeed, convectionRate, val, desiredVelocity);
                      }}
                      style={{ width: "100%", accentColor: "var(--green)", cursor: "pointer" }}
                    />
                  </div>

                  {/* Slider: Desired Velocity Limit */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                      <span style={{ color: "var(--text-dim)" }}>Pedestrian Desired Speed Limit:</span>
                      <span style={{ fontWeight: "bold", color: "var(--accent)" }}>{desiredVelocity.toFixed(1)} m/s</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="3.0" step="0.1" 
                      value={desiredVelocity}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setDesiredVelocity(val);
                        handleConfigureSimulation(fireSpreadRate, csiNoiseLevel, occupantSpeed, convectionRate, socialForceWeight, val);
                      }}
                      style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
                    />
                  </div>

                  {/* CSI Noise Level dropdown */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem" }}>
                    <span style={{ color: "var(--text-dim)" }}>Radio Subcarrier Multipath Noise:</span>
                    <select 
                      value={csiNoiseLevel}
                      onChange={e => {
                        const val = e.target.value;
                        setCsiNoiseLevel(val);
                        handleConfigureSimulation(fireSpreadRate, val, occupantSpeed, convectionRate, socialForceWeight, desiredVelocity);
                      }}
                      style={{
                        padding: "0.25rem 0.5rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                        borderRadius: "4px", color: "#fff", fontSize: "0.7rem", outline: "none", cursor: "pointer"
                      }}
                    >
                      <option value="clean">Clean (High Signal-to-Noise)</option>
                      <option value="moderate">Moderate Baseline (1.0x Variance)</option>
                      <option value="noisy">Noisy (High Multipath Interference)</option>
                    </select>
                  </div>

                  {/* Occupant Speed dropdown */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem" }}>
                    <span style={{ color: "var(--text-dim)" }}>Occupant Movement Pacing:</span>
                    <select 
                      value={occupantSpeed}
                      onChange={e => {
                        const val = e.target.value;
                        setOccupantSpeed(val);
                        handleConfigureSimulation(fireSpreadRate, csiNoiseLevel, val, convectionRate, socialForceWeight, desiredVelocity);
                      }}
                      style={{
                        padding: "0.25rem 0.5rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                        borderRadius: "4px", color: "#fff", fontSize: "0.7rem", outline: "none", cursor: "pointer"
                      }}
                    >
                      <option value="slow">Slow Patrols (30s+ Dwell)</option>
                      <option value="normal">Normal Pacing (10s-40s Dwell)</option>
                      <option value="fast">Rapid Movements (3s-10s Dwell)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Simulation Control ── */}
              <div className="glass-card" style={{ padding: "1rem" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                  Simulator Playback Controls
                </div>
                
                {/* Speed Controls */}
                <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.65rem" }}>
                  {[1, 2, 5, 10].map(s => (
                    <button key={s} onClick={() => handleSetSpeed(s)} style={{
                      flex: 1, padding: "0.35rem", background: simSpeed === s && isPlaying ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
                      border: simSpeed === s && isPlaying ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border)",
                      borderRadius: "4px", color: simSpeed === s && isPlaying ? "#10b981" : "var(--text-muted)",
                      fontSize: "0.7rem", fontWeight: 600, cursor: "pointer"
                    }}>{s}×</button>
                  ))}
                  <button onClick={handlePause} style={{
                    flex: 1.2, padding: "0.35rem", background: !isPlaying ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)",
                    border: !isPlaying ? "1px solid rgba(239,68,68,0.35)" : "1px solid var(--border)",
                    borderRadius: "4px", color: !isPlaying ? "#ef4444" : "var(--text-muted)",
                    fontSize: "0.65rem", fontWeight: 600, cursor: "pointer"
                  }}>PAUSE</button>
                  <button onClick={handleSingleTick} disabled={isPlaying} style={{
                    flex: 1.5, padding: "0.35rem", background: isPlaying ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)", borderRadius: "4px", color: isPlaying ? "var(--text-dim)" : "var(--text-muted)",
                    fontSize: "0.65rem", fontWeight: 600, cursor: isPlaying ? "not-allowed" : "pointer"
                  }}>STEP 1S</button>
                </div>

                <button onClick={handleReset} style={{
                  width: "100%", padding: "0.4rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "4px", color: "#f87171", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s", marginTop: "0.6rem"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                >
                  🔄 Reset State Machine & Database
                </button>
              </div>
            </div>

            {/* ── Row 3: Scenario Timeline Builder & Manual Event Drop ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
              {/* Custom Timeline Scenario Builder */}
              <div className="glass-card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                    Custom Timeline Scenario Builder
                  </span>
                  {isScenarioRunning && (
                    <span style={{ fontSize: "0.62rem", color: "var(--green)", fontWeight: "bold" }} className="pulse-icon">
                      ✓ SCENARIO RUNNING: TICK {currentScenarioTick}s
                    </span>
                  )}
                </div>

                {/* Form to add events */}
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", background: "rgba(255,255,255,0.01)", border: "1px dashed var(--border)", borderRadius: "6px", padding: "0.6rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1.2 }}>
                    <label style={{ fontSize: "0.55rem", color: "var(--text-dim)", fontWeight: "bold" }}>SELECT ZONE</label>
                    <select value={schedulerRoom} onChange={e => setSchedulerRoom(e.target.value)} style={{
                      padding: "0.35rem", width: "100%", background: "#040406", border: "1px solid var(--border)", borderRadius: "4px", color: "#fff", fontSize: "0.68rem", outline: "none"
                    }}>
                      {state.rooms.map(r => <option key={r.room_id} value={r.room_id}>{r.room_id}</option>)}
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1 }}>
                    <label style={{ fontSize: "0.55rem", color: "var(--text-dim)", fontWeight: "bold" }}>EVENT TYPE</label>
                    <select value={schedulerEvent} onChange={e => setSchedulerEvent(e.target.value as any)} style={{
                      padding: "0.35rem", width: "100%", background: "#040406", border: "1px solid var(--border)", borderRadius: "4px", color: "#fff", fontSize: "0.68rem", outline: "none"
                    }}>
                      <option value="fire">🔥 Fire</option>
                      <option value="intruder">👤 Intruder</option>
                      <option value="sensor_fail">📡 Sensor Fail</option>
                      <option value="fall">🤕 Fall</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 0.8 }}>
                    <label style={{ fontSize: "0.55rem", color: "var(--text-dim)", fontWeight: "bold" }}>DELAY SEC</label>
                    <input 
                      type="number" min="1" max="120"
                      value={schedulerDelay}
                      onChange={e => setSchedulerDelay(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        padding: "0.35rem", width: "100%", background: "#040406", border: "1px solid var(--border)", borderRadius: "4px", color: "#fff", fontSize: "0.68rem", outline: "none"
                      }}
                    />
                  </div>

                  <button 
                    onClick={() => {
                      const newEvent = {
                        id: Date.now(),
                        delay: schedulerDelay,
                        room: schedulerRoom,
                        type: schedulerEvent
                      };
                      setCustomScenarioEvents(prev => [...prev, newEvent].sort((a, b) => a.delay - b.delay));
                    }}
                    style={{
                      alignSelf: "flex-end", padding: "0.35rem 0.6rem", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)",
                      borderRadius: "4px", color: "#60a5fa", fontSize: "0.68rem", fontWeight: "bold", cursor: "pointer"
                    }}
                  >
                    + Queue
                  </button>
                </div>

                {/* Queued list */}
                <div style={{ flex: 1, minHeight: "90px", maxHeight: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {customScenarioEvents.length === 0 ? (
                    <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", padding: "1.5rem 0", textAlign: "center", border: "1px dashed rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                      No events queued. Build a scenario by scheduling events above!
                    </div>
                  ) : (
                    customScenarioEvents.map((evt) => {
                      const activeEvent = runningScenarioEvents.find(e => e.delay === evt.delay && e.room === evt.room && e.type === evt.type);
                      const isTriggered = activeEvent ? activeEvent.triggered : false;

                      return (
                        <div key={evt.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: isTriggered ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isTriggered ? "rgba(16,185,129,0.2)" : "var(--border-subtle)"}`,
                          padding: "0.35rem 0.5rem", borderRadius: "4px", fontSize: "0.68rem"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ color: isTriggered ? "var(--green)" : "var(--accent)", fontWeight: "bold", fontFamily: "JetBrains Mono" }}>
                              {isTriggered ? "✓" : `T+${evt.delay}s`}
                            </span>
                            <span style={{ textTransform: "uppercase", color: "#fff", fontWeight: "600" }}>
                              {evt.type.replace("_", " ")}
                            </span>
                            <span style={{ color: "var(--text-dim)" }}>in {evt.room}</span>
                          </div>
                          <button 
                            onClick={() => {
                              setCustomScenarioEvents(prev => prev.filter(e => e.id !== evt.id));
                            }}
                            style={{ background: "transparent", border: "none", color: "var(--red)", fontSize: "0.75rem", cursor: "pointer" }}
                            disabled={isScenarioRunning}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Actions bar */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button 
                    onClick={handleStartCustomScenario}
                    disabled={isScenarioRunning || customScenarioEvents.length === 0}
                    style={{
                      flex: 1, padding: "0.4rem", background: "linear-gradient(135deg, var(--accent), #8b5cf6)", border: "none",
                      borderRadius: "4px", color: "#fff", fontSize: "0.7rem", fontWeight: "bold", cursor: "pointer", opacity: (isScenarioRunning || customScenarioEvents.length === 0) ? 0.5 : 1
                    }}
                  >
                    ⚡ RUN CUSTOM SCHEDULED SCENARIO
                  </button>
                  <button 
                    onClick={() => {
                      setCustomScenarioEvents([]);
                      setIsScenarioRunning(false);
                    }}
                    style={{
                      padding: "0.4rem 0.8rem", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                      borderRadius: "4px", color: "var(--text-muted)", fontSize: "0.7rem", cursor: "pointer"
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Manual Event Drop / Injector */}
              <div className="glass-card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                  Single-Incident Manual Event Injector
                </div>
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                  Select a zone and drop an immediate threat event into the simulation. This bypassing scheduling timelines.
                </p>
                
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
                  <select value={injectorRoom} onChange={e => setInjectorRoom(e.target.value)} style={{
                    flex: 1, padding: "0.45rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                    borderRadius: "4px", color: "#fff", fontSize: "0.7rem", outline: "none"
                  }}>
                    {state.rooms.map(r => <option key={r.room_id} value={r.room_id}>{r.room_id}</option>)}
                  </select>
                  <select value={injectorEvent} onChange={e => setInjectorEvent(e.target.value)} style={{
                    flex: 1, padding: "0.45rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                    borderRadius: "4px", color: "#fff", fontSize: "0.7rem", outline: "none"
                  }}>
                    <option value="fire">🔥 Fire</option>
                    <option value="intruder">👤 Intruder</option>
                    <option value="sensor_fail">📡 Sensor Fail</option>
                  </select>
                </div>
                
                <button onClick={() => {
                  if (injectorEvent === "fire") handleTriggerFire(injectorRoom);
                  else if (injectorEvent === "intruder") handleTriggerIntruder(injectorRoom);
                  else if (injectorEvent === "sensor_fail") handleTriggerSensorFail(injectorRoom);
                }} style={{
                  padding: "0.45rem", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)",
                  borderRadius: "4px", color: "#60a5fa", fontSize: "0.7rem", fontWeight: "bold", cursor: "pointer",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,0.12)"; }}
                >
                  INJECT SINGLE INSTANCE EVENT →
                </button>
              </div>
            </div>

            {/* ── GIS Map & Network Health ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1rem" }}>
              <GisMap
                hospitals={hospitals}
                selectedId={selectedId}
                onSelectHospital={setSelectedId}
              />
              <NetworkHealth
                ping={activeHospital?.ping || state.ping}
                csiQuality={activeHospital?.csi_quality || state.csi_quality}
                csiPackets={activeHospital?.csi_packets || state.csi_packets}
                simTime={state.sim_time}
              />
            </div>

            {/* ── Live Simulation Event Log ── */}
            <div className="glass-card" style={{ padding: "1rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live Simulation Log</div>
              <div style={{
                maxHeight: "200px", overflowY: "auto", fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.62rem", lineHeight: 1.6, background: "rgba(0,0,0,0.3)", borderRadius: "4px",
                padding: "0.6rem", border: "1px solid var(--border)"
              }}>
                {simLog.length === 0 && (
                  <div style={{ color: "var(--text-dim)" }}>Awaiting simulation events...</div>
                )}
                {simLog.map((entry, i) => (
                  <div key={i} style={{ color: entry.msg.includes("SCENARIO") || entry.msg.includes("INTRUDER") || entry.msg.includes("SENSOR") ? "#f59e0b" : entry.msg.includes("RESET") ? "#ef4444" : entry.msg.includes("hazard") ? "#f87171" : "var(--text-muted)" }}>
                    <span style={{ color: "rgba(255,255,255,0.25)" }}>[{entry.time}]</span> {entry.msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

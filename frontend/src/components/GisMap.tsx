import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Globe, Layers, Crosshair, Send, Compass, Radio } from "lucide-react";
import type { HospitalMeta } from "../types";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface GisMapProps {
  hospitals: HospitalMeta[];
  selectedId: string;
  onSelectHospital: (id: string) => void;
}

const TILE_LAYERS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    label: "Dark Intel",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    label: "Satellite",
  },
  hybrid: {
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    label: "Stealth",
  },
};

const LABEL_OVERLAY_URL = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";

const SECTOR_CITIES: Record<string, { city: string; state: string; country: string; timezone: string }> = {
  metro_care:    { city: "New Delhi",  state: "Delhi",      country: "India", timezone: "IST +5:30" },
  mercy_general: { city: "Mumbai",     state: "Maharashtra",country: "India", timezone: "IST +5:30" },
  st_jude:       { city: "Chennai",    state: "Tamil Nadu", country: "India", timezone: "IST +5:30" },
  aether_labs:   { city: "Bangalore",  state: "Karnataka",  country: "India", timezone: "IST +5:30" },
  kolkata_grid:  { city: "Kolkata",    state: "West Bengal", country: "India", timezone: "IST +5:30" },
  hyderabad_hub: { city: "Hyderabad",  state: "Telangana",   country: "India", timezone: "IST +5:30" },
};

// Custom DIV marker icons
function createIcon(color: string, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 18 : 12;
  return L.divIcon({
    className: "",
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    html: `
      <div style="
        width: ${size * 2}px; height: ${size * 2}px;
        display: flex; align-items: center; justify-content: center;
        position: relative;
      ">
        <div style="
          width: ${size}px; height: ${size}px;
          background: ${color}; border-radius: 50%;
          box-shadow: 0 0 ${isSelected ? 20 : 8}px ${color}, 0 0 ${isSelected ? 40 : 16}px ${color}44;
          border: 2px solid rgba(255,255,255,0.7);
        "></div>
        ${isSelected ? `
          <div style="position: absolute; width: ${size * 2.5}px; height: ${size * 2.5}px;
            border: 1.5px solid ${color}; border-radius: 50%; opacity: 0.5;
            animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
          "></div>
        ` : ""}
      </div>
    `,
  });
}

// GPS Beacon Marker Icon
function createGpsBeaconIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <div style="
        width: 30px; height: 30px;
        display: flex; align-items: center; justify-content: center;
        position: relative;
      ">
        <div style="
          width: 8px; height: 8px;
          background: #f43f5e; border-radius: 50%;
          box-shadow: 0 0 10px #f43f5e, 0 0 20px #f43f5e;
          border: 1.5px solid #fff;
        "></div>
        <div style="
          position: absolute; width: 24px; height: 24px;
          border: 1.5px dashed #f43f5e; border-radius: 50%;
          animation: spin 6s linear infinite;
        "></div>
      </div>
    `,
  });
}

// Cell Tower Marker Icon (Triangulation)
function createCellTowerIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <div style="
        width: 30px; height: 30px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        position: relative;
      ">
        <div style="
          width: 10px; height: 10px;
          background: #3b82f6;
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          box-shadow: 0 0 8px #3b82f6;
        "></div>
        <div style="
          font-family: 'JetBrains Mono', monospace;
          font-size: 6px;
          color: #60a5fa;
          background: rgba(4,4,6,0.85);
          border: 0.5px solid rgba(59,130,246,0.3);
          padding: 1px 2px;
          border-radius: 2px;
          margin-top: 1px;
          white-space: nowrap;
        ">${label}</div>
      </div>
    `,
  });
}

function FlyToSector({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 7, { duration: 1.5 });
    }
  }, [coords, map]);
  return null;
}

// Listen to mousemove event on Leaflet map to update HUD coordinates
function MouseCoordinatesTracker({ onUpdate }: { onUpdate: (lat: number, lng: number) => void }) {
  useMapEvents({
    mousemove(e) {
      onUpdate(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

interface CustomGpsBeacon {
  id: string;
  name: string;
  coords: [number, number];
  accuracy: number;
}

export default function GisMap({ hospitals, selectedId, onSelectHospital }: GisMapProps) {
  const [tileMode, setTileMode] = useState<"dark" | "satellite" | "hybrid">("satellite");
  const [showCoverage, setShowCoverage] = useState(true);
  const [showTriangulation, setShowTriangulation] = useState(false);
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number }>({ lat: 20.5937, lng: 78.9629 });
  
  // Custom GPS Beacon States
  const [beacons, setBeacons] = useState<CustomGpsBeacon[]>([]);
  const [inputLat, setInputLat] = useState("");
  const [inputLng, setInputLng] = useState("");
  const [beaconName, setBeaconName] = useState("");

  const defaultCenter: [number, number] = [20.5937, 78.9629];
  const selectedHospital = hospitals.find(h => h.id === selectedId);
  const selectedCoords: [number, number] = selectedHospital ? selectedHospital.coords : defaultCenter;
  const selectedCity = SECTOR_CITIES[selectedId];

  // Simulated base station positions for cellular network triangulation
  const getCellTowers = (center: [number, number]) => {
    return [
      { id: "tower-alpha", label: "TOWER-A (BS-01)", coords: [center[0] + 0.35, center[1] + 0.25] as [number, number] },
      { id: "tower-beta",  label: "TOWER-B (BS-02)", coords: [center[0] - 0.42, center[1] + 0.38] as [number, number] },
      { id: "tower-gamma", label: "TOWER-C (BS-03)", coords: [center[0] + 0.15, center[1] - 0.48] as [number, number] }
    ];
  };

  const cellTowers = getCellTowers(selectedCoords);

  // Calculate distance between two coordinates in km using Haversine formula
  const getDistanceKm = (c1: [number, number], c2: [number, number]) => {
    const R = 6371; // Earth radius
    const dLat = (c2[0] - c1[0]) * Math.PI / 180;
    const dLon = (c2[1] - c1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(c1[0] * Math.PI / 180) * Math.cos(c2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Auto-fill coordinates from mouseclick/move for convenience
  const handleMapClick = (lat: number, lng: number) => {
    setInputLat(lat.toFixed(6));
    setInputLng(lng.toFixed(6));
    if (!beaconName) {
      setBeaconName(`BEACON-${Math.floor(100 + Math.random() * 900)}`);
    }
  };

  // Click handler helper component
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        handleMapClick(e.latlng.lat, e.latlng.lng);
      }
    });
    return null;
  }

  // Inject a new GPS tracked beacon onto the map
  const handleInjectBeacon = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(inputLat);
    const lng = parseFloat(inputLng);
    if (isNaN(lat) || isNaN(lng)) return;

    const newBeacon: CustomGpsBeacon = {
      id: `gps-${Date.now()}`,
      name: beaconName || `GPS-LOCK-${Math.floor(1000 + Math.random() * 9000)}`,
      coords: [lat, lng],
      accuracy: Math.floor(15 + Math.random() * 85)
    };

    setBeacons(prev => [...prev, newBeacon]);
    setInputLat("");
    setInputLng("");
    setBeaconName("");
  };

  const handleClearBeacons = () => {
    setBeacons([]);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setInputLat(position.coords.latitude.toFixed(6));
        setInputLng(position.coords.longitude.toFixed(6));
        setBeaconName("MY LOCATION (YOU)");
      },
      (error) => {
        console.error("Error getting location", error);
        const lat = 28.6139 + (Math.random() - 0.5) * 0.05;
        const lng = 77.2090 + (Math.random() - 0.5) * 0.05;
        setInputLat(lat.toFixed(6));
        setInputLng(lng.toFixed(6));
        setBeaconName("MY LOCATION (MOCK)");
        alert("Could not retrieve precise GPS coordinates. Mocked location generated near Metro Care.");
      }
    );
  };

  // Trunk connections
  const trunkPairs = [
    ["metro_care", "mercy_general"],
    ["mercy_general", "hyderabad_hub"],
    ["hyderabad_hub", "st_jude"],
    ["st_jude", "aether_labs"],
    ["aether_labs", "kolkata_grid"],
    ["kolkata_grid", "metro_care"],
  ];
  const trunkLines: { positions: [number, number][]; hasEmergency: boolean }[] = [];
  trunkPairs.forEach(([from, to]) => {
    const h1 = hospitals.find(h => h.id === from);
    const h2 = hospitals.find(h => h.id === to);
    if (h1 && h2) {
      const hasEmergency = h1.status === "emergency" || h2.status === "emergency";
      trunkLines.push({ positions: [h1.coords, h2.coords], hasEmergency });
    }
  });

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 className="brand-title" style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", margin: 0 }}>
          <Globe size={15} style={{ color: "var(--accent)" }} />
          <span>Geoint, GPS & Cellular Triangulation</span>
        </h3>
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          {/* Layer toggles */}
          {(Object.keys(TILE_LAYERS) as Array<keyof typeof TILE_LAYERS>).map(key => (
            <button
              key={key}
              onClick={() => setTileMode(key)}
              style={{
                padding: "0.2rem 0.45rem",
                fontSize: "0.58rem",
                fontWeight: tileMode === key ? "bold" : "normal",
                background: tileMode === key ? "rgba(37,99,235,0.2)" : "transparent",
                border: `1px solid ${tileMode === key ? "var(--accent)" : "var(--border-subtle)"}`,
                borderRadius: 3,
                color: tileMode === key ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.2rem",
                textTransform: "uppercase",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              <Layers size={8} />
              {TILE_LAYERS[key].label}
            </button>
          ))}
          
          {/* Triangulation Toggle */}
          <button
            onClick={() => setShowTriangulation(!showTriangulation)}
            style={{
              padding: "0.2rem 0.45rem",
              fontSize: "0.58rem",
              background: showTriangulation ? "rgba(59,130,246,0.15)" : "transparent",
              border: `1px solid ${showTriangulation ? "var(--accent)" : "var(--border-subtle)"}`,
              borderRadius: 3,
              color: showTriangulation ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: showTriangulation ? "bold" : "normal",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem"
            }}
          >
            <Radio size={8} />
            Triangulate
          </button>

          <button
            onClick={() => setShowCoverage(!showCoverage)}
            style={{
              padding: "0.2rem 0.45rem",
              fontSize: "0.58rem",
              background: showCoverage ? "rgba(16,185,129,0.15)" : "transparent",
              border: `1px solid ${showCoverage ? "var(--green)" : "var(--border-subtle)"}`,
              borderRadius: 3,
              color: showCoverage ? "var(--green)" : "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: showCoverage ? "bold" : "normal",
              textTransform: "uppercase",
            }}
          >
            <Crosshair size={8} style={{ display: "inline", marginRight: "0.15rem", verticalAlign: "middle" }} />
            Range
          </button>
        </div>
      </div>
      <p className="panel-subtitle">Interactive Leaflet satellite tiles. Click map to capture coordinates. Toggle Triangulation to view trilateration.</p>

      {/* Leaflet Map Frame */}
      <div style={{ borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden", height: "300px", position: "relative" }}>
        <MapContainer
          center={defaultCenter}
          zoom={5}
          style={{ height: "100%", width: "100%", background: "#0a0a12" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={TILE_LAYERS[tileMode].url} />
          <TileLayer url={LABEL_OVERLAY_URL} zIndex={500} />

          <FlyToSector coords={selectedCoords} />
          <MouseCoordinatesTracker onUpdate={(lat, lng) => setMouseCoords({ lat, lng })} />
          <MapClickHandler />

          {/* Range rings */}
          {showCoverage && !showTriangulation && hospitals.map(h => {
            const isEmergency = h.status === "emergency";
            const isSelected = h.id === selectedId;
            return (
              <Circle
                key={`cov-${h.id}`}
                center={h.coords}
                radius={isSelected ? 80000 : 50000}
                pathOptions={{
                  color: isEmergency ? "#ef4444" : isSelected ? "#3b82f6" : "#10b981",
                  fillColor: isEmergency ? "#ef4444" : isSelected ? "#3b82f6" : "#10b981",
                  fillOpacity: isSelected ? 0.08 : 0.04,
                  weight: 1,
                  dashArray: isSelected ? undefined : "6, 4",
                }}
              />
            );
          })}

          {/* Triangulation Visualizer (Trilateration Rings and Lines) */}
          {showTriangulation && cellTowers.map(t => {
            const distance = getDistanceKm(t.coords, selectedCoords);
            return (
              <g key={t.id}>
                {/* Distance range ring from tower to target */}
                <Circle
                  center={t.coords}
                  radius={distance * 1000} // Convert to meters
                  pathOptions={{
                    color: "rgba(59, 130, 246, 0.45)",
                    fillColor: "transparent",
                    weight: 1,
                    dashArray: "5, 5"
                  }}
                />
                {/* Signal triangulation ray line */}
                <Polyline
                  positions={[t.coords, selectedCoords]}
                  pathOptions={{
                    color: "rgba(59, 130, 246, 0.35)",
                    weight: 1.5,
                    dashArray: "3, 6"
                  }}
                />
                {/* Base Station Tower Marker */}
                <Marker position={t.coords} icon={createCellTowerIcon(t.label.split(" ")[0])}>
                  <Popup>
                    <div style={{ background: "#111118", color: "#fff", padding: "0.5rem", fontSize: "0.7rem", borderRadius: "4px" }}>
                      <strong>{t.label}</strong><br />
                      Latitude: {t.coords[0].toFixed(5)}°<br />
                      Longitude: {t.coords[1].toFixed(5)}°<br />
                      Distance to Target: {distance.toFixed(1)} km
                    </div>
                  </Popup>
                </Marker>
              </g>
            );
          })}

          {/* Live Custom GPS Injected Beacons */}
          {beacons.map(b => (
            <g key={b.id}>
              <Circle
                center={b.coords}
                radius={b.accuracy * 100}
                pathOptions={{ color: "#f43f5e", fillColor: "#f43f5e", fillOpacity: 0.1, weight: 1, dashArray: "4,4" }}
              />
              <Marker position={b.coords} icon={createGpsBeaconIcon()}>
                <Popup>
                  <div style={{
                    background: "#111118", color: "#fff", padding: "0.6rem", borderRadius: "4px", minWidth: "150px", fontSize: "0.7rem"
                  }}>
                    <span style={{ color: "#f43f5e", fontWeight: "bold" }}>📡 GPS TRACKING UPLINK</span>
                    <hr style={{ borderColor: "rgba(255,255,255,0.08)", margin: "0.3rem 0" }} />
                    Alias: <strong>{b.name}</strong><br />
                    Coordinates: {b.coords[0].toFixed(5)}°, {b.coords[1].toFixed(5)}°<br />
                    Variance: ±{b.accuracy}m
                  </div>
                </Popup>
              </Marker>
            </g>
          ))}

          {/* Sector nodes */}
          {hospitals.map(h => {
            const isSelected = h.id === selectedId;
            const isEmergency = h.status === "emergency";
            const color = isEmergency ? "#ef4444" : isSelected ? "#3b82f6" : "#10b981";
            const cityInfo = SECTOR_CITIES[h.id];

            return (
              <Marker
                key={h.id}
                position={h.coords}
                icon={createIcon(color, isSelected)}
                eventHandlers={{ click: () => onSelectHospital(h.id) }}
              >
                <Popup>
                  <div style={{
                    background: "#111118", color: "#fff", padding: "0.7rem 0.9rem", borderRadius: "6px", minWidth: "220px", fontFamily: "DM Sans, sans-serif", border: `1px solid ${color}33`
                  }}>
                    <div style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "0.2rem", color }}>
                      {h.name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.4rem" }}>
                      {cityInfo?.city}, {cityInfo?.state}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.35rem" }}>
                      Uplink: {h.ping}ms | CSI: {(h.csi_quality * 100).toFixed(0)}%
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Pointer Coordinate Sweep HUD */}
        <div style={{
          position: "absolute", bottom: 8, left: 8, zIndex: 1000,
          background: "rgba(4,4,6,0.9)", border: "1px solid var(--border)",
          borderRadius: 4, padding: "0.35rem 0.6rem",
          fontFamily: "JetBrains Mono, monospace", fontSize: "0.6rem",
          color: "var(--text-muted)", pointerEvents: "none",
        }}>
          <div style={{ color: "var(--green)", fontWeight: "bold" }}>● CURSOR POINTER SWEEP</div>
          LAT: {mouseCoords.lat.toFixed(5)}°N | LNG: {mouseCoords.lng.toFixed(5)}°E
        </div>

        {/* Selected target target lock display */}
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 1000,
          background: "rgba(4,4,6,0.9)", border: "1px solid var(--border)",
          borderRadius: 5, padding: "0.4rem 0.6rem",
          fontFamily: "JetBrains Mono, monospace", fontSize: "0.6rem",
          color: "var(--text-muted)", pointerEvents: "none", maxWidth: "200px"
        }}>
          <div style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "0.65rem", marginBottom: "0.15rem" }}>
            ◎ ACTIVE LINK
          </div>
          <div style={{ color: "#fff", fontWeight: "bold" }}>{selectedHospital?.name.toUpperCase()}</div>
          <div>{selectedCity?.city}, {selectedCity?.state}</div>
        </div>
      </div>

      {/* Triangulation Diagnostic readout table */}
      {showTriangulation && (
        <div style={{
          background: "rgba(10,10,15,0.75)",
          border: "1px solid rgba(59,130,246,0.25)",
          borderRadius: "6px",
          padding: "0.55rem 0.85rem",
          marginTop: "0.5rem",
          fontSize: "0.7rem",
          fontFamily: "JetBrains Mono, monospace"
        }}>
          <div style={{ color: "var(--accent)", fontWeight: "bold", marginBottom: "0.3rem", textTransform: "uppercase" }}>
            📡 Cellular Trilateration calculations
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: "0.4rem", color: "var(--text-muted)" }}>
            <span style={{ fontWeight: "bold" }}>STATION</span>
            <span>COORD</span>
            <span>RANGE (KM)</span>
            <span>DELAY / TA</span>
          </div>
          <hr style={{ borderColor: "rgba(59,130,246,0.15)", margin: "0.25rem 0" }} />
          {cellTowers.map(t => {
            const distance = getDistanceKm(t.coords, selectedCoords);
            // Calculate delay time based on speed of light propagation
            const delayMicroSec = (distance / 299792.458) * 1000000;
            return (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", margin: "0.15rem 0" }}>
                <span style={{ color: "#fff" }}>{t.label.split(" ")[0]}</span>
                <span>{t.coords[0].toFixed(2)}N</span>
                <span style={{ color: "var(--green)" }}>{distance.toFixed(1)} km</span>
                <span style={{ color: "var(--amber)" }}>{delayMicroSec.toFixed(1)} μs</span>
              </div>
            );
          })}
          <hr style={{ borderColor: "rgba(59,130,246,0.15)", margin: "0.25rem 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.5)", marginTop: "0.2rem" }}>
            <span>CALCULATED CENTROID:</span>
            <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
              {selectedCoords[0].toFixed(4)}°N, {selectedCoords[1].toFixed(4)}°E (±14m Variance)
            </span>
          </div>
        </div>
      )}

      {/* GPS Target Locator & Beacon Injection Interface */}
      <form onSubmit={handleInjectBeacon} style={{
        background: "rgba(10,10,15,0.5)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "6px",
        padding: "0.6rem 0.85rem",
        marginTop: "0.5rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.45rem", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase" }}>
          <Compass size={12} style={{ color: "#f43f5e" }} />
          <span>GPS Beacon Uplink Injector</span>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Beacon Alias (eg: ASSET-3)"
            value={beaconName}
            onChange={e => setBeaconName(e.target.value)}
            style={{ flex: 1, minWidth: "120px", padding: "0.35rem", fontSize: "0.7rem", height: "26px" }}
          />
          <input
            type="text"
            placeholder="Latitude (N)"
            value={inputLat}
            onChange={e => setInputLat(e.target.value)}
            required
            style={{ flex: 1, minWidth: "90px", padding: "0.35rem", fontSize: "0.7rem", fontFamily: "JetBrains Mono", height: "26px" }}
          />
          <input
            type="text"
            placeholder="Longitude (E)"
            value={inputLng}
            onChange={e => setInputLng(e.target.value)}
            required
            style={{ flex: 1, minWidth: "90px", padding: "0.35rem", fontSize: "0.7rem", fontFamily: "JetBrains Mono", height: "26px" }}
          />
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button 
              type="button" 
              onClick={handleLocateMe} 
              style={{
                height: "26px", padding: "0 0.5rem", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)",
                borderRadius: "4px", color: "#f43f5e", fontSize: "0.68rem", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem"
              }}
            >
              📍 Locate Me
            </button>
            <button type="submit" className="btn btn-accent" style={{ height: "26px", padding: "0 0.6rem", display: "flex", alignItems: "center", gap: "0.25rem", flex: "none", fontSize: "0.68rem" }}>
              <Send size={10} />
              <span>LOCK</span>
            </button>
            {beacons.length > 0 && (
              <button type="button" onClick={handleClearBeacons} className="btn btn-danger" style={{ height: "26px", padding: "0 0.5rem", flex: "none", fontSize: "0.68rem" }}>
                CLEAR
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Sector Selection Row */}
      <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        {hospitals.map(h => {
          const isSelected = h.id === selectedId;
          const isEmergency = h.status === "emergency";
          const cityInfo = SECTOR_CITIES[h.id];
          return (
            <button
              key={h.id}
              onClick={() => onSelectHospital(h.id)}
              style={{
                flex: 1, minWidth: "110px",
                padding: "0.4rem 0.5rem",
                fontSize: "0.62rem", fontWeight: isSelected ? "bold" : "normal",
                background: isSelected ? "rgba(37,99,235,0.12)" : "var(--bg-card)",
                border: `1px solid ${isEmergency ? "rgba(239,68,68,0.4)" : isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
                borderRadius: 5,
                color: isEmergency ? "var(--red)" : isSelected ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer", textAlign: "left",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              <div style={{ fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {h.name} {isEmergency ? "⚠" : ""}
              </div>
              <div style={{ fontSize: "0.55rem", opacity: 0.6, marginTop: "0.1rem" }}>
                {cityInfo?.city} • {h.ping}ms
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

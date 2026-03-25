import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './RouteMapPage.css';

// Fix default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom pulsing user marker
const userIcon = L.divIcon({
  className: 'rm-user-marker',
  html: `<div class="rm-pulse-ring"></div><div class="rm-pulse-dot"></div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
});

// Police marker
const policeIcon = L.divIcon({
  className: '',
  html: `<div style="background:#3B82F6;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(59,130,246,0.5);border:2px solid #fff;">🚔</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

// Hospital marker
const hospitalIcon = L.divIcon({
  className: '',
  html: `<div style="background:#EF4444;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(239,68,68,0.5);border:2px solid #fff;">🏥</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

const FILTERS = [
  { id: 'live',  label: 'Live Tracking' },
  { id: 'zones', label: 'Safe Zones' },
  { id: 'past',  label: 'Past Routes' },
  { id: 'share', label: 'Share Location' },
];

// Fetches hospitals + police stations near a lat/lng using Overpass API
async function fetchSafeZones(lat, lng, radiusM = 3000) {
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:${radiusM},${lat},${lng});
      node["amenity"="police"](around:${radiusM},${lat},${lng});
      node["amenity"="clinic"](around:${radiusM},${lat},${lng});
    );
    out body;
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.elements || [];
}

function LiveLocationTracker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 16, { animate: true });
  }, [position, map]);
  return null;
}

export default function RouteMapPage() {
  const [activeFilter, setActiveFilter] = useState('live');
  const [showZones, setShowZones]       = useState(false);
  const [shared, setShared]             = useState(false);
  const [position, setPosition]         = useState(null);
  const [accuracy, setAccuracy]         = useState(null);
  const [safeZones, setSafeZones]       = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [pastRoute, setPastRoute]       = useState([]);
  const watchIdRef = useRef(null);

  // Live location tracking
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setPosition(newPos);
        setAccuracy(pos.coords.accuracy);
        // Record past route
        setPastRoute(prev => {
          const last = prev[prev.length - 1];
          if (last && last[0] === newPos[0] && last[1] === newPos[1]) return prev;
          return [...prev.slice(-50), newPos]; // keep last 50 points
        });
      },
      (err) => console.error('Location error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // Fetch safe zones when user enables them and we have a position
  const loadSafeZones = useCallback(async (lat, lng) => {
    setZonesLoading(true);
    try {
      const zones = await fetchSafeZones(lat, lng);
      setSafeZones(zones);
    } catch (e) {
      console.error('Overpass fetch failed:', e);
      setSafeZones([]);
    } finally {
      setZonesLoading(false);
    }
  }, []);

  const handleFilter = (id) => {
    setActiveFilter(id);

    if (id === 'zones') {
      const next = !showZones;
      setShowZones(next);
      if (next && position && safeZones.length === 0) {
        loadSafeZones(position[0], position[1]);
      }
    }

    if (id === 'share') {
      const pos = position;
      let link;
      if (pos) {
        link = `https://www.google.com/maps?q=${pos[0]},${pos[1]}`;
      } else {
        link = window.location.href;
      }
      navigator.clipboard.writeText(link).catch(() => {});
      setShared(true);
      setTimeout(() => setShared(false), 3000);
    }
  };

  const safeCount = safeZones.length;

  return (
    <div className="rm-page">
      {/* Filter row */}
      <div className="rm-filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`rm-filter-btn ${activeFilter === f.id ? 'active' : ''}`}
            onClick={() => handleFilter(f.id)}
          >
            {f.id === 'live' && <span className={`rm-filter-dot ${activeFilter === 'live' ? 'active' : ''}`}/>}
            {f.label}
          </button>
        ))}
        {shared && (
          <span style={{ color: '#6B8C72', background: '#e2ecd9', padding: '0.2rem 0.7rem', borderRadius: '12px', fontSize: '0.75rem', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ✓ Location link copied!
          </span>
        )}
        {zonesLoading && (
          <span style={{ color: '#C4998A', fontSize: '0.75rem', marginLeft: 'auto' }}>
            🔍 Finding safe zones…
          </span>
        )}
      </div>

      {/* Leaflet Map */}
      <div className="rm-map-wrap">
        {!position && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F3EE' }}>
            <p style={{ color: '#1C1410', fontSize: '0.9rem' }}>📍 Getting your location…</p>
          </div>
        )}
        <MapContainer
          center={position || [17.3850, 78.4867]}
          zoom={15}
          className="rm-leaflet-map"
          zoomControl={true}
          scrollWheelZoom={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          {/* Live location tracker */}
          {position && <LiveLocationTracker position={position} />}

          {/* Accuracy ring */}
          {position && accuracy && (
            <Circle
              center={position}
              radius={accuracy}
              pathOptions={{ color: '#6B8C72', fillColor: '#6B8C72', fillOpacity: 0.15, weight: 1 }}
            />
          )}

          {/* User marker */}
          {position && (
            <Marker position={position} icon={userIcon}>
              <Popup>📍 You are here</Popup>
            </Marker>
          )}

          {/* Past route dots */}
          {activeFilter === 'past' && pastRoute.map((pt, i) => (
            <Circle key={i} center={pt} radius={4} pathOptions={{ color: '#B0A89E', fillColor: '#B0A89E', fillOpacity: 0.7, weight: 0 }} />
          ))}

          {/* Safe zones from Overpass */}
          {showZones && safeZones.map((zone) => {
            const isHospital = zone.tags?.amenity === 'hospital' || zone.tags?.amenity === 'clinic';
            const name = zone.tags?.name || (isHospital ? 'Hospital' : 'Police Station');
            const color = isHospital ? '#EF4444' : '#3B82F6';
            return (
              <div key={zone.id}>
                <Marker position={[zone.lat, zone.lon]} icon={isHospital ? hospitalIcon : policeIcon}>
                  <Popup>
                    <strong>{isHospital ? '🏥' : '🚔'} {name}</strong>
                    <br />
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>{isHospital ? 'Hospital / Clinic' : 'Police Station'} — Safe Zone</span>
                  </Popup>
                </Marker>
                <Circle
                  center={[zone.lat, zone.lon]}
                  radius={300}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1, dashArray: '5 4' }}
                />
              </div>
            );
          })}
        </MapContainer>

        <div className="rm-live-badge">
          <span className="rm-live-dot"/>Live
        </div>
      </div>

      {/* Stat cards */}
      <div className="rm-stats">
        <div className="rm-stat-card">
          <span className="rm-stat-val">{position ? '📍 Live' : '—'}</span>
          <span className="rm-stat-lbl">Location tracking</span>
        </div>
        <div className="rm-stat-card rm-stat-card--center">
          <span className="rm-stat-val">{accuracy ? `±${Math.round(accuracy)}m` : '—'}</span>
          <span className="rm-stat-lbl">GPS accuracy</span>
        </div>
        <div className="rm-stat-card">
          <span className="rm-stat-val">{showZones ? safeCount : '—'}</span>
          <span className="rm-stat-lbl">Safe zones nearby</span>
          <span className="rm-stat-sub">{showZones ? 'Police stations & Hospitals' : 'Click "Safe Zones" to load'}</span>
        </div>
      </div>
    </div>
  );
}

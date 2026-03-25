import { useRef, useEffect, useCallback, useState } from 'react';
import { gsap } from 'gsap';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGuardianSocket } from '../hooks/useGuardianSocket';
import GuardianCard from './GuardianCard';
import CameraCard from './CameraCard';
import './MagicBento.css';

const DEFAULT_PARTICLE_COUNT = 8;
const DEFAULT_SPOTLIGHT_RADIUS = 350;
// Sage green as the glow color
const DEFAULT_GLOW_COLOR = '212, 160, 188';
const MOBILE_BREAKPOINT = 768;

// ── Real Leaflet Map (Hyderabad, OSM tiles) ───────────────────
const USER_POS  = [17.3850, 78.4867];
const DEST_POS  = [17.4123, 78.4321];
const ROUTE_PTS = [
  [17.3850, 78.4867], [17.3900, 78.4800], [17.3960, 78.4720],
  [17.4020, 78.4600], [17.4060, 78.4490], [17.4100, 78.4400], [17.4123, 78.4321],
];

// Fix default icon URL resolution in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userPinIcon = L.divIcon({
  className: 'bm-user-pin',
  html: `<div class="bm-pulse-ring"></div><div class="bm-pulse-dot"></div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});
const destPinIcon = L.divIcon({
  className: 'bm-dest-pin',
  html: `<svg viewBox="0 0 24 30" fill="none" width="22" height="28"><path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z" fill="#C4998A"/><circle cx="12" cy="8" r="3" fill="white"/></svg>`,
  iconSize: [22, 28], iconAnchor: [11, 28],
});

function LiveLocationTracker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 16, { animate: true });
    }
  }, [position, map]);
  return null;
}

const BentoLiveMap = () => {
  const [position, setPosition] = useState([17.3850, 78.4867]);
  const [accuracy, setAccuracy] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy);
      },
      (err) => console.error("Location error:", err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="bento-leaflet-wrap">
      {!position && (
        <div className="w-full h-full flex items-center justify-center bg-[#F7F3EE] absolute z-10">
          <p className="text-[#1C1410] font-sans text-sm animate-pulse">
            Getting your location...
          </p>
        </div>
      )}
      <MapContainer
        center={position || USER_POS} zoom={14}
        className="bento-leaflet-map"
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        <LiveLocationTracker position={position} />

        <Polyline
          positions={ROUTE_PTS}
          pathOptions={{ color: '#D4A0BC', weight: 2.5, dashArray: '7 5', lineCap: 'round' }}
        />

        {position && accuracy && (
          <Circle
            center={position}
            radius={accuracy}
            pathOptions={{
              color: "#6B8C72",
              fillColor: "#6B8C72",
              fillOpacity: 0.15,
            }}
          />
        )}

        <Marker position={position || USER_POS} icon={userPinIcon} />
        <Marker position={DEST_POS} icon={destPinIcon} />
      </MapContainer>
    </div>
  );
};

// cardData moved inside component to access state

// ── Particle helpers ─────────────────────────────────────────
const createParticleElement = (x, y, color = DEFAULT_GLOW_COLOR) => {
  const el = document.createElement('div');
  el.className = 'particle';
  el.style.cssText = `position:absolute;width:3px;height:3px;border-radius:50%;background:rgba(${color},0.7);box-shadow:0 0 4px rgba(${color},0.4);pointer-events:none;z-index:100;left:${x}px;top:${y}px;`;
  return el;
};

const calculateSpotlightValues = radius => ({ proximity: radius * 0.5, fadeDistance: radius * 0.75 });

const updateCardGlowProperties = (card, mouseX, mouseY, glow, radius) => {
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--glow-x', `${((mouseX - rect.left) / rect.width) * 100}%`);
  card.style.setProperty('--glow-y', `${((mouseY - rect.top) / rect.height) * 100}%`);
  card.style.setProperty('--glow-intensity', glow.toString());
  card.style.setProperty('--glow-radius', `${radius}px`);
};

// ── ParticleCard ─────────────────────────────────────────────
const ParticleCard = ({ children, className = '', disableAnimations = false, style, particleCount = DEFAULT_PARTICLE_COUNT, glowColor = DEFAULT_GLOW_COLOR, enableTilt = false, clickEffect = false, enableMagnetism = false }) => {
  const cardRef = useRef(null);
  const particlesRef = useRef([]);
  const timeoutsRef = useRef([]);
  const isHoveredRef = useRef(false);
  const memoizedParticles = useRef([]);
  const particlesInitialized = useRef(false);

  const initializeParticles = useCallback(() => {
    if (particlesInitialized.current || !cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    memoizedParticles.current = Array.from({ length: particleCount }, () =>
      createParticleElement(Math.random() * width, Math.random() * height, glowColor));
    particlesInitialized.current = true;
  }, [particleCount, glowColor]);

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    particlesRef.current.forEach(p => gsap.to(p, { scale: 0, opacity: 0, duration: 0.3, ease: 'back.in(1.7)', onComplete: () => p.parentNode?.removeChild(p) }));
    particlesRef.current = [];
  }, []);

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return;
    if (!particlesInitialized.current) initializeParticles();
    memoizedParticles.current.forEach((particle, index) => {
      const t = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;
        const clone = particle.cloneNode(true);
        cardRef.current.appendChild(clone);
        particlesRef.current.push(clone);
        gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });
        gsap.to(clone, { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80, rotation: Math.random() * 360, duration: 2 + Math.random() * 2, ease: 'none', repeat: -1, yoyo: true });
        gsap.to(clone, { opacity: 0.2, duration: 1.5, ease: 'power2.inOut', repeat: -1, yoyo: true });
      }, index * 100);
      timeoutsRef.current.push(t);
    });
  }, [initializeParticles]);

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return;
    const el = cardRef.current;

    const onEnter = () => { isHoveredRef.current = true; animateParticles(); };
    const onLeave = () => { isHoveredRef.current = false; clearAllParticles(); if (enableMagnetism) gsap.to(el, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' }); };
    const onMove = e => {
      if (!enableTilt && !enableMagnetism) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      if (enableTilt) gsap.to(el, { rotateX: ((y - rect.height/2) / rect.height * 2) * -8, rotateY: ((x - rect.width/2) / rect.width * 2) * 8, duration: 0.1, ease: 'power2.out', transformPerspective: 1000 });
      if (enableMagnetism) gsap.to(el, { x: (x - rect.width/2) * 0.04, y: (y - rect.height/2) * 0.04, duration: 0.3, ease: 'power2.out' });
    };
    const onClick = e => {
      if (!clickEffect) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      const md = Math.max(Math.hypot(x, y), Math.hypot(x - rect.width, y), Math.hypot(x, y - rect.height), Math.hypot(x - rect.width, y - rect.height));
      const ripple = document.createElement('div');
      ripple.style.cssText = `position:absolute;width:${md*2}px;height:${md*2}px;border-radius:50%;background:radial-gradient(circle,rgba(${glowColor},0.25) 0%,rgba(${glowColor},0.1) 35%,transparent 70%);left:${x-md}px;top:${y-md}px;pointer-events:none;z-index:1000;`;
      el.appendChild(ripple);
      gsap.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.9, ease: 'power2.out', onComplete: () => ripple.remove() });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('click', onClick);
    return () => { isHoveredRef.current = false; el.removeEventListener('mouseenter', onEnter); el.removeEventListener('mouseleave', onLeave); el.removeEventListener('mousemove', onMove); el.removeEventListener('click', onClick); clearAllParticles(); };
  }, [animateParticles, clearAllParticles, disableAnimations, enableTilt, enableMagnetism, clickEffect, glowColor]);

  return (
    <div ref={cardRef} className={`${className} particle-container`} style={{ ...style, position: 'relative', overflow: 'hidden' }}>
      {children}
    </div>
  );
};

// ── GlobalSpotlight ──────────────────────────────────────────
const GlobalSpotlight = ({ gridRef, disableAnimations = false, enabled = true, spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS, glowColor = DEFAULT_GLOW_COLOR }) => {
  const spotlightRef = useRef(null);
  useEffect(() => {
    if (disableAnimations || !gridRef?.current || !enabled) return;
    const spotlight = document.createElement('div');
    spotlight.className = 'global-spotlight';
    spotlight.style.cssText = `position:fixed;width:600px;height:600px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(${glowColor},0.1) 0%,rgba(${glowColor},0.05) 20%,rgba(${glowColor},0.02) 40%,transparent 65%);z-index:200;opacity:0;transform:translate(-50%,-50%);mix-blend-mode:multiply;`;
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const onMove = e => {
      if (!spotlightRef.current || !gridRef.current) return;
      const section = gridRef.current.closest('.bento-section');
      const rect = section?.getBoundingClientRect();
      const inside = rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      const cards = gridRef.current.querySelectorAll('.magic-bento-card');
      if (!inside) { gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3 }); cards.forEach(c => c.style.setProperty('--glow-intensity', '0')); return; }
      const { proximity, fadeDistance } = calculateSpotlightValues(spotlightRadius);
      let minDist = Infinity;
      cards.forEach(card => {
        const cr = card.getBoundingClientRect();
        const d = Math.max(0, Math.hypot(e.clientX - (cr.left + cr.width/2), e.clientY - (cr.top + cr.height/2)) - Math.max(cr.width, cr.height)/2);
        minDist = Math.min(minDist, d);
        updateCardGlowProperties(card, e.clientX, e.clientY, d <= proximity ? 1 : d <= fadeDistance ? (fadeDistance-d)/(fadeDistance-proximity) : 0, spotlightRadius);
      });
      gsap.to(spotlightRef.current, { left: e.clientX, top: e.clientY, duration: 0.1 });
      const tOp = minDist <= proximity ? 0.6 : minDist <= fadeDistance ? ((fadeDistance-minDist)/(fadeDistance-proximity))*0.6 : 0;
      gsap.to(spotlightRef.current, { opacity: tOp, duration: tOp > 0 ? 0.2 : 0.5 });
    };
    const onLeave = () => { gridRef.current?.querySelectorAll('.magic-bento-card').forEach(c => c.style.setProperty('--glow-intensity', '0')); if (spotlightRef.current) gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3 }); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseleave', onLeave); spotlightRef.current?.parentNode?.removeChild(spotlightRef.current); };
  }, [gridRef, disableAnimations, enabled, spotlightRadius, glowColor]);
  return null;
};

const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
};

// ── Card render helpers ──────────────────────────────────────
const TagPill = ({ label, tagStyle }) => (
  <div className={`bento-tag bento-tag--${tagStyle}`}>{label}</div>
);

// renderCardContent moved inside component to access state

// ── Main MagicBento ──────────────────────────────────────────
const MagicBento = ({
  textAutoHide = true,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = false,
  glowColor = "212, 160, 188",
  clickEffect = true,
  enableMagnetism = false,
}) => {
  const gridRef = useRef(null);
  const isMobile = useMobileDetection();
  const shouldDisable = disableAnimations || isMobile;

  const [isAudioOn, setIsAudioOn] = useState(true);

  const { filterStatus, sosTriggered } = useGuardianSocket();
  const isThreat = filterStatus === 'threat' || sosTriggered;

  const cardData = [
    { color: '#FDFAF7', label: 'Audio', tagStyle: 'sage', extra: 'guardian-card' },
    { color: '#0A0A0E', label: 'Camera', tagStyle: 'hint', extra: 'camera' },
    { color: '#EDE8E1', label: 'Live', tagStyle: 'sage', extra: 'map' },
  ];

  const baseClass = (card) => {
    const mapClass    = card.extra === 'map'    ? 'bento-card--map'    : '';
    const cameraClass = card.extra === 'camera' ? 'bento-card--camera' : '';
    const glowClass   = enableBorderGlow ? 'magic-bento-card--border-glow' : '';
    return `magic-bento-card ${glowClass} ${mapClass} ${cameraClass}`.trim();
  };

  const renderCardContent = (card) => (
    <>
      <div className="magic-bento-card__header mb-header-row">
        <TagPill label={card.label} tagStyle={card.tagStyle} />
        {card.extra === 'guardian-card' && (
          <button className={`mb-toggle ${isAudioOn ? 'mb-toggle--on' : ''}`} onClick={(e) => { e.stopPropagation(); setIsAudioOn(!isAudioOn); }}>
            <div className="mb-toggle-thumb" />
          </button>
        )}
        {card.extra === 'map' && (
          <div className="bento-live-badge"><span className="bento-live-dot" /> Live</div>
        )}
      </div>

      <div className="magic-bento-card__content" style={{ position: 'relative' }}>
        {card.extra === 'map' && (
          <div className="bento-map-wrap" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            {/* The Map itself with fade-in */}
            <div style={{ opacity: isThreat ? 1 : 0, transition: 'opacity 600ms ease-in-out', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: isThreat ? 2 : 0, visibility: isThreat ? 'visible' : 'hidden' }}>
              <BentoLiveMap />
              <div className="bento-map-bottom">
                <div className="bento-map-bottom-left">
                  <span className="bento-map-road">MG Road</span>
                  <span className="bento-map-km">1.4 km remaining</span>
                </div>
                <span className="bento-map-route-pill">On route</span>
              </div>
            </div>
            
            {/* The Placeholder */}
            <div style={{ opacity: isThreat ? 0 : 1, transition: 'opacity 600ms ease-in-out', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3EE', zIndex: isThreat ? 0 : 2, visibility: isThreat ? 'hidden' : 'visible' }}>
              <p style={{ color: '#1C1410', opacity: 0.6, fontSize: '0.9rem', textAlign: 'center', padding: '0 1rem', fontFamily: 'DM Sans, sans-serif' }}>
                📍 Map activates when guardian detects a threat
              </p>
            </div>
          </div>
        )}
        
        {card.extra === 'camera' && (
          <CameraCard isThreat={isThreat} />
        )}
        
        {card.extra === 'guardian-card' && (
          isAudioOn ? <GuardianCard /> : <div className="mb-off-state"><span style={{fontSize:'1.8em'}}>⏸</span>Audio monitoring is off</div>
        )}
      </div>
    </>
  );


  return (
    <>
      {enableSpotlight && <GlobalSpotlight gridRef={gridRef} disableAnimations={shouldDisable} enabled={enableSpotlight} spotlightRadius={spotlightRadius} glowColor={glowColor} />}
      <div className="card-grid bento-section" ref={gridRef}>
        {cardData.map((card, index) => {
          const cardStyle = { backgroundColor: card.color };
          if (enableStars) {
            return (
              <ParticleCard key={index} className={baseClass(card)} style={cardStyle} disableAnimations={shouldDisable} particleCount={particleCount} glowColor={glowColor} enableTilt={enableTilt} clickEffect={clickEffect} enableMagnetism={enableMagnetism}>
                {renderCardContent(card)}
              </ParticleCard>
            );
          }
          return <div key={index} className={baseClass(card)} style={cardStyle}>{renderCardContent(card)}</div>;
        })}
      </div>
    </>
  );
};

export default MagicBento;

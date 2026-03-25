import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Hyperspeed from '../components/Hyperspeed';
import './Landing.css';

const NIRVAN_PRESET = {
  distortion: 'turbulentDistortion',
  length: 400,
  roadWidth: 9,
  islandWidth: 2,
  lanesPerRoad: 3,
  fov: 90,
  fovSpeedUp: 150,
  speedUp: 0.6,
  carLightsFade: 0.4,
  totalSideLightSticks: 20,
  lightPairsPerRoadWay: 40,
  shoulderLinesWidthPercentage: 0.05,
  brokenLinesWidthPercentage: 0.1,
  brokenLinesLengthPercentage: 0.5,
  lightStickWidth: [0.12, 0.5],
  lightStickHeight: [1.3, 1.7],
  movingAwaySpeed: [25, 40],
  movingCloserSpeed: [-45, -65],
  carLightsLength: [400 * 0.03, 400 * 0.2],
  carLightsRadius: [0.05, 0.14],
  carWidthPercentage: [0.3, 0.5],
  carShiftX: [-0.8, 0.8],
  carFloorSeparation: [0, 5],
  colors: {
    roadColor: 0x0d0d0d,
    islandColor: 0x111111,
    background: 0x050305,
    shoulderLines: 0x1a0f18,
    brokenLines: 0x1a0f18,
    leftCars:  [0xD4A0BC, 0xC4809C, 0xE8B4CC],
    rightCars: [0xF5C87A, 0xE8A84A, 0xF0D090],
    sticks: 0xD4A0BC,
  },
};

const WAVE_PANELS = [
  { bg: '#D4A0BC', delay: 0,    duration: 0.28 },
  { bg: '#2d1535', delay: 0.04, duration: 0.30 },
  { bg: '#1A0E18', delay: 0.08, duration: 0.32 },
];

export default function Landing() {
  const navigate      = useNavigate();
  const effectOptions = useMemo(() => NIRVAN_PRESET, []);
  const [waving, setWaving] = useState(false);

  const handleGetStarted = () => {
    if (waving) return;
    setWaving(true);
    setTimeout(() => navigate('/auth'), 340);
  };

  return (
    <div className="landing">
      {/* Hyperspeed background */}
      <div className="landing-bg">
        <motion.div
          style={{ width: '100%', height: '100%' }}
          animate={waving ? { scale: 1.08 } : { scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Hyperspeed effectOptions={effectOptions} />
        </motion.div>
        <div className="landing-overlay" />
      </div>

      {/* UI Layer */}
      <motion.div
        className="landing-content"
        animate={waving ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      >
        <nav className="landing-nav">
          <div className="landing-logo">
            <span className="logo-gem">◈</span>
            <span className="logo-wordmark">Nirvan</span>
          </div>
          <a href="#" className="nav-link">About</a>
        </nav>

        <div className="landing-hero">
          <div className="landing-badge">
            <span className="badge-dot" />
            AI Guardian · Women's Safety
          </div>
          <h1 className="landing-title">Walk in peace.</h1>
          <p className="landing-tagline">Your AI guardian is listening.</p>
          <p className="landing-sub">
            Nirvan silently watches over you every step of the way —<br />
            detecting danger before you have to ask for help.
          </p>
          <div className="landing-actions">
            <button className="btn-get-started" onClick={handleGetStarted}>
              Get Started
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="btn-learn" onClick={handleGetStarted}>Sign In</button>
          </div>
          <p className="landing-hint">Hold anywhere on screen to experience hyperspeed</p>
        </div>

        <div className="landing-scroll">
          <div className="scroll-orb" />
        </div>

        <div className="landing-footer-strip">
          <span>97% detection accuracy</span>
          <span className="strip-sep">·</span>
          <span>3s SOS delivery</span>
          <span className="strip-sep">·</span>
          <span>On-device AI — zero audio stored</span>
        </div>
      </motion.div>

      {/* 3-panel sweep transition */}
      <AnimatePresence>
        {waving && WAVE_PANELS.map((panel, i) => (
          <motion.div
            key={i}
            style={{
              position: 'fixed', inset: 0,
              background: panel.bg,
              zIndex: 9998 + i,
            }}
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: panel.duration, delay: panel.delay, ease: [0.77, 0, 0.175, 1] }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MagicBento from '../components/MagicBento';
import Orb from '../components/Orb';
import RouteMapPage from './RouteMapPage';
import GuardianPage from './GuardianPage';
import MyCirclePage from './MyCirclePage';
import SettingsPage from './SettingsPage';
import { useGuardianSocket } from '../hooks/useGuardianSocket.js';
import { auth } from '../firebase.js';
import './Dashboard.css';


const NAV_ITEMS = [
  {
    id: 'home', label: 'Home',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  },
  {
    id: 'map', label: 'Map',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
  },
  {
    id: 'shield', label: 'Shield',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  },
  {
    id: 'contacts', label: 'People',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  },
  {
    id: 'settings', label: 'Settings',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  },
];

const EMERGENCY_STATUSES = [
  { id: 1, text: 'Guardian Network Notified', delay: 0 },
  { id: 2, text: 'Live Audio Recording Active', delay: 800 },
  { id: 3, text: 'GPS Location Transmitted', delay: 1600 },
  { id: 4, text: 'Connecting to Local Authorities…', delay: 2400 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('home');
  const [isEmergency, setIsEmergency] = useState(false);
  const [shownStatuses, setShownStatuses] = useState([]);
  const [autoCallContact, setAutoCallContact] = useState(null);
  const [isWalking, setIsWalking] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const { isConnected } = useGuardianSocket();

  // Live clock
  const [liveTime, setLiveTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const formattedTime = liveTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Load saved emergency contacts from localStorage
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nirvan_contacts');
      if (saved) setEmergencyContacts(JSON.parse(saved));
    } catch {}
  }, [isEmergency]); // refresh when SOS opens

  // Timer for active walk
  useEffect(() => {
    if (!isWalking) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [isWalking]);

  // Emergency status animation
  useEffect(() => {
    if (!isEmergency) { setShownStatuses([]); return; }
    EMERGENCY_STATUSES.forEach(s => {
      setTimeout(() => setShownStatuses(prev => [...prev, s.id]), s.delay);
    });
  }, [isEmergency]);

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const triggerEmergency = () => {
    setIsEmergency(true);
    // Auto-call first contact with a phone number after 2s
    try {
      const saved = localStorage.getItem('nirvan_contacts');
      if (saved) {
        const contacts = JSON.parse(saved);
        const first = contacts.find(c => c.phone);
        if (first) {
          setAutoCallContact(first);
          setTimeout(() => {
            window.location.href = `tel:${first.phone}`;
          }, 2000);
        }
      }
    } catch {}
  };

  const cancelEmergency = () => {
    setIsEmergency(false);
    setShownStatuses([]);
    setAutoCallContact(null);
  };

  return (
    <div className="dash">
      {/* Sidebar */}
      <nav className="dash-sidebar">
        <div className="sidebar-logo">
          <svg viewBox="0 0 20 22" fill="none" width="16" height="18">
            <path d="M10 2L3 5v7c0 5.25 3.5 9 7 11 3.5-2 7-5.75 7-11V5L10 2z" fill="#FDFAF7" opacity="0.9"/>
          </svg>
        </div>
        <div className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-btn ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>
        <button className="sidebar-btn sidebar-logout" onClick={() => navigate('/')} title="Exit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </nav>

      {/* Main */}
      <div className="dash-main">
        {/* Header */}
        <header className="dash-header">
          <div className="dash-header-left">
            <h1 className="dash-greeting">Hello, <span className="greeting-name">{auth.currentUser?.displayName?.split(' ')[0] || 'Guardian'}</span></h1>
            <div className="dash-status">
              <span className={`status-dot ${isWalking ? 'active' : ''}`}/>
              <span className="status-text">
                {isWalking ? `Active Guardian · Walk ${formatTime(elapsed)}` : 'Guardian Standby'}
              </span>
            </div>
          </div>
          <div className="dash-header-right">
            <div className="dash-weather">
                <span>🌙</span>
                <span>{formattedTime} · Hyderabad</span>
            </div>
            {/* Backend connection indicator */}
            <div className={`dash-conn-dot ${isConnected ? 'dash-conn-dot--on' : 'dash-conn-dot--off'}`}>
              <span className="dash-conn-pip" />
              <span className="dash-conn-label">{isConnected ? 'Backend Connected' : 'Reconnecting...'}</span>
            </div>
            <button
              className={`btn-sos ${isWalking ? '' : 'standby'}`}
              onClick={triggerEmergency}
            >
              <span className="sos-ring"/>
              SOS
            </button>
          </div>
        </header>

        {/* Pages */}
        <div className="dash-page">
          {activeNav === 'home' && (
            <div className="dash-bento">
              <MagicBento
                textAutoHide={true}
                enableStars={true}
                enableSpotlight={true}
                enableBorderGlow={true}
                enableTilt={false}
                enableMagnetism={false}
                clickEffect={true}
                spotlightRadius={400}
                particleCount={8}
                glowColor="107, 140, 114"
                disableAnimations={false}
              />
            </div>
          )}
          {activeNav === 'map' && <RouteMapPage />}
          {activeNav === 'shield' && <GuardianPage />}
          {activeNav === 'contacts' && <MyCirclePage />}
          {activeNav === 'settings' && <SettingsPage onNavigate={setActiveNav} />}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav">
        {NAV_ITEMS.slice(0, 4).map(item => (
          <button
            key={item.id}
            className={`mobile-nav-btn ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => setActiveNav(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button className="mobile-nav-btn mobile-sos-btn" onClick={triggerEmergency}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>SOS</span>
        </button>
      </nav>

      {/* Emergency Modal */}
      {isEmergency && (
        <div className="emergency-modal">
          <div className="em-bg" />

          {/* Orb sits naturally in flex-flow at the top */}
          <div className="em-orb-wrap">
            <Orb hue={270} hoverIntensity={2} rotateOnHover forceHoverState backgroundColor="#0A0718" />
          </div>

          {/* Content overlaps orb from below */}
          <div className="em-content">
            <p className="em-label">NIRVAN GUARDIAN</p>
            <h2 className="em-title">Alert<br/>Activated.</h2>
            <p className="em-sub">Your network has been notified. Help is on the way.</p>

            {autoCallContact && (
              <div className="em-autocall-banner">
                <div className="em-autocall-ring" />
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
                <span>Calling <strong>{autoCallContact.name}</strong>…</span>
              </div>
            )}

            <div className="em-status-list">
              {EMERGENCY_STATUSES.map(s => (
                <div key={s.id} className={`em-status-item ${shownStatuses.includes(s.id) ? 'visible' : ''}`}>
                  <span className="em-status-check">
                    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                      <circle cx="8" cy="8" r="7" stroke="rgba(167,139,250,0.4)" strokeWidth="1"/>
                      {shownStatuses.includes(s.id) && (
                        <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      )}
                    </svg>
                  </span>
                  <span className="em-status-text">{s.text}</span>
                </div>
              ))}
            </div>

            {emergencyContacts.length > 0 && (
              <div className="em-actions">
                <p className="em-contacts-label">Or tap to call</p>
                <div className="em-contacts-list">
                  {emergencyContacts.map((c, i) => (
                    <a
                      key={i}
                      href={c.phone ? `tel:${c.phone}` : undefined}
                      className={`em-contact-card ${!c.phone ? 'em-contact-card--nophone' : ''} ${autoCallContact?.name === c.name ? 'em-contact-card--calling' : ''}`}
                      onClick={!c.phone ? e => e.preventDefault() : undefined}
                    >
                      <div className="em-contact-avatar">{c.initials}</div>
                      <div className="em-contact-info">
                        <span className="em-contact-name">{c.name}</span>
                        <span className="em-contact-relation">{c.relation}</span>
                      </div>
                      <div className="em-contact-call-btn">
                        {c.phone
                          ? <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                          : <span className="em-no-phone">Add #</span>
                        }
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <button className="em-btn-cancel" onClick={cancelEmergency}>
              I&apos;m Safe — Cancel Alert
            </button>
          </div>
        </div>
      )}

    </div>
  );
}


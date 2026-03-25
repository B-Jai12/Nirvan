import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Permissions.css';

const PERMS = [
  {
    id: 'audio',
    title: 'Microphone Access',
    desc: 'Listens for distress sounds and activates your audio shield.',
    required: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
        <path d="M19 10a7 7 0 0 1-14 0M12 19v3M9 22h6"/>
      </svg>
    ),
  },
  {
    id: 'location',
    title: 'Location Tracking',
    desc: 'Shares your live GPS route with your guardian network.',
    required: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
    ),
  },
  {
    id: 'camera',
    title: 'Camera Access',
    desc: 'Captures evidence automatically when SOS is triggered.',
    required: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    ),
  },
  {
    id: 'notifications',
    title: 'Notifications',
    desc: 'Sends instant alerts to your guardians when you need help.',
    required: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
];

export default function Permissions() {
  const navigate = useNavigate();
  const [perms, setPerms] = useState(PERMS.map(p => ({ ...p, granted: false })));
  const [animating, setAnimating] = useState(false);

  const togglePerm = (id) => {
    setPerms(p => p.map(item => item.id === id ? { ...item, granted: !item.granted } : item));
  };

  const handleBegin = () => {
    setAnimating(true);
    setTimeout(() => navigate('/dashboard'), 500);
  };

  return (
    <div className="perm-page">
      {/* Left — warm dark decorative panel */}
      <div className="perm-left">
        {/* Animated rings */}
        <div className="perm-rings">
          <div className="perm-ring perm-ring-1"/>
          <div className="perm-ring perm-ring-2"/>
          <div className="perm-ring perm-ring-3"/>
        </div>

        {/* Shield center */}
        <div className="perm-shield-wrap">
          <div className="perm-shield-glow"/>
          <svg viewBox="0 0 60 68" fill="none" className="perm-shield-svg">
            <path d="M30 4L6 14v20c0 16.5 10.5 27 24 33 13.5-6 24-16.5 24-33V14L30 4z"
              fill="rgba(245,200,160,0.08)" stroke="rgba(245,200,160,0.4)" strokeWidth="1.5"/>
            <path d="M30 16L16 22v12c0 9 6 15 14 18 8-3 14-9 14-18V22L30 16z"
              fill="rgba(245,200,160,0.12)" stroke="rgba(245,200,160,0.3)" strokeWidth="1"/>
            {/* checkmark */}
            <path d="M22 34l5 5 11-11" stroke="rgba(245,200,160,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Logo */}
        <div className="perm-left-logo">
          <svg viewBox="0 0 20 22" fill="none" width="16" height="18">
            <path d="M10 2L3 5v7c0 5.25 3.5 9 7 11 3.5-2 7-5.75 7-11V5L10 2z" fill="rgba(245,220,190,0.8)"/>
          </svg>
          <span>Nirvan</span>
        </div>

        <div className="perm-left-copy">
          <p className="perm-quote">"Your safety starts<br/>with your settings."</p>
          <p className="perm-left-sub">Grant permissions to activate<br/>your AI guardian shields.</p>
        </div>

        {/* Floating sparkles */}
        <div className="perm-sparkle perm-sparkle-1"/>
        <div className="perm-sparkle perm-sparkle-2"/>
        <div className="perm-sparkle perm-sparkle-3"/>
        <div className="perm-sparkle perm-sparkle-4"/>
      </div>

      {/* Right — permissions */}
      <div className="perm-right">
        <div className="perm-content">
          <div className="perm-header">
            <p className="perm-label">Before we begin</p>
            <h2 className="perm-title">Allow Nirvan to<br/>protect you.</h2>
            <p className="perm-sub">These permissions let your AI guardian watch over you. Required ones are marked.</p>
          </div>

          <div className="perm-list">
            {perms.map((perm, i) => (
              <div
                className={`perm-item ${perm.granted ? 'granted' : ''}`}
                key={perm.id}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`perm-icon-wrap ${perm.granted ? 'granted' : ''}`}>
                  {perm.icon}
                </div>
                <div className="perm-item-info">
                  <div className="perm-item-title-row">
                    <span className="perm-item-title">{perm.title}</span>
                    {perm.required && <span className="perm-required">Required</span>}
                  </div>
                  <span className="perm-item-desc">{perm.desc}</span>
                </div>
                <button
                  className={`perm-toggle ${perm.granted ? 'on' : ''}`}
                  onClick={() => togglePerm(perm.id)}
                  aria-label={`Toggle ${perm.title}`}
                >
                  <span className="perm-toggle-knob"/>
                </button>
              </div>
            ))}
          </div>

          <button
            className={`btn-begin ${animating ? 'animating' : ''}`}
            onClick={handleBegin}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M12 2L4 6v6c0 5.25 3.5 9 8 11 4.5-2 8-5.75 8-11V6L12 2z" strokeLinecap="round"/>
            </svg>
            Begin My Journey
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

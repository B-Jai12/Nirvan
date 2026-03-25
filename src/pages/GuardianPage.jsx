import { useState } from 'react';
import './GuardianPage.css';

const AGENTS = [
  {
    id: 'audio',
    title: 'Audio Threat Detector',
    status: 'Listening',
    statusClass: 'gp-status--active',
    desc: 'Monitors ambient audio continuously for distress patterns in EN, HI & TE. Alerts fire within 1.2s of keyword detection.',
    detail: 'threat_meter',
    threatLevel: 4,
    signals: ['EN: help, stop, let go', 'HI: bachao, chhodo', 'TE: vaddu, eripuka'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="18" height="18">
        <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
        <path d="M19 10a7 7 0 0 1-14 0M12 19v3M9 22h6"/>
      </svg>
    ),
  },
  {
    id: 'movement',
    title: 'Movement Pattern Agent',
    status: 'Analysing',
    statusClass: 'gp-status--active',
    desc: 'Analyses camera feed for sudden movements, crowd anomalies, and threat gestures using on-device vision models.',
    detail: 'modes',
    modes: ['Sudden motion detection', 'Crowd dispersal pattern', 'Threat gesture recognition'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="18" height="18">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    id: 'location',
    title: 'Location Anomaly Agent',
    status: 'GPS Active',
    statusClass: 'gp-status--active',
    desc: 'High-accuracy GPS pings every 30 seconds. Detects route deviations and unusual stops. Falls back to cell tower if GPS drops.',
    detail: 'stats',
    stats: [{ val: '3 m', lbl: 'GPS Accuracy' }, { val: '30 s', lbl: 'Update Interval' }, { val: '3', lbl: 'Guardians Tracking' }],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="18" height="18">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
      </svg>
    ),
  },
  {
    id: 'filter',
    title: 'False Alarm Filter Agent',
    status: 'Calibrated',
    statusClass: 'gp-status--active',
    desc: 'Prevents false SOS triggers by cross-referencing audio, vision, and location signals before escalating. Accuracy: 97%.',
    detail: 'modes',
    modes: ['Context cross-referencing', 'Confidence threshold gating', '3-signal consensus check'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="18" height="18">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'emergency',
    title: 'Emergency Alert Agent',
    status: 'On Standby',
    statusClass: 'gp-status--standby',
    desc: 'The final responder. Dispatches SOS to all 3 guardians simultaneously with live location and audio snippet in under 3 seconds.',
    detail: 'stats',
    stats: [{ val: '3s', lbl: 'Alert Speed' }, { val: '3', lbl: 'Guardians Alerted' }, { val: '0', lbl: 'False Triggers' }],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="18" height="18">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
];

export default function GuardianPage() {
  const [threatLevel] = useState(4);

  return (
    <div className="gp-page">
      <div className="gp-grid">
        {AGENTS.map(agent => (
          <div className="gp-card" key={agent.id}>
            <div className="gp-card-header">
              <div className="gp-agent-icon">{agent.icon}</div>
              <div>
                <h3 className="gp-card-title">{agent.title}</h3>
                <span className={`gp-status-pill ${agent.statusClass}`}>
                  <span className="gp-status-dot"/>{agent.status}
                </span>
              </div>
            </div>
            <p className="gp-card-desc">{agent.desc}</p>

            {agent.detail === 'threat_meter' && (
              <>
                <div className="gp-section-label">Current Threat Level</div>
                <div className="gp-threat-bar-wrap">
                  <div className="gp-threat-bar">
                    <div className="gp-threat-fill" style={{ width: `${threatLevel}%` }}/>
                  </div>
                  <div className="gp-threat-labels">
                    <span className="gp-threat-val" style={{ color: '#C4998A' }}>Very Low</span>
                    <span className="gp-threat-pct">{threatLevel}%</span>
                  </div>
                </div>
                <div className="gp-signal-row">
                  {agent.signals.map(s => <span key={s} className="gp-signal-chip">{s}</span>)}
                </div>
              </>
            )}

            {agent.detail === 'modes' && (
              <>
                <div className="gp-section-label">Detection Modes</div>
                <div className="gp-mode-list">
                  {agent.modes.map((m, i) => (
                    <div key={i} className="gp-mode-row">
                      <span className="gp-mode-check">✓</span>
                      <span className="gp-mode-name">{m}</span>
                      <span className="gp-mode-badge">Running</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {agent.detail === 'stats' && (
              <div className="gp-loc-stats">
                {agent.stats.map(s => (
                  <div key={s.lbl} className="gp-loc-stat">
                    <span className="gp-loc-val">{s.val}</span>
                    <span className="gp-loc-lbl">{s.lbl}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="gp-status-bar">
        <span className="gp-status-bar-dot"/>
        <span className="gp-status-bar-text">All 5 agents running · Zero threats detected · Walk duration 00:15</span>
      </div>
    </div>
  );
}

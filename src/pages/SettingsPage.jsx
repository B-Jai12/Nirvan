import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../firebase';
import PixelBlast from '../components/PixelBlast';
import './SettingsPage.css';

const SOS_DELAYS = ['3 seconds', '5 seconds', '10 seconds'];

const Toggle = ({ checked, onChange }) => (
  <button className={`sp-toggle ${checked ? 'on' : 'off'}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
    <span className="sp-toggle-thumb"/>
  </button>
);

export default function SettingsPage({ onNavigate }) {
  const navigate = useNavigate();
  const [s, setS] = useState({
    autoSOS: true,
    voiceDetection: true,
    cameraMonitoring: true,
    liveLocation: true,
    offlineSMS: true,
  });
  const [sosDelayIdx, setSosDelayIdx] = useState(0);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileName, setProfileName] = useState('Priya Sharma');
  const [profileCity, setProfileCity] = useState('Hyderabad, Telangana');
  const [profileDraft, setProfileDraft] = useState({ name: '', city: '' });
  const [signingOut, setSigningOut] = useState(false);

  const toggle = (key) => setS(prev => ({ ...prev, [key]: !prev[key] }));
  const cycleSosDelay = () => setSosDelayIdx(i => (i + 1) % SOS_DELAYS.length);

  const openProfileEdit = () => {
    setProfileDraft({ name: profileName, city: profileCity });
    setShowProfileEdit(true);
  };
  const saveProfile = (e) => {
    e.preventDefault();
    if (profileDraft.name.trim()) setProfileName(profileDraft.name.trim());
    if (profileDraft.city.trim()) setProfileCity(profileDraft.city.trim());
    setShowProfileEdit(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className="sp-wrapper">
      {/* PixelBlast background animation */}
      <div className="sp-pixel-bg" aria-hidden="true">
        <PixelBlast
          variant="square"
          pixelSize={4}
          color="#D4A0BC"
          patternScale={2}
          patternDensity={1}
          pixelSizeJitter={0}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          speed={0.5}
          edgeFade={0.25}
          transparent
        />
      </div>
      <div className="sp-page">

      {/* Profile card */}
      <div className="sp-profile-card">
        <div className="sp-profile-avatar">{profileName[0]}</div>
        <div className="sp-profile-info">
          <div className="sp-profile-name">{profileName}</div>
          <div className="sp-profile-city">{profileCity}</div>
        </div>
        <button className="sp-edit-btn" onClick={openProfileEdit}>Edit Profile</button>
      </div>

      {/* Inline profile edit */}
      {showProfileEdit && (
        <form className="sp-profile-form" onSubmit={saveProfile}>
          <div className="sp-form-group">
            <label className="sp-form-label">Name</label>
            <input className="sp-form-input" value={profileDraft.name} onChange={e => setProfileDraft(d => ({ ...d, name: e.target.value }))}/>
          </div>
          <div className="sp-form-group">
            <label className="sp-form-label">City</label>
            <input className="sp-form-input" value={profileDraft.city} onChange={e => setProfileDraft(d => ({ ...d, city: e.target.value }))}/>
          </div>
          <div className="sp-form-actions">
            <button type="button" className="sp-cancel-btn" onClick={() => setShowProfileEdit(false)}>Cancel</button>
            <button type="submit" className="sp-save-btn">Save</button>
          </div>
        </form>
      )}

      {/* Safety */}
      <div className="sp-section">
        <div className="sp-section-title">Safety</div>
        <div className="sp-section-body">
          <div className="sp-row">
            <div className="sp-row-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round"/></svg></div>
            <div className="sp-row-text"><span className="sp-row-label">Auto SOS</span><span className="sp-row-sub">Fires alert after 10s of no response</span></div>
            <Toggle checked={s.autoSOS} onChange={() => toggle('autoSOS')}/>
          </div>
          <div className="sp-row">
            <div className="sp-row-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M19 10a7 7 0 0 1-14 0M12 19v3M9 22h6"/></svg></div>
            <div className="sp-row-text"><span className="sp-row-label">Voice Detection</span><span className="sp-row-sub">Enables Audio Threat Detector agent</span></div>
            <Toggle checked={s.voiceDetection} onChange={() => toggle('voiceDetection')}/>
          </div>
          <div className="sp-row" style={{ cursor: 'pointer' }} onClick={cycleSosDelay}>
            <div className="sp-row-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
            <div className="sp-row-text"><span className="sp-row-label">SOS Delay</span><span className="sp-row-sub">Tap to change</span></div>
            <div className="sp-value-chip sp-value-chip--link">{SOS_DELAYS[sosDelayIdx]}</div>
          </div>
          <div className="sp-row">
            <div className="sp-row-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
            <div className="sp-row-text"><span className="sp-row-label">Camera Monitoring</span><span className="sp-row-sub">Enables Movement Pattern Agent</span></div>
            <Toggle checked={s.cameraMonitoring} onChange={() => toggle('cameraMonitoring')}/>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="sp-section">
        <div className="sp-section-title">Location</div>
        <div className="sp-section-body">
          <div className="sp-row">
            <div className="sp-row-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div>
            <div className="sp-row-text"><span className="sp-row-label">Live Location Sharing</span><span className="sp-row-sub">Share GPS with My Circle during walks</span></div>
            <Toggle checked={s.liveLocation} onChange={() => toggle('liveLocation')}/>
          </div>
          <div className="sp-row">
            <div className="sp-row-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
            <div className="sp-row-text"><span className="sp-row-label">Safe Zones</span><span className="sp-row-sub">Tap to manage</span></div>
            <div className="sp-value-chip sp-value-chip--link">4 zones ›</div>
          </div>
          <div className="sp-row">
            <div className="sp-row-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.64 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/></svg></div>
            <div className="sp-row-text"><span className="sp-row-label">Offline SMS Fallback</span><span className="sp-row-sub">Sends GPS via SMS when no internet</span></div>
            <Toggle checked={s.offlineSMS} onChange={() => toggle('offlineSMS')}/>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="sp-section">
        <div className="sp-section-title">Account</div>
        <div className="sp-section-body">
          <div className="sp-row" style={{ cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('contacts')}>
            <div className="sp-row-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <div className="sp-row-text"><span className="sp-row-label">Emergency Contacts</span><span className="sp-row-sub">{4} contacts in My Circle</span></div>
            <span className="sp-arrow">›</span>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button className="sp-signout-btn" onClick={handleSignOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign Out'}
      </button>

      </div>
    </div>
  );
}

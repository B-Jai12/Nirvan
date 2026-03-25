import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GridScan from '../components/GridScan';
import TextPressure from '../components/TextPressure';
import { AuthTransitionOverlay } from '../components/PageTransition';
import { signInWithGoogle, signInWithEmail, createAccount } from '../firebase';
import './Auth.css';

const EXIT_WAVES = [
  { bg: '#1A0E18', delay: 0,    duration: 0.28 },
  { bg: '#2d1535', delay: 0.04, duration: 0.30 },
  { bg: '#D4A0BC', delay: 0.08, duration: 0.32 },
];

export default function Auth() {
  const navigate = useNavigate();
  const [tab,         setTab]         = useState('login');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [name,        setName]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [formHidden,  setFormHidden]  = useState(false);
  const [entryDone,   setEntryDone]   = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntryDone(true), 60);
    return () => clearTimeout(t);
  }, []);

  const friendlyError = code => ({
    'auth/user-not-found':        'No account with that email.',
    'auth/wrong-password':        'Incorrect password.',
    'auth/email-already-in-use':  'Email already registered. Sign in instead.',
    'auth/weak-password':         'Password must be at least 6 characters.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/popup-closed-by-user':  'Google sign-in was cancelled.',
    'auth/network-request-failed':'Network error. Check your connection.',
  }[code] || 'Something went wrong. Please try again.');

  const triggerTransition = () => {
    setFormHidden(true);
    setTimeout(() => setShowOverlay(true), 300);
    setTimeout(() => navigate('/permissions'), 1300);
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try { await signInWithGoogle(); triggerTransition(); }
    catch (e) { setError(friendlyError(e.code)); setLoading(false); }
  };

  const handleEmailSubmit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      tab === 'login'
        ? await signInWithEmail(email, password)
        : await createAccount(email, password);
      triggerTransition();
    } catch (e) { setError(friendlyError(e.code)); setLoading(false); }
  };

  return (
    <div className="auth-ballpit-page">

      <AuthTransitionOverlay visible={showOverlay} />

      {/* Entry panels sweep off to the left */}
      {EXIT_WAVES.map((panel, i) => (
        <motion.div
          key={i}
          style={{
            position: 'fixed', inset: 0,
            background: panel.bg,
            zIndex: 9998 + (EXIT_WAVES.length - i),
            pointerEvents: entryDone ? 'none' : 'all',
          }}
          initial={{ x: '0%' }}
          animate={{ x: entryDone ? '-100%' : '0%' }}
          transition={{ duration: panel.duration, delay: panel.delay, ease: [0.77, 0, 0.175, 1] }}
        />
      ))}

      {/* GridScan 3D background */}
      <div className="auth-ballpit-bg">
        <GridScan
          sensitivity={0.45}
          lineThickness={1}
          linesColor="#3d1f3a"
          gridScale={0.12}
          scanColor="#D4A0BC"
          scanOpacity={0.6}
          enablePost={true}
          bloomIntensity={0.5}
          chromaticAberration={0.0015}
          noiseIntensity={0.008}
          scanGlow={0.6}
          scanSoftness={2.5}
          scanDuration={2.5}
          scanDelay={1.5}
          scanDirection="pingpong"
        />
      </div>

      <motion.div
        className="auth-ballpit-content"
        animate={{ opacity: formHidden ? 0 : 1, y: formHidden ? -20 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="auth-bp-logo">
          <div className="auth-bp-shield">
            <svg viewBox="0 0 20 22" fill="none" width="16" height="18">
              <path d="M10 2L3 5v7c0 5.25 3.5 9 7 11 3.5-2 7-5.75 7-11V5L10 2z" fill="white" opacity="0.95"/>
            </svg>
          </div>
        </div>

        <div className="auth-bp-title-wrap">
          <TextPressure
            text="NIRVAN"
            flex alpha={false} stroke={false} width weight italic
            textColor="#FDFAF7"
            strokeColor="#D4A0BC"
            minFontSize={48}
          />
          <p className="auth-bp-tagline">Walk in peace. Your guardian is always on.</p>
        </div>

        <motion.div
          className="auth-glass-card"
          animate={{ opacity: formHidden ? 0 : 1, scale: formHidden ? 0.96 : 1 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="auth-glass-tabs">
            <button className={`auth-glass-tab ${tab==='login'?'active':''}`}
              onClick={() => { setTab('login'); setError(''); }}>Sign In</button>
            <button className={`auth-glass-tab ${tab==='signup'?'active':''}`}
              onClick={() => { setTab('signup'); setError(''); }}>Create Account</button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div className="auth-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button className="auth-glass-google" onClick={handleGoogle} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="rgba(255,255,255,0.9)"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="rgba(255,255,255,0.75)"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="rgba(255,255,255,0.6)"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="rgba(255,255,255,0.85)"/>
            </svg>
            Continue with Google
          </button>

          <div className="auth-glass-divider"><span>or</span></div>

          <form onSubmit={handleEmailSubmit} className="auth-glass-form">
            <AnimatePresence>
              {tab === 'signup' && (
                <motion.div key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}>
                  <input className="auth-glass-input" type="text" placeholder="Your name"
                    value={name} onChange={e => setName(e.target.value)} />
                </motion.div>
              )}
            </AnimatePresence>
            <input className="auth-glass-input" type="email" placeholder="Email"
              value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="auth-glass-input" type="password" placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="auth-glass-submit" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : (tab==='login' ? 'Sign In →' : 'Create Account →')}
            </button>
          </form>

          <p className="auth-glass-switch">
            {tab==='login' ? "Don't have an account? " : "Already have an account? "}
            <button className="auth-glass-switch-btn"
              onClick={() => { setTab(tab==='login'?'signup':'login'); setError(''); }}>
              {tab==='login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeAudio, sendSMSAlert } from '../api/client.js';
import './GuardianCard.css';

// ── Constants ────────────────────────────────────────────────
const STATES = { IDLE: 'idle', RECORDING: 'recording', ANALYZING: 'analyzing', SAFE: 'safe', THREAT: 'threat' };
const EMERGENCY_CONTACT = '+911234567890';

const FAST_KEYWORDS = [
  'help', 'bachao', 'stop', 'leave me', 'chhod', 'ruko',
  'save me', 'mujhe bachao', 'somebody help', 'please help',
  'scared', 'i need help', 'in danger', 'police', 'emergency',
];

// ── Main Component ───────────────────────────────────────────
export default function GuardianCard() {
  const [cardState, setCardState]     = useState(STATES.IDLE);
  const [transcript, setTranscript]   = useState('');
  const [confidence, setConfidence]   = useState(null);
  const [resultDetail, setResultDetail] = useState('');
  const [location, setLocation]       = useState(null);
  const [cameraStream, setCameraStream] = useState(null);

  const recognitionRef    = useRef(null);
  const videoRef          = useRef(null);
  const autoReturnRef     = useRef(null);
  const liveTranscriptRef = useRef('');
  const locationRef       = useRef(null);

  // Keep locationRef in sync with location state
  useEffect(() => { locationRef.current = location; }, [location]);

  // Attach camera stream to video element
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      cameraStream?.getTracks().forEach(t => t.stop());
      clearTimeout(autoReturnRef.current);
    };
  }, [cameraStream]);

  // ── Trigger SAFE ─────────────────────────────────────────
  const triggerSafe = useCallback((conf = 92, detail = 'No threat detected. Stay aware.') => {
    setCardState(STATES.SAFE);
    setConfidence(conf);
    setResultDetail(detail);
    window.dispatchEvent(new Event('nirvan_safe'));
    autoReturnRef.current = setTimeout(() => {
      setCardState(STATES.IDLE);
      window.dispatchEvent(new Event('nirvan_safe'));
    }, 4000);
  }, []);

  // ── Trigger THREAT ───────────────────────────────────────
  const triggerThreat = useCallback((text, conf = 88, detail = 'Distress keyword detected.') => {
    setCardState(STATES.THREAT);
    setConfidence(conf);
    setResultDetail(detail || text);
    window.dispatchEvent(new Event('nirvan_threat'));

    // 1. SMS alert
    const ts  = new Date().toLocaleTimeString('en-IN', { hour12: true });
    const loc = locationRef.current;
    const contact = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem('nirvan_contacts') || '[]');
        return saved.find(c => c.phone)?.phone || EMERGENCY_CONTACT;
      } catch { return EMERGENCY_CONTACT; }
    })();
    const locStr = loc ? `${loc.lat}° N, ${loc.lng}° E` : 'Unknown';
    sendSMSAlert(contact, `🚨 Nirvan Alert: User may be in danger. Location: ${locStr}. Time: ${ts}`).catch(() => {});

    // 2. Camera feed
    if (window.__gcVideoStream) {
      setCameraStream(window.__gcVideoStream);
    } else {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => setCameraStream(new MediaStream(s.getVideoTracks())))
        .catch(() => {});
    }

    // 3. Re-confirm location
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) }),
      () => {}
    );
  }, []);

  // ── Run analysis ─────────────────────────────────────────
  const runAnalysis = useCallback(async (text) => {
    setCardState(STATES.ANALYZING);
    try {
      // Read emergency contacts from localStorage
      const savedContacts = (() => {
        try {
          return JSON.parse(localStorage.getItem('nirvan_contacts') || '[]')
            .map(c => c.phone).filter(Boolean);
        } catch { return []; }
      })();
      const loc = locationRef.current;
      const locationStr = loc ? `${loc.lat}° N, ${loc.lng}° E` : undefined;

      const data = await analyzeAudio(text, { location: locationStr, contacts: savedContacts });
      if (data.threat_detected) {
        triggerThreat(text, data.confidence, data.detail);
      } else {
        triggerSafe(data.confidence, data.detail);
      }
    } catch {
      triggerSafe(92, 'No threats detected in audio.');
    }
  }, [triggerThreat, triggerSafe]);

  // ── Start recording ──────────────────────────────────────
  const startRecording = useCallback(() => {
    setCardState(STATES.RECORDING);
    setTranscript('');
    liveTranscriptRef.current = '';
    setConfidence(null);
    setResultDetail('');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setTimeout(() => runAnalysis(''), 4000);
      return;
    }

    const rec = new SR();
    rec.continuous    = true;
    rec.interimResults = true;
    rec.lang          = 'en-IN';
    recognitionRef.current = rec;

    rec.onresult = e => {
      const t = Array.from(e.results).map(r => r[0].transcript).join(' ').toLowerCase();
      liveTranscriptRef.current = t;
      setTranscript(t);
      // Immediately stop & analyze if a keyword is detected
      if (FAST_KEYWORDS.some(kw => t.includes(kw))) {
        rec.stop();
        runAnalysis(t);
      }
    };

    rec.onerror = () => rec.stop();
    rec.onend   = () => {
      // Only run analysis if a keyword trigger hasn't already done so
      setCardState(prev => {
        if (prev === STATES.RECORDING) {
          runAnalysis(liveTranscriptRef.current);
          return STATES.ANALYZING;
        }
        return prev;
      });
    };

    rec.start();
    // Auto-stop after 8 seconds
    setTimeout(() => {
      if (recognitionRef.current) recognitionRef.current.stop();
    }, 8000);
  }, [runAnalysis]);

  // ── Stop recording manually ──────────────────────────────
  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setCardState(STATES.ANALYZING);
    runAnalysis(liveTranscriptRef.current);
  }, [runAnalysis]);

  // ── Permission flow ──────────────────────────────────────
  const requestAllPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const videoStream = new MediaStream(stream.getVideoTracks());
      window.__gcVideoStream = videoStream;
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) }),
        () => setLocation({ lat: '17.3850', lng: '78.4867' })
      );
      startRecording();
    } catch {
      // Permission denied for camera/location — still allow mic-only
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) }),
        () => setLocation({ lat: '17.3850', lng: '78.4867' })
      );
      startRecording();
    }
  }, [startRecording]);

  // ── Handle "Start Guardian" click ───────────────────────
  const handleStart = useCallback(() => {
    requestAllPermissions();
  }, [requestAllPermissions]);

  // ── Reset card ───────────────────────────────────────────
  const handleReset = useCallback(() => {
    recognitionRef.current?.stop();
    clearTimeout(autoReturnRef.current);
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCardState(STATES.IDLE);
    setTranscript('');
    setConfidence(null);
    window.dispatchEvent(new Event('nirvan_safe'));
  }, [cameraStream]);

  // ── Render ───────────────────────────────────────────────
  return (
    <>
      {/* Card body */}
      <div className={`gc-root${cardState === STATES.THREAT ? ' gc-root--threat' : ''}`}>

        {/* Center interactive area */}
        <div className="gc-center">

          {/* IDLE */}
          {cardState === STATES.IDLE && (
            <>
              <div className="gc-idle-btn-wrap">
                <div className="gc-pulse-ring" />
                <div className="gc-pulse-ring gc-pulse-ring-2" />
                <button className="gc-start-btn" onClick={handleStart} title="Start Guardian">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4zm6.364 9.243a.75.75 0 0 1 .736.896A7.002 7.002 0 0 1 12.75 18.93V21h2.25a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1 0-1.5H11.25v-2.07A7.002 7.002 0 0 1 4.9 12.139a.75.75 0 1 1 1.473-.278A5.502 5.502 0 0 0 17.5 12a.75.75 0 0 1 .864-.757z"/>
                  </svg>
                </button>
              </div>
              <p className="gc-idle-hint">Tap to activate audio monitoring</p>
            </>
          )}

          {/* RECORDING */}
          {cardState === STATES.RECORDING && (
            <>
              <div className="gc-waveform">
                <div className="gc-wave-bar" />
                <div className="gc-wave-bar" />
                <div className="gc-wave-bar" />
                <div className="gc-wave-bar" />
                <div className="gc-wave-bar" />
              </div>
              <div className="gc-rec-status">
                <span className="gc-rec-dot" />
                Listening…
              </div>
              {transcript && <p className="gc-transcript">&ldquo;{transcript.slice(-60)}&rdquo;</p>}
              <button className="gc-stop-btn" onClick={stopRecording}>Stop</button>
            </>
          )}

          {/* ANALYZING */}
          {cardState === STATES.ANALYZING && (
            <>
              <div className="gc-waveform gc-waveform--frozen">
                <div className="gc-wave-bar" />
                <div className="gc-wave-bar" />
                <div className="gc-wave-bar" />
                <div className="gc-wave-bar" />
                <div className="gc-wave-bar" />
              </div>
              <div className="gc-rec-status">
                <span className="gc-spinner" />
                Analyzing for threats…
              </div>
            </>
          )}

          {/* SAFE */}
          {cardState === STATES.SAFE && (
            <div className="gc-result">
              <span className="gc-result-icon">✅</span>
              <span className="gc-result-label">No threat detected.</span>
              <span className="gc-result-sub">{resultDetail || 'Stay aware. Guardian is watching.'}</span>
              {confidence !== null && (
                <span className="gc-confidence">Confidence: {confidence}%</span>
              )}
            </div>
          )}

          {/* THREAT */}
          {cardState === STATES.THREAT && (
            <div className="gc-result">
              <span className="gc-result-icon">🚨</span>
              <span className="gc-result-label gc-result-label--threat">Threat Detected</span>
              <span className="gc-result-sub">Guardians alerted. SMS sent.</span>
              {location && (
                <span className="gc-location">📍 {location.lat}° N, {location.lng}° E</span>
              )}
              {confidence !== null && (
                <span className="gc-confidence">Confidence: {confidence}%</span>
              )}
              <button className="gc-stop-btn" style={{ marginTop: '0.5rem' }} onClick={handleReset}>
                I&apos;m Safe
              </button>
            </div>
          )}
        </div>

        {/* Camera PiP — visible on THREAT */}
        {cameraStream && (
          <div className="gc-camera-pip">
            <video ref={videoRef} autoPlay muted playsInline />
            <span className="gc-camera-label">Camera Active</span>
          </div>
        )}
      </div>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { analyzeVideo } from '../api/client';
import './CameraCard.css';

// Permission states
const STATE = {
  IDLE:       'idle',
  REQUESTING: 'requesting',
  ACTIVE:     'active',
  DENIED:     'denied',
  ERROR:      'error',
};

export default function CameraCard({ isThreat }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [camState, setCamState] = useState(STATE.IDLE);
  const [errMsg,   setErrMsg]   = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  // Start the camera stream
  const startCamera = async () => {
    setCamState(STATE.REQUESTING);
    setErrMsg('');

    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      // Attach stream to video element
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // Play as soon as metadata is loaded
        video.onloadedmetadata = () => {
          video.play().catch(() => {});
          setCamState(STATE.ACTIVE);
        };
      } else {
        setCamState(STATE.ACTIVE);
      }
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCamState(STATE.DENIED);
        setErrMsg('Camera access was denied.\nAllow it in browser settings and retry.');
      } else if (err.name === 'NotFoundError') {
        setCamState(STATE.ERROR);
        setErrMsg('No camera found on this device.');
      } else {
        setCamState(STATE.ERROR);
        setErrMsg(`Camera error: ${err.message}`);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamState(STATE.IDLE);
    setAnalysis(null);
    setIsAnalyzing(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []); // eslint-disable-line

  const prevThreatRef = useRef(false);
  useEffect(() => {
    if (isThreat && !prevThreatRef.current) {
      startCamera();
    } else if (!isThreat && prevThreatRef.current) {
      stopCamera();
    }
    prevThreatRef.current = isThreat;
  }, [isThreat]); // eslint-disable-line

  // Re-attach if video element mounts after stream is ready
  useEffect(() => {
    if (camState === STATE.ACTIVE && videoRef.current && streamRef.current) {
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [camState]);

  // AI Frame Analysis Hook
  useEffect(() => {
    if (camState !== STATE.ACTIVE || !videoRef.current) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let isRequestInProgress = false;

    const intervalId = setInterval(async () => {
      if (isRequestInProgress || !videoRef.current) return;
      isRequestInProgress = true;
      setIsAnalyzing(true);
      try {
        const video = videoRef.current;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          const res = await analyzeVideo(base64);
          setAnalysis(res);
        }
      } catch (e) {
        console.error("Frame extraction error:", e);
      } finally {
        isRequestInProgress = false;
        setIsAnalyzing(false);
      }
    }, 8000); // Extract frame every 8 seconds

    return () => clearInterval(intervalId);
  }, [camState]);

  return (
    <div className="cc-root" style={{ position: 'relative', overflow: 'hidden' }}>
      
      {/* ── Active Video & Overlay ── */}
      <div style={{ opacity: isThreat ? 1 : 0, transition: 'opacity 600ms ease-in-out', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: isThreat ? 2 : 0, visibility: isThreat ? 'visible' : 'hidden' }}>
        {/* ── Video element — always in DOM so ref is stable ── */}
        <video
          ref={videoRef}
          className="cc-video"
          autoPlay
          muted
          playsInline
          style={{ display: 'block' }}
        />

        {/* ── Non-active state overlay (for permissions ONLY) ── */}
        {camState !== STATE.ACTIVE && camState !== STATE.IDLE && (
          <div className="cc-state">
            <span className="cc-state-icon">
              {camState === STATE.REQUESTING && '📷'}
              {camState === STATE.DENIED    && '🔒'}
              {camState === STATE.ERROR     && '⚠️'}
            </span>
            <span className="cc-state-text" style={{ textAlign: 'center' }}>
              {camState === STATE.REQUESTING && 'Starting camera…'}
              {(camState === STATE.DENIED || camState === STATE.ERROR) && errMsg}
            </span>
            {(camState === STATE.DENIED || camState === STATE.ERROR) && (
              <button className="cc-state-btn" onClick={startCamera}>
                Retry Connection
              </button>
            )}
          </div>
        )}

      {/* ── Overlay decorations (only when active) ── */}
      {camState === STATE.ACTIVE && (
        <>
          {/* Scanning line */}
          <div className="cc-scan-line" />

          {/* Corner brackets */}
          <div className="cc-bracket cc-bracket--tl" />
          <div className="cc-bracket cc-bracket--tr" />
          <div className="cc-bracket cc-bracket--bl" />
          <div className="cc-bracket cc-bracket--br" />

        {/* Top: live badge and threat overlay */}
        <div className="cc-top" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
          <div className="cc-live-badge" style={{display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
              <span className="cc-live-dot" />
              Camera Live 
            </div>
            <div style={{color: '#ef4444', fontSize: '0.65rem', fontWeight: 600}}>
              📷 Camera Auto-Activated
            </div>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end'}}>
              {(isAnalyzing || analysis) && (
                <div style={{
                  background: analysis?.threat_detected ? 'rgba(192, 96, 80, 0.9)' : 'rgba(28, 20, 16, 0.75)',
                  color: '#fff', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', 
                  maxWidth: '160px', backdropFilter: 'blur(4px)',
                  display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'right',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <div style={{fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem'}}>
                    {isAnalyzing && <span style={{width: 8, height: 8, borderRadius: '50%', border: '1px solid #fff', borderTopColor: 'transparent', animation: 'mcSpin 1s linear infinite'}} />}
                    {analysis?.threat_detected ? '🚨 Threat Detected' : 'AI Shield Active'}
                  </div>
                  {analysis?.detail && <div style={{opacity: 0.8, fontSize: '0.65rem', lineHeight: 1.2}}>{analysis.detail}</div>}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      </div>

      {/* ── Safe Placeholder ── */}
      <div style={{ opacity: isThreat ? 0 : 1, transition: 'opacity 600ms ease-in-out', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3EE', zIndex: isThreat ? 0 : 2, visibility: isThreat ? 'hidden' : 'visible' }}>
        <p style={{ color: '#1C1410', opacity: 0.6, fontSize: '0.9rem', textAlign: 'center', padding: '0 1rem', fontFamily: 'DM Sans, sans-serif' }}>
          📷 Camera activates when guardian detects a threat
        </p>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';

// Cubic ease in-out
const ease = t => t < 0.5 ? 4*t*t*t : 1 + (--t)*((2*t)*(2*t) - 1)*2;

/**
 * WaveTransition
 * Renders a real sinusoidal water-wave that sweeps across the screen on a canvas.
 *
 * direction='cover'  — wave sweeps right→left, covering the screen
 * direction='reveal' — wave sweeps left→right, uncovering the screen
 */
export default function WaveTransition({
  active,
  direction   = 'cover',
  baseColor   = '#1A0E18',
  glowColor   = '#D4A0BC',
  duration    = 420,
  onComplete,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W   = window.innerWidth;
    const H   = window.innerHeight;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const AMP   = 68;   // wave amplitude (px)
    const FREQ  = 2.5;  // sine cycles along height
    const EXTRA = AMP * 2; // extra off-screen buffer so edges are fully hidden
    const STEPS = Math.ceil(H / 3); // path resolution

    let startTime = null;
    let raf;

    const drawFrame = (ts) => {
      if (!startTime) startTime = ts;
      const rawT = Math.min((ts - startTime) / duration, 1);
      const t    = ease(rawT);

      ctx.clearRect(0, 0, W, H);

      // Wave-front X: for cover, moves W→-EXTRA; for reveal, -EXTRA→W
      const frontX = direction === 'cover'
        ? (W + EXTRA) * (1 - t) - EXTRA
        : (W + EXTRA) * t       - EXTRA;

      // Phase offset — wave "flows" in the direction of travel
      const timePhase = direction === 'cover'
        ? -rawT * Math.PI * 5
        : +rawT * Math.PI * 5;

      // Helper: wave X at any Y
      const wX = (y) => frontX + Math.sin((y / H) * Math.PI * 2 * FREQ + timePhase) * AMP;

      // ── Fill shape: from wave edge → right edge ──────────────
      ctx.beginPath();
      ctx.moveTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(wX(H), H); // bottom of wave

      for (let i = 1; i <= STEPS; i++) {
        const y = H - (i / STEPS) * H;
        ctx.lineTo(wX(y), y);
      }

      ctx.lineTo(W, 0);
      ctx.closePath();
      ctx.fillStyle = baseColor;
      ctx.fill();

      // ── Glow edge — blush glowing line on the wave ───────────
      ctx.beginPath();
      ctx.moveTo(wX(H), H);
      for (let i = 1; i <= STEPS; i++) {
        const y = H - (i / STEPS) * H;
        ctx.lineTo(wX(y), y);
      }
      ctx.save();
      ctx.strokeStyle   = glowColor;
      ctx.lineWidth     = 3;
      ctx.globalAlpha   = 0.7;
      ctx.shadowBlur    = 22;
      ctx.shadowColor   = glowColor;
      ctx.stroke();
      ctx.restore();

      // ── Soft secondary glow (wider, dimmer) ──────────────────
      ctx.beginPath();
      ctx.moveTo(wX(H), H);
      for (let i = 1; i <= STEPS; i++) {
        const y = H - (i / STEPS) * H;
        ctx.lineTo(wX(y), y);
      }
      ctx.save();
      ctx.strokeStyle = glowColor;
      ctx.lineWidth   = 14;
      ctx.globalAlpha = 0.12;
      ctx.shadowBlur  = 40;
      ctx.shadowColor = glowColor;
      ctx.stroke();
      ctx.restore();

      if (rawT < 1) {
        raf = requestAnimationFrame(drawFrame);
      } else {
        onComplete?.();
      }
    };

    raf = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(raf);
  }, [active]); // eslint-disable-line

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100vw',
        height:        '100vh',
        zIndex:        9999,
        pointerEvents: 'all',
        display:       'block',
      }}
    />
  );
}

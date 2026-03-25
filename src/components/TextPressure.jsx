import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

const dist = (a, b) => Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2);
const getAttr = (distance, maxDist, minVal, maxVal) => Math.max(minVal, maxVal - Math.abs((maxVal * distance) / maxDist) + minVal);
const debounce = (fn, delay) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };

const TextPressure = ({
  text = 'Nirvan',
  fontFamily = 'DM Serif Display',
  fontUrl = null,
  width = true, weight = true, italic = true, alpha = false,
  flex = true, stroke = false, scale = false,
  textColor = '#FDFAF7',
  strokeColor = '#D4A0BC',
  className = '',
  minFontSize = 36,
}) => {
  const containerRef = useRef(null);
  const titleRef    = useRef(null);
  const spansRef    = useRef([]);
  const mouseRef    = useRef({ x: 0, y: 0 });
  const cursorRef   = useRef({ x: 0, y: 0 });

  const [fontSize,    setFontSize]    = useState(minFontSize);
  const [scaleY,      setScaleY]      = useState(1);
  const [lineHeight,  setLineHeight]  = useState(1);

  const chars = text.split('');

  useEffect(() => {
    const onMove  = e => { cursorRef.current.x = e.clientX; cursorRef.current.y = e.clientY; };
    const onTouch = e => { cursorRef.current.x = e.touches[0].clientX; cursorRef.current.y = e.touches[0].clientY; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouch, { passive: true });
    if (containerRef.current) {
      const { left, top, width: w, height: h } = containerRef.current.getBoundingClientRect();
      mouseRef.current = cursorRef.current = { x: left + w/2, y: top + h/2 };
    }
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('touchmove', onTouch); };
  }, []);

  const setSize = useCallback(() => {
    if (!containerRef.current || !titleRef.current) return;
    const { width: cw, height: ch } = containerRef.current.getBoundingClientRect();
    let fs = Math.max(cw / (chars.length / 2), minFontSize);
    setFontSize(fs); setScaleY(1); setLineHeight(1);
    if (scale) requestAnimationFrame(() => {
      if (!titleRef.current) return;
      const { height: th } = titleRef.current.getBoundingClientRect();
      if (th > 0) { const r = ch / th; setScaleY(r); setLineHeight(r); }
    });
  }, [chars.length, minFontSize, scale]);

  useEffect(() => {
    const db = debounce(setSize, 100); db();
    window.addEventListener('resize', db);
    return () => window.removeEventListener('resize', db);
  }, [setSize]);

  useEffect(() => {
    let raf;
    const animate = () => {
      mouseRef.current.x += (cursorRef.current.x - mouseRef.current.x) / 15;
      mouseRef.current.y += (cursorRef.current.y - mouseRef.current.y) / 15;
      if (titleRef.current) {
        const { width: tw } = titleRef.current.getBoundingClientRect();
        const maxDist = tw / 2;
        spansRef.current.forEach(span => {
          if (!span) return;
          const { x, y, width: sw, height: sh } = span.getBoundingClientRect();
          const d = dist(mouseRef.current, { x: x + sw/2, y: y + sh/2 });
          const wdth  = width  ? Math.floor(getAttr(d, maxDist, 5, 200))   : 100;
          const wght  = weight ? Math.floor(getAttr(d, maxDist, 100, 900)) : 400;
          const ital  = italic ? getAttr(d, maxDist, 0, 1).toFixed(2)      : 0;
          const opac  = alpha  ? getAttr(d, maxDist, 0, 1).toFixed(2)      : 1;
          const fvs = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${ital}`;
          if (span.style.fontVariationSettings !== fvs) span.style.fontVariationSettings = fvs;
          if (alpha) span.style.opacity = opac;
        });
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [width, weight, italic, alpha]);

  const styleEl = useMemo(() => (
    <style>{`
      ${fontUrl ? `@font-face { font-family: '${fontFamily}'; src: url('${fontUrl}'); font-style: normal; }` : ''}
      .tp-flex { display: flex; justify-content: space-between; }
      .tp-stroke span { position: relative; color: ${textColor}; }
      .tp-stroke span::after { content: attr(data-char); position: absolute; left:0; top:0; color: transparent; z-index:-1; -webkit-text-stroke-width: 3px; -webkit-text-stroke-color: ${strokeColor}; }
      .tp-title { color: ${textColor}; }
    `}</style>
  ), [fontFamily, fontUrl, textColor, strokeColor]);

  const dynClass = [className, 'tp-title', flex?'tp-flex':'', stroke?'tp-stroke':''].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} style={{ position:'relative', width:'100%', height:'100%', background:'transparent' }}>
      {styleEl}
      <h1 ref={titleRef} className={dynClass} style={{
        fontFamily, textTransform:'uppercase', fontSize, lineHeight,
        transform:`scale(1,${scaleY})`, transformOrigin:'center top',
        margin:0, textAlign:'center', userSelect:'none', whiteSpace:'nowrap',
        fontWeight:100, width:'100%',
        textShadow: '0 0 40px rgba(212,160,188,0.6), 0 2px 4px rgba(0,0,0,0.3)',
        letterSpacing: '0.08em',
      }}>
        {chars.map((char, i) => (
          <span key={i} ref={el => spansRef.current[i] = el} data-char={char}
            style={{ display:'inline-block', color: stroke ? undefined : textColor }}>
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </h1>
    </div>
  );
};

export default TextPressure;

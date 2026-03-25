import { BloomEffect, ChromaticAberrationEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './GridScan.css';

const vert = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const frag = `
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uSkew;
uniform float uTilt;
uniform float uYaw;
uniform float uLineThickness;
uniform vec3 uLinesColor;
uniform vec3 uScanColor;
uniform float uGridScale;
uniform float uLineStyle;
uniform float uLineJitter;
uniform float uScanOpacity;
uniform float uScanDirection;
uniform float uNoise;
uniform float uBloomOpacity;
uniform float uScanGlow;
uniform float uScanSoftness;
uniform float uPhaseTaper;
uniform float uScanDuration;
uniform float uScanDelay;
varying vec2 vUv;

uniform float uScanStarts[8];
uniform float uScanCount;

const int MAX_SCANS = 8;

float smoother01(float a, float b, float x){
  float t = clamp((x - a) / max(1e-5, (b - a)), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0);
  vec3 rd = normalize(vec3(p, 2.0));

  float cR = cos(uTilt), sR = sin(uTilt);
  rd.xy = mat2(cR, -sR, sR, cR) * rd.xy;
  float cY = cos(uYaw), sY = sin(uYaw);
  rd.xz = mat2(cY, -sY, sY, cY) * rd.xz;

  vec2 skew = clamp(uSkew, vec2(-0.7), vec2(0.7));
  rd.xy += skew * rd.z;

  vec3 color = vec3(0.0);
  float minT = 1e20;
  float gridScale = max(1e-5, uGridScale);
  float fadeStrength = 2.0;
  vec2 gridUV = vec2(0.0);
  float hitIsY = 1.0;

  for(int i = 0; i < 4; i++){
    float isY = float(i < 2);
    float pos = mix(-0.2, 0.2, float(i)) * isY + mix(-0.5, 0.5, float(i - 2)) * (1.0 - isY);
    float num = pos - (isY * ro.y + (1.0 - isY) * ro.x);
    float den = isY * rd.y + (1.0 - isY) * rd.x;
    float t = num / den;
    vec3 h = ro + rd * t;
    float depthBoost = smoothstep(0.0, 3.0, h.z);
    h.xy += skew * 0.15 * depthBoost;
    bool use = t > 0.0 && t < minT;
    gridUV = use ? mix(h.zy, h.xz, isY) / gridScale : gridUV;
    minT = use ? t : minT;
    hitIsY = use ? isY : hitIsY;
  }

  vec3 hit = ro + rd * minT;
  float dist = length(hit - ro);

  float jitterAmt = clamp(uLineJitter, 0.0, 1.0);
  if(jitterAmt > 0.0){
    vec2 j = vec2(sin(gridUV.y*2.7+iTime*1.8), cos(gridUV.x*2.3-iTime*1.6)) * (0.15*jitterAmt);
    gridUV += j;
  }

  float fx = fract(gridUV.x), fy = fract(gridUV.y);
  float ax = min(fx,1.0-fx), ay = min(fy,1.0-fy);
  float wx = fwidth(gridUV.x), wy = fwidth(gridUV.y);
  float halfPx = max(0.0, uLineThickness) * 0.5;
  float tx = halfPx*wx, ty = halfPx*wy;
  float lineX = 1.0 - smoothstep(tx, tx+wx, ax);
  float lineY = 1.0 - smoothstep(ty, ty+wy, ay);
  float primaryMask = max(lineX, lineY);

  vec2 gridUV2 = (hitIsY > 0.5 ? hit.xz : hit.zy) / gridScale;
  float fx2=fract(gridUV2.x),fy2=fract(gridUV2.y);
  float ax2=min(fx2,1.0-fx2),ay2=min(fy2,1.0-fy2);
  float wx2=fwidth(gridUV2.x),wy2=fwidth(gridUV2.y);
  float tx2=halfPx*wx2,ty2=halfPx*wy2;
  float lineX2=1.0-smoothstep(tx2,tx2+wx2,ax2);
  float lineY2=1.0-smoothstep(ty2,ty2+wy2,ay2);
  float altMask=max(lineX2,lineY2);

  float edgeDistX=min(abs(hit.x-(-0.5)),abs(hit.x-0.5));
  float edgeDistY=min(abs(hit.y-(-0.2)),abs(hit.y-0.2));
  float edgeDist=mix(edgeDistY,edgeDistX,hitIsY);
  float edgeGate=1.0-smoothstep(gridScale*0.5,gridScale*2.0,edgeDist);
  altMask*=edgeGate;
  float lineMask=max(primaryMask,altMask);

  float fade=exp(-dist*fadeStrength);
  float dur=max(0.05,uScanDuration);
  float del=max(0.0,uScanDelay);
  float scanZMax=2.0;
  float sigma=max(0.001,0.18*max(0.1,uScanGlow)*uScanSoftness);
  float sigmaA=sigma*2.0;
  float combinedPulse=0.0,combinedAura=0.0;

  float cycle=dur+del;
  float tCycle=mod(iTime,cycle);
  float scanPhase=clamp((tCycle-del)/dur,0.0,1.0);
  float phase=scanPhase;
  if(uScanDirection>0.5&&uScanDirection<1.5) phase=1.0-phase;
  else if(uScanDirection>1.5){float t2=mod(max(0.0,iTime-del),2.0*dur);phase=(t2<dur)?(t2/dur):(1.0-(t2-dur)/dur);}
  float scanZ=phase*scanZMax;
  float dz=abs(hit.z-scanZ);
  float lineBand=exp(-0.5*(dz*dz)/(sigma*sigma));
  float taper=clamp(uPhaseTaper,0.0,0.49);
  float headFade=smoother01(0.0,taper,phase);
  float tailFade=1.0-smoother01(1.0-taper,1.0,phase);
  float phaseWindow=headFade*tailFade;
  combinedPulse+=lineBand*phaseWindow*clamp(uScanOpacity,0.0,1.0);
  combinedAura+=(exp(-0.5*(dz*dz)/(sigmaA*sigmaA))*0.25)*phaseWindow*clamp(uScanOpacity,0.0,1.0);

  for(int i=0;i<MAX_SCANS;i++){
    if(float(i)>=uScanCount) break;
    float tA=iTime-uScanStarts[i];
    float ph=clamp(tA/dur,0.0,1.0);
    if(uScanDirection>0.5&&uScanDirection<1.5) ph=1.0-ph;
    else if(uScanDirection>1.5){ph=(ph<0.5)?(ph*2.0):(1.0-(ph-0.5)*2.0);}
    float szI=ph*scanZMax;
    float dzI=abs(hit.z-szI);
    float lbI=exp(-0.5*(dzI*dzI)/(sigma*sigma));
    float hfI=smoother01(0.0,taper,ph);
    float tfI=1.0-smoother01(1.0-taper,1.0,ph);
    combinedPulse+=lbI*hfI*tfI*clamp(uScanOpacity,0.0,1.0);
    combinedAura+=(exp(-0.5*(dzI*dzI)/(sigmaA*sigmaA))*0.25)*hfI*tfI*clamp(uScanOpacity,0.0,1.0);
  }

  vec3 gridCol=uLinesColor*lineMask*fade;
  vec3 scanCol=uScanColor*combinedPulse;
  vec3 scanAura=uScanColor*combinedAura;
  color=gridCol+scanCol+scanAura;

  float n=fract(sin(dot(gl_FragCoord.xy+vec2(iTime*123.4),vec2(12.9898,78.233)))*43758.5453123);
  color+=(n-0.5)*uNoise;
  color=clamp(color,0.0,1.0);
  float alpha=clamp(max(lineMask,combinedPulse),0.0,1.0);
  float gx=1.0-smoothstep(tx*2.0,tx*2.0+wx*2.0,ax);
  float gy=1.0-smoothstep(ty*2.0,ty*2.0+wy*2.0,ay);
  float halo=max(gx,gy)*fade;
  alpha=max(alpha,halo*clamp(uBloomOpacity,0.0,1.0));
  fragColor=vec4(color,alpha);
}

void main(){
  vec4 c;
  mainImage(c, vUv*iResolution.xy);
  gl_FragColor=c;
}
`;

function srgbColor(hex) {
  return new THREE.Color(hex).convertSRGBToLinear();
}

const GridScan = ({
  sensitivity = 0.55,
  lineThickness = 1,
  linesColor = '#392e4e',
  scanColor = '#FF9FFC',
  scanOpacity = 0.4,
  gridScale = 0.1,
  lineStyle = 'solid',
  lineJitter = 0.1,
  scanDirection = 'pingpong',
  enablePost = true,
  bloomIntensity = 0.6,
  bloomThreshold = 0,
  bloomSmoothing = 0,
  chromaticAberration = 0.002,
  noiseIntensity = 0.01,
  scanGlow = 0.5,
  scanSoftness = 2,
  scanPhaseTaper = 0.9,
  scanDuration = 2.0,
  scanDelay = 2.0,
  className,
  style,
}) => {
  const containerRef = useRef(null);
  const lookTarget  = useRef(new THREE.Vector2(0, 0));
  const lookCurrent = useRef(new THREE.Vector2(0, 0));
  const lookVel     = useRef(new THREE.Vector2(0, 0));
  const tiltTarget  = useRef(0);
  const tiltCur     = useRef(0);
  const tiltVel     = useRef(0);
  const yawTarget   = useRef(0);
  const yawCur      = useRef(0);
  const yawVel      = useRef(0);
  const matRef      = useRef(null);
  const rafRef      = useRef(null);

  const s = THREE.MathUtils.clamp(sensitivity, 0, 1);
  const skewScale  = THREE.MathUtils.lerp(0.06, 0.2,  s);
  const tiltScale  = THREE.MathUtils.lerp(0.12, 0.3,  s);
  const yawScale   = THREE.MathUtils.lerp(0.1,  0.28, s);
  const smoothTime = THREE.MathUtils.lerp(0.45, 0.12, s);
  const yBoost     = THREE.MathUtils.lerp(1.2,  1.6,  s);

  // Mouse interaction
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let leaveTimer = null;
    const onMove = e => {
      clearTimeout(leaveTimer); leaveTimer = null;
      const rect = el.getBoundingClientRect();
      lookTarget.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      );
    };
    const onLeave = () => {
      leaveTimer = setTimeout(() => {
        lookTarget.current.set(0, 0);
        tiltTarget.current = 0; yawTarget.current = 0;
      }, 250);
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); clearTimeout(leaveTimer); };
  }, []);

  // Three.js renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const w = container.clientWidth, h = container.clientHeight;
    const uniforms = {
      iResolution:   { value: new THREE.Vector3(w, h, renderer.getPixelRatio()) },
      iTime:         { value: 0 },
      uSkew:         { value: new THREE.Vector2(0, 0) },
      uTilt:         { value: 0 },
      uYaw:          { value: 0 },
      uLineThickness:{ value: lineThickness },
      uLinesColor:   { value: srgbColor(linesColor) },
      uScanColor:    { value: srgbColor(scanColor) },
      uGridScale:    { value: gridScale },
      uLineStyle:    { value: lineStyle === 'dashed' ? 1 : lineStyle === 'dotted' ? 2 : 0 },
      uLineJitter:   { value: Math.min(1, Math.max(0, lineJitter)) },
      uScanOpacity:  { value: scanOpacity },
      uNoise:        { value: noiseIntensity },
      uBloomOpacity: { value: bloomIntensity },
      uScanGlow:     { value: scanGlow },
      uScanSoftness: { value: scanSoftness },
      uPhaseTaper:   { value: scanPhaseTaper },
      uScanDuration: { value: scanDuration },
      uScanDelay:    { value: scanDelay },
      uScanDirection:{ value: scanDirection === 'backward' ? 1 : scanDirection === 'pingpong' ? 2 : 0 },
      uScanStarts:   { value: new Array(8).fill(0) },
      uScanCount:    { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    matRef.current = material;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    let composer = null;
    if (enablePost) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new BloomEffect({ intensity: 1.0, luminanceThreshold: bloomThreshold, luminanceSmoothing: bloomSmoothing });
      bloom.blendMode.opacity.value = Math.max(0, bloomIntensity);
      const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(chromaticAberration, chromaticAberration) });
      const effectPass = new EffectPass(camera, bloom, chroma);
      effectPass.renderToScreen = true;
      composer.addPass(effectPass);
    }

    const onResize = () => {
      const nw = container.clientWidth, nh = container.clientHeight;
      renderer.setSize(nw, nh);
      uniforms.iResolution.value.set(nw, nh, renderer.getPixelRatio());
      composer?.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    const sdFloat = (cur, tgt, velRef, sm, dt) => {
      sm = Math.max(0.0001, sm);
      const omega = 2 / sm, x = omega * dt;
      const expF = 1 / (1 + x + 0.48*x*x + 0.235*x*x*x);
      let change = cur - tgt;
      const maxC = Infinity * sm; change = Math.sign(change) * Math.min(Math.abs(change), maxC);
      const tgtA = cur - change;
      const temp = (velRef.v + omega * change) * dt;
      velRef.v = (velRef.v - omega * temp) * expF;
      let out = tgtA + (change + temp) * expF;
      if ((tgt-cur)*(out-tgt) > 0) { out = tgt; velRef.v = 0; }
      return out;
    };

    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000); last = now;

      // Smooth look
      const lxVel = { v: lookVel.current.x };
      const lyVel = { v: lookVel.current.y };
      const lxN = sdFloat(lookCurrent.current.x, lookTarget.current.x, lxVel, smoothTime, dt);
      const lyN = sdFloat(lookCurrent.current.y, lookTarget.current.y, lyVel, smoothTime, dt);
      lookCurrent.current.set(lxN, lyN);
      lookVel.current.set(lxVel.v, lyVel.v);

      const tvRef = { v: tiltVel.current };
      tiltCur.current = sdFloat(tiltCur.current, tiltTarget.current, tvRef, smoothTime, dt);
      tiltVel.current = tvRef.v;

      const yvRef = { v: yawVel.current };
      yawCur.current = sdFloat(yawCur.current, yawTarget.current, yvRef, smoothTime, dt);
      yawVel.current = yvRef.v;

      uniforms.uSkew.value.set(lookCurrent.current.x * skewScale, -lookCurrent.current.y * yBoost * skewScale);
      uniforms.uTilt.value = tiltCur.current * tiltScale;
      uniforms.uYaw.value  = THREE.MathUtils.clamp(yawCur.current * yawScale, -0.6, 0.6);
      uniforms.iTime.value = now / 1000;

      renderer.clear(true, true, true);
      if (composer) composer.render(dt);
      else renderer.render(scene, camera);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      material.dispose();
      quad.geometry.dispose();
      composer?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      className={`gridscan${className ? ` ${className}` : ''}`}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
};

export default GridScan;

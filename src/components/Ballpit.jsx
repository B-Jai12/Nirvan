import { useEffect, useRef } from 'react';
import {
  Vector3, MeshPhysicalMaterial, InstancedMesh, Clock,
  AmbientLight, SphereGeometry, ShaderChunk, Scene,
  Color, Object3D, SRGBColorSpace, MathUtils,
  PMREMGenerator, Vector2, WebGLRenderer, PerspectiveCamera,
  PointLight, ACESFilmicToneMapping, Plane, Raycaster
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ── Three.js app wrapper ──────────────────────────────────────
class ThreeApp {
  constructor(options) {
    this.options = options;
    this.size = { width: 0, height: 0, wWidth: 0, wHeight: 0, ratio: 0, pixelRatio: 0 };
    this.onBeforeRender = () => {};
    this.onAfterRender = () => {};
    this.onAfterResize = () => {};
    this._visible = false;
    this._running = false;
    this._raf = null;
    this._clock = new Clock();
    this._time = { elapsed: 0, delta: 0 };

    this.camera = new PerspectiveCamera();
    this.scene = new Scene();

    this.canvas = options.canvas;
    this.canvas.style.display = 'block';
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      powerPreference: 'high-performance',
      antialias: true,
      alpha: true,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;

    this._initObservers();
    this.resize();
  }

  _initObservers() {
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.resize(), 100);
    });
    if (this.options.size === 'parent' && this.canvas.parentNode) {
      new ResizeObserver(() => this.resize()).observe(this.canvas.parentNode);
    }
    new IntersectionObserver(([entry]) => {
      this._visible = entry.isIntersecting;
      this._visible ? this._start() : this._stop();
    }).observe(this.canvas);
    document.addEventListener('visibilitychange', () => {
      if (this._visible) document.hidden ? this._stop() : this._start();
    });
  }

  resize() {
    const parent = this.canvas.parentNode;
    const w = parent ? parent.offsetWidth  : window.innerWidth;
    const h = parent ? parent.offsetHeight : window.innerHeight;
    if (!w || !h) return;
    this.size.width = w; this.size.height = h; this.size.ratio = w / h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.camera.isPerspectiveCamera) {
      const fov = (this.camera.fov * Math.PI) / 180;
      this.size.wHeight = 2 * Math.tan(fov / 2) * this.camera.position.length();
      this.size.wWidth = this.size.wHeight * this.camera.aspect;
    }
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.onAfterResize(this.size);
  }

  _start() {
    if (this._running) return;
    this._running = true;
    this._clock.start();
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      this._time.delta = this._clock.getDelta();
      this._time.elapsed += this._time.delta;
      this.onBeforeRender(this._time);
      this.renderer.render(this.scene, this.camera);
      this.onAfterRender(this._time);
    };
    tick();
  }

  _stop() {
    if (!this._running) return;
    cancelAnimationFrame(this._raf);
    this._running = false;
    this._clock.stop();
  }

  dispose() {
    this._stop();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

// ── Pointer tracker ───────────────────────────────────────────
const ptMap = new Map();
const ptPos = new Vector2();
let ptListening = false;

function ensurePointerListeners() {
  if (ptListening) return;
  ptListening = true;
  document.body.addEventListener('pointermove', (e) => {
    ptPos.set(e.clientX, e.clientY);
    ptMap.forEach((handler, el) => {
      const rect = el.getBoundingClientRect();
      updateNPos(handler, rect);
      checkHover(handler, rect);
    });
  });
  document.body.addEventListener('pointerleave', () => {
    ptMap.forEach((h) => { if (h.hover) { h.hover = false; h.onLeave?.(h); } });
  });
}

function updateNPos(handler, rect) {
  handler.position.set(ptPos.x - rect.left, ptPos.y - rect.top);
  handler.nPosition.set(
    (handler.position.x / rect.width) * 2 - 1,
    (-handler.position.y / rect.height) * 2 + 1
  );
}

function checkHover(handler, rect) {
  const inside = ptPos.x >= rect.left && ptPos.x <= rect.right &&
                 ptPos.y >= rect.top  && ptPos.y <= rect.bottom;
  if (inside && !handler.hover) { handler.hover = true; handler.onEnter?.(handler); }
  else if (!inside && handler.hover) { handler.hover = false; handler.onLeave?.(handler); }
  if (inside) handler.onMove?.(handler);
}

function addPointer(domEl, callbacks) {
  ensurePointerListeners();
  const handler = { position: new Vector2(), nPosition: new Vector2(), hover: false, ...callbacks };
  ptMap.set(domEl, handler);
  return { dispose: () => ptMap.delete(domEl) };
}

// ── Physics ───────────────────────────────────────────────────
const { randFloat, randFloatSpread } = MathUtils;
const _pa=new Vector3(),_pb=new Vector3(),_pc=new Vector3(),_vel=new Vector3(),_vel2=new Vector3(),_vel3=new Vector3(),_diff=new Vector3(),_push=new Vector3(),_push2=new Vector3(),_push3=new Vector3(),_c0=new Vector3();

class Physics {
  constructor(cfg) {
    this.config = cfg;
    this.positionData = new Float32Array(3 * cfg.count).fill(0);
    this.velocityData = new Float32Array(3 * cfg.count).fill(0);
    this.sizeData     = new Float32Array(cfg.count).fill(1);
    this.center       = new Vector3();
    for (let i = 1; i < cfg.count; i++) {
      const b = 3 * i;
      this.positionData[b]   = randFloatSpread(2 * cfg.maxX);
      this.positionData[b+1] = randFloatSpread(2 * cfg.maxY);
      this.positionData[b+2] = randFloatSpread(2 * cfg.maxZ);
    }
    this.sizeData[0] = cfg.size0;
    for (let i = 1; i < cfg.count; i++) this.sizeData[i] = randFloat(cfg.minSize, cfg.maxSize);
  }

  update(time) {
    const { config: cfg, positionData: pos, velocityData: vel, sizeData: sz, center } = this;
    let start = 0;

    if (cfg.controlSphere0) {
      start = 1;
      _pa.fromArray(pos, 0).lerp(center, 0.1).toArray(pos, 0);
      _vel.set(0,0,0).toArray(vel, 0);
    }

    for (let i = start; i < cfg.count; i++) {
      const b = 3*i;
      _pa.fromArray(pos, b); _vel.fromArray(vel, b);
      _vel.y -= time.delta * cfg.gravity * sz[i];
      _vel.multiplyScalar(cfg.friction).clampLength(0, cfg.maxVelocity);
      _pa.add(_vel); _pa.toArray(pos, b); _vel.toArray(vel, b);
    }

    for (let i = start; i < cfg.count; i++) {
      const b = 3*i; _pa.fromArray(pos,b); _vel.fromArray(vel,b); const ri = sz[i];
      for (let j = i+1; j < cfg.count; j++) {
        const bj = 3*j; _pb.fromArray(pos,bj); _vel2.fromArray(vel,bj); const rj = sz[j];
        _diff.copy(_pb).sub(_pa); const dist = _diff.length(); const sum = ri+rj;
        if (dist < sum && dist > 0) {
          const ov = sum - dist;
          _push.copy(_diff).normalize().multiplyScalar(0.5 * ov);
          _push2.copy(_push).multiplyScalar(Math.max(_vel.length(), 1));
          _push3.copy(_push).multiplyScalar(Math.max(_vel2.length(), 1));
          _pa.sub(_push); _vel.sub(_push2); _pa.toArray(pos,b); _vel.toArray(vel,b);
          _pb.add(_push); _vel2.add(_push3); _pb.toArray(pos,bj); _vel2.toArray(vel,bj);
        }
      }

      if (cfg.controlSphere0) {
        _c0.fromArray(pos, 0);
        _diff.copy(_c0).sub(_pa); const d2 = _diff.length(); const s2 = ri + sz[0];
        if (d2 < s2 && d2 > 0) {
          const diff = s2 - d2;
          _push.copy(_diff.normalize()).multiplyScalar(diff);
          _push2.copy(_push).multiplyScalar(Math.max(_vel.length(), 2));
          _pa.sub(_push); _vel.sub(_push2);
        }
      }

      if (Math.abs(_pa.x)+ri > cfg.maxX) { _pa.x = Math.sign(_pa.x)*(cfg.maxX-ri); _vel.x = -_vel.x*cfg.wallBounce; }
      if (cfg.gravity === 0) {
        if (Math.abs(_pa.y)+ri > cfg.maxY) { _pa.y = Math.sign(_pa.y)*(cfg.maxY-ri); _vel.y = -_vel.y*cfg.wallBounce; }
      } else if (_pa.y-ri < -cfg.maxY) { _pa.y = -cfg.maxY+ri; _vel.y = -_vel.y*cfg.wallBounce; }
      const bnd = Math.max(cfg.maxZ, cfg.maxSize);
      if (Math.abs(_pa.z)+ri > bnd) { _pa.z = Math.sign(_pa.z)*(cfg.maxZ-ri); _vel.z = -_vel.z*cfg.wallBounce; }
      _pa.toArray(pos,b); _vel.toArray(vel,b);
    }
  }
}

// ── Subsurface scattering material ───────────────────────────
class BallMaterial extends MeshPhysicalMaterial {
  constructor(params) {
    super(params);
    this.defines = { USE_UV: '' };
    this.onBeforeCompile = (shader) => {
      shader.fragmentShader = `
        uniform float thicknessPower;
        uniform float thicknessScale;
        uniform float thicknessDistortion;
        uniform float thicknessAmbient;
        uniform float thicknessAttenuation;
      ` + shader.fragmentShader;

      Object.assign(shader.uniforms, {
        thicknessPower:       { value: 2 },
        thicknessScale:       { value: 10 },
        thicknessDistortion:  { value: 0.1 },
        thicknessAmbient:     { value: 0 },
        thicknessAttenuation: { value: 0.1 },
      });

      shader.fragmentShader = shader.fragmentShader.replace('void main() {', `
        void RE_Direct_Scattering(
          const in IncidentLight dL, const in vec2 uv,
          const in vec3 gp, const in vec3 gn, const in vec3 gv,
          const in vec3 gcc, inout ReflectedLight rl
        ) {
          vec3 sh = normalize(dL.direction + (gn * thicknessDistortion));
          float sd = pow(saturate(dot(gv, -sh)), thicknessPower) * thicknessScale;
          #ifdef USE_COLOR
            vec3 si = (sd + thicknessAmbient) * vColor;
          #else
            vec3 si = (sd + thicknessAmbient) * diffuse;
          #endif
          rl.directDiffuse += si * thicknessAttenuation * dL.color;
        }
        void main() {
      `);

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_begin>',
        ShaderChunk.lights_fragment_begin.replaceAll(
          'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
          `RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
           RE_Direct_Scattering(directLight, vUv, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);`
        )
      );
    };
  }
}

// ── Spheres ───────────────────────────────────────────────────
const DEFAULTS = {
  count: 140, colors: [0xD4A0BC, 0xC4998A, 0xF5EBE7, 0xEDE8E1, 0xFDF0F6],
  ambientColor: 0xffffff, ambientIntensity: 1.2, lightIntensity: 180,
  materialParams: { metalness: 0.35, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12 },
  minSize: 0.3, maxSize: 0.9, size0: 1,
  gravity: 0.5, friction: 0.9975, wallBounce: 0.95, maxVelocity: 0.15,
  maxX: 5, maxY: 5, maxZ: 2, controlSphere0: false, followCursor: true,
};
const _dummy = new Object3D();

class BallpitSpheres extends InstancedMesh {
  constructor(renderer, userCfg = {}) {
    const cfg = { ...DEFAULTS, ...userCfg };
    const env = new PMREMGenerator(renderer).fromScene(new RoomEnvironment()).texture;
    super(new SphereGeometry(), new BallMaterial({ envMap: env, ...cfg.materialParams }), cfg.count);
    this.config = cfg;
    this.physics = new Physics(cfg);
    this.ambientLight = new AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
    this.add(this.ambientLight);
    this.pointLight = new PointLight(cfg.colors?.[0] ?? 0xffffff, cfg.lightIntensity);
    this.add(this.pointLight);
    this._applyColors(cfg.colors);
  }

  _applyColors(colors) {
    if (!Array.isArray(colors) || colors.length < 2) return;
    const cols = colors.map(c => new Color(c));
    for (let i = 0; i < this.count; i++) {
      const t = i / Math.max(this.count - 1, 1);
      const scaled = t * (cols.length - 1);
      const idx = Math.floor(scaled);
      const frac = scaled - idx;
      const ca = cols[idx];
      const cb = cols[Math.min(idx + 1, cols.length - 1)];
      this.setColorAt(i, new Color(
        ca.r + frac * (cb.r - ca.r),
        ca.g + frac * (cb.g - ca.g),
        ca.b + frac * (cb.b - ca.b),
      ));
      if (i === 0) this.pointLight.color.copy(cols[0]);
    }
    this.instanceColor.needsUpdate = true;
  }

  update(time) {
    this.physics.update(time);
    for (let i = 0; i < this.count; i++) {
      _dummy.position.fromArray(this.physics.positionData, 3 * i);
      _dummy.scale.setScalar(
        i === 0 && !this.config.followCursor ? 0 : this.physics.sizeData[i]
      );
      _dummy.updateMatrix();
      this.setMatrixAt(i, _dummy.matrix);
      if (i === 0) this.pointLight.position.copy(_dummy.position);
    }
    this.instanceMatrix.needsUpdate = true;
  }
}

// ── Factory ───────────────────────────────────────────────────
function createBallpit(canvas, props = {}) {
  const app = new ThreeApp({ canvas, size: 'parent' });
  app.renderer.toneMapping = ACESFilmicToneMapping;
  app.camera.position.set(0, 0, 20);
  app.camera.lookAt(0, 0, 0);
  app.resize();

  const spheres = new BallpitSpheres(app.renderer, props);
  app.scene.add(spheres);

  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const hitPoint = new Vector3();

  const pointer = addPointer(canvas, {
    onMove() {
      raycaster.setFromCamera(pointer.nPosition, app.camera);
      app.camera.getWorldDirection(plane.normal);
      raycaster.ray.intersectPlane(plane, hitPoint);
      spheres.physics.center.copy(hitPoint);
      spheres.config.controlSphere0 = true;
    },
    onLeave() {
      spheres.config.controlSphere0 = false;
    },
  });

  app.onBeforeRender = (time) => spheres.update(time);
  app.onAfterResize = (size) => {
    spheres.config.maxX = size.wWidth / 2;
    spheres.config.maxY = size.wHeight / 2;
  };

  return {
    app,
    spheres,
    dispose() { pointer.dispose(); app.dispose(); },
  };
}

// ── React component ───────────────────────────────────────────
const Ballpit = ({ className = '', followCursor = true, count = 140, gravity = 0.5, friction = 0.9975, wallBounce = 0.95 }) => {
  const canvasRef   = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    instanceRef.current = createBallpit(canvasRef.current, { followCursor, count, gravity, friction, wallBounce });
    return () => instanceRef.current?.dispose();
  }, []); // eslint-disable-line

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default Ballpit;

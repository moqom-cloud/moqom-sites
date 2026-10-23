// The ñü.ŵævẽš orb: a sphere of points with the listener at its centre. Every sound sits somewhere inside it, with a
// thread down to ear level so its height reads at a glance. While the song plays, each sound sends waves across the
// sphere from its own direction, and the whole sphere swells in and out with the music.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';

/** Metres: x right, y ahead, z up. */
export type Pos = { x: number; y: number; z: number };
export type Source = { pos: Pos; level: number };

const SOURCES = 8;
const toWorld = (p: Pos) => new Vector3(p.x, p.z, -p.y);
const fromWorld = (v: Vector3): Pos => ({ x: v.x, y: -v.z, z: v.y });

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uR;
  uniform float uSwell;
  uniform vec4 uSrc[${SOURCES}];
  varying float vGlow;
  varying float vH;
  void main() {
    vec3 n = normalize(position);
    float w = 0.0;
    float glow = 0.0;
    for (int i = 0; i < ${SOURCES}; i++) {
      float lvl = uSrc[i].w;
      if (lvl <= 0.001) continue;
      float d = acos(clamp(dot(n, uSrc[i].xyz), -1.0, 1.0));
      float ring = sin(d * 9.0 - uTime * 5.5) * exp(-d * 1.15);
      w += ring * lvl;
      glow += max(ring, 0.0) * lvl + exp(-d * 6.0) * lvl * 0.8;
    }
    vGlow = glow;
    vH = n.y;
    vec3 p = n * uR * (1.0 + 0.045 * w + 0.035 * uSwell);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (1.6 + glow * 3.2) * (40.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  varying float vGlow;
  varying float vH;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 c = vH < 0.0 ? mix(uMid, uLow, -vH) : mix(uMid, uHigh, vH);
    c = mix(c, vec3(1.0), clamp(vGlow * 0.35, 0.0, 0.6));
    gl_FragColor = vec4(c, a * (0.22 + clamp(vGlow, 0.0, 1.0) * 0.78));
  }
`;

export function createOrb(canvas: HTMLCanvasElement, radius: number) {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 200);
  const world = new Group();
  scene.add(world);

  // Points on the sphere.
  const N = 2600;
  const shell = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = i * Math.PI * (3 - Math.sqrt(5));
    shell.set([Math.cos(t) * r, y, Math.sin(t) * r], i * 3);
  }
  const shellGeo = new BufferGeometry();
  shellGeo.setAttribute('position', new BufferAttribute(shell, 3));
  const uniforms = {
    uTime: { value: 0 },
    uR: { value: radius },
    uSwell: { value: 0 },
    uSrc: { value: Array.from({ length: SOURCES }, () => new Vector4()) },
    uLow: { value: new Color('#22f59a') },
    uMid: { value: new Color('#3b9dff') },
    uHigh: { value: new Color('#a98bff') },
  };
  const shellMat = new ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending });
  world.add(new Points(shellGeo, shellMat));

  // The listener's head.
  const headGeo = new BufferGeometry();
  headGeo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3));
  const headMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: `void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = 900.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vec3(0.85,0.9,1.0), pow(a,3.0)*0.9); }`,
  });
  world.add(new Points(headGeo, headMat));

  // Threads: centre to each sound, and each sound straight down (or up) to ear level.
  const threadPos = new Float32Array(SOURCES * 4 * 6);
  const threadGeo = new BufferGeometry();
  threadGeo.setAttribute('position', new BufferAttribute(threadPos, 3));
  const threads = new LineSegments(threadGeo, new LineBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.35 }));
  world.add(threads);

  // Where your head points: a short arrow from the centre, shown while head tracking is on.
  const facePos = new Float32Array(3 * 2 * 3);
  const faceGeo = new BufferGeometry();
  faceGeo.setAttribute('position', new BufferAttribute(facePos, 3));
  const face = new LineSegments(faceGeo, new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
  face.visible = false;
  world.add(face);

  let yaw = 0.0;
  let pitch = 0.42;
  const dist = radius * 3.95;
  let W = 1;
  let H = 1;

  const placeCamera = () => {
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  };
  resize();
  placeCamera();
  new ResizeObserver(resize).observe(canvas);

  const tmp = new Vector3();
  return {
    /** Screen position in CSS pixels, and how near the point is (1 nearest, 0 farthest). */
    project(p: Pos) {
      tmp.copy(toWorld(p)).project(camera);
      const d = camera.position.distanceTo(toWorld(p));
      const rawX = ((tmp.x + 1) / 2) * W;
      const rawY = ((1 - tmp.y) / 2) * H;
      const padX = Math.min(28, W * 0.08);
      const padY = Math.min(22, H * 0.07);
      return {
        x: Math.max(padX, Math.min(W - padX, rawX)),
        y: Math.max(padY, Math.min(H - padY, rawY)),
        near: Math.max(0, Math.min(1, (dist + radius - d) / (2 * radius))),
      };
    },
    /** Moves a point along the plane facing the camera, under the pointer. */
    drag(clientX: number, clientY: number, from: Pos): Pos {
      const r = canvas.getBoundingClientRect();
      const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      const ray = new Raycaster();
      ray.setFromCamera(ndc, camera);
      const normal = camera.getWorldDirection(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(normal, toWorld(from));
      const hit = new Vector3();
      if (!ray.ray.intersectPlane(plane, hit)) return from;
      if (hit.length() > radius) hit.setLength(radius);
      return fromWorld(hit);
    },
    orbit(dx: number, dy: number) {
      yaw -= dx * 0.008;
      pitch = Math.max(-1.2, Math.min(1.35, pitch + dy * 0.006));
      placeCamera();
    },
    /** Points the arrow where the listener faces (radians; yaw right-positive, pitch up-positive), or hides it.
     *  The arrow starts where the listener stands in the bubble (ñü.mobility). */
    facing(pose: { yaw: number; pitch: number } | null, listener: Pos = { x: 0, y: 0, z: 0 }) {
      face.visible = !!pose;
      if (!pose) return;
      const me = toWorld(listener);
      const len = radius * 0.55;
      const f = new Vector3(Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), -Math.cos(pose.yaw) * Math.cos(pose.pitch));
      const tip = me.clone().add(f.clone().multiplyScalar(len));
      const side = new Vector3(-f.z, 0, f.x).normalize().multiplyScalar(radius * 0.07);
      const back = me.clone().add(f.clone().multiplyScalar(len - radius * 0.12));
      const l = back.clone().add(side);
      const r = back.clone().sub(side);
      facePos.set([me.x, me.y, me.z, tip.x, tip.y, tip.z, tip.x, tip.y, tip.z, l.x, l.y, l.z, tip.x, tip.y, tip.z, r.x, r.y, r.z]);
      faceGeo.attributes.position.needsUpdate = true;
    },
    /** `listener` is where you stand in the bubble (ñü.mobility); the head dot and the threads move with you. */
    frame(t: number, sources: Source[], swell: number, listener: Pos = { x: 0, y: 0, z: 0 }) {
      uniforms.uTime.value = t;
      uniforms.uSwell.value = swell;
      const me = toWorld(listener);
      headGeo.setAttribute('position', new BufferAttribute(new Float32Array([me.x, me.y, me.z]), 3));
      const loud = [...sources].sort((a, b) => b.level - a.level).slice(0, SOURCES);
      uniforms.uSrc.value.forEach((v, i) => {
        const s = loud[i];
        if (!s) return v.set(0, 0, 0, 0);
        const w = toWorld(s.pos);
        if (w.lengthSq() < 1e-6) w.set(0, 0, -1);
        w.normalize();
        v.set(w.x, w.y, w.z, s.level);
      });
      threadPos.fill(0);
      sources.slice(0, SOURCES * 2).forEach((s, i) => {
        const w = toWorld(s.pos);
        threadPos.set([me.x, me.y, me.z, w.x, w.y, w.z, w.x, w.y, w.z, w.x, 0, w.z], i * 12);
      });
      threadGeo.attributes.position.needsUpdate = true;
      threadGeo.setDrawRange(0, Math.min(sources.length, SOURCES * 2) * 4);
      renderer.render(scene, camera);
    },
  };
}

export type Orb = NonNullable<ReturnType<typeof createOrb>>;

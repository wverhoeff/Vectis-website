// Vectis hero: a glowing structural frame in a dark, moving field of light.
// The camera rises through the building as the visitor scrolls the capabilities.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildFrame, MID, LEVELS } from './frame-geometry.js';

const canvas = document.querySelector('#scene');
const track = document.querySelector('.track');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (canvas && track && webglOK()) {
  const mobile = matchMedia('(max-width: 900px)');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x050f1a, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050f1a, 700, 1900);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 5000);
  scene.add(camera);

  const CYAN = new THREE.Color(0x00eeff);
  const HOT = new THREE.Color(0x00eeff).multiplyScalar(2);
  const TOP = LEVELS[LEVELS.length - 1];

  // ---- Background: slow flowing ribbons of light, attached to the camera.
  const bgMat = new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false, fog: false,
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uLift: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime, uAspect, uLift;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.02; a*=.5; } return v; }
      void main(){
        vec2 uv = vUv; uv.x *= uAspect; uv.y += uLift;
        float t = uTime * .035;
        vec2 q = vec2(fbm(uv*1.4 + t), fbm(uv*1.4 + vec2(4.1,1.7) - t));
        float f = fbm(uv*1.2 + 1.8*q + vec2(0., t*.6));
        float ribbon = pow(abs(sin(f*9. + uv.x*1.5 - uv.y*2.)), 14.);
        float soft = pow(abs(sin(f*4. + uv.y*1.2)), 3.);
        vec3 navy = vec3(.02,.06,.105), deep = vec3(.01,.16,.22), cyan = vec3(0.,.93,1.);
        float mask = smoothstep(1.25, .1, distance(vUv, vec2(.78,.42)));
        vec3 col = mix(navy, deep, f*.9*mask);
        col += cyan * (ribbon*.30 + soft*.035) * mask;
        col *= .75 + .25*smoothstep(0.,.6,vUv.y);
        gl_FragColor = vec4(pow(col, vec3(2.2)), 1.);
      }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  bg.renderOrder = -10; bg.frustumCulled = false;
  camera.add(bg);

  // ---- Ground grid fading into the fog, and a glow pooled under the frame.
  const gridGeo = new THREE.BufferGeometry();
  const gp = [], gc = [];
  const ext = 1200, step = 60;
  for (let g = -ext; g <= ext; g += step) {
    for (const [a, b] of [[[g, 0, -ext], [g, 0, ext]], [[-ext, 0, g], [ext, 0, g]]]) {
      const seg = 24;
      for (let s = 0; s < seg; s++) {
        const p0 = a.map((v, k) => v + (b[k] - v) * s / seg), p1 = a.map((v, k) => v + (b[k] - v) * (s + 1) / seg);
        for (const p of [p0, p1]) {
          gp.push(...p);
          const d = Math.hypot(p[0], p[2]) / ext, k = Math.max(0, 1 - d) ** 2 * .12;
          gc.push(.45 * k, .8 * k, .9 * k);
        }
      }
    }
  }
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gridGeo.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  scene.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));

  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(0,238,255,.5)'); r.addColorStop(.3, 'rgba(0,150,190,.12)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 1; scene.add(pool);

  // ---- The frame: every member is a thin bar, built bottom-up on load.
  const { nodes, members } = buildFrame();
  const P = nodes.map(([x, y, z]) => new THREE.Vector3(x, y + MID, z));
  const thick = { column: 3.4, beam: 2.4, brace: 1.5 };
  const tone = { column: new THREE.Color(0xc4e9f2), beam: new THREE.Color(0x7fb9cb), brace: new THREE.Color(0x3f7f95) };
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ fog: true }), members.length);
  const up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  members.forEach((m, i) => {
    m.from = P[m.a]; m.to = P[m.b];
    m.dir = m.to.clone().sub(m.from); m.len = m.dir.length(); m.dir.normalize();
    m.q = new THREE.Quaternion().setFromUnitVectors(up, m.dir);
    const low = Math.min(m.from.y, m.to.y);
    m.start = 200 + low * 4 + ({ column: 0, beam: 160, brace: 320 })[m.type];
    bars.setColorAt(i, tone[m.type]);
  });
  const buildEnd = Math.max(...members.map(m => m.start)) + 600;
  scene.add(bars);

  function placeBars(clock) {
    members.forEach((m, i) => {
      const k = reduce.matches ? 1 : Math.min(1, Math.max(0, (clock - m.start) / 600));
      const e = 1 - Math.pow(1 - k, 3), len = Math.max(.001, m.len * e);
      v.copy(m.from).addScaledVector(m.dir, len / 2);
      sc.set(thick[m.type], len, thick[m.type]);
      bars.setMatrixAt(i, m4.compose(v, m.q, sc));
    });
    bars.instanceMatrix.needsUpdate = true;
  }

  // ---- Joints that flare as the slab passes.
  const jointGeo = new THREE.BufferGeometry().setFromPoints(P);
  const jointCol = new Float32Array(P.length * 3);
  jointGeo.setAttribute('color', new THREE.BufferAttribute(jointCol, 3));
  const joints = new THREE.Points(jointGeo, new THREE.PointsMaterial({ size: 9, sizeAttenuation: true, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex, toneMapped: false }));
  scene.add(joints);

  // ---- The slab: a glowing plane that moves to each capability's level.
  const slab = new THREE.Group();
  const slabFill = new THREE.Mesh(new THREE.PlaneGeometry(320, 240), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  slabFill.rotation.x = -Math.PI / 2; slab.add(slabFill);
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00eeff).multiplyScalar(2.6), toneMapped: false });
  for (const [w, d, x, z] of [[320, 2.4, 0, -120], [320, 2.4, 0, 120], [2.4, 240, -160, 0], [2.4, 240, 160, 0]]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d), edgeMat); e.position.set(x, 0, z); slab.add(e);
  }
  scene.add(slab);

  // ---- Points of light travelling through the members.
  const links = nodes.map(() => []);
  members.forEach((m, i) => { links[m.a].push(i); links[m.b].push(i); });
  const PULSES = mobile.matches ? 14 : 26;
  const pulseMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(2.6, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ffcff).multiplyScalar(3), toneMapped: false }), PULSES);
  scene.add(pulseMesh);
  const pulses = Array.from({ length: PULSES }, () => spawn());
  function spawn() {
    const start = Math.floor(Math.random() * nodes.length * .25);
    return { from: start, edge: links[start][Math.floor(Math.random() * links[start].length)], t: Math.random(), speed: .09 + Math.random() * .08 };
  }
  function advance(p, dt) {
    const m = members[p.edge];
    p.t += p.speed * dt / m.len;
    if (p.t < 1) return;
    const at = m.a === p.from ? m.b : m.a;
    if (P[at].y >= TOP) { Object.assign(p, spawn(), { t: 0 }); return; }
    const options = links[at].filter(e => e !== p.edge).flatMap(e => {
      const n = members[e], o = n.a === at ? n.b : n.a;
      return P[o].y > P[at].y ? [e, e, e] : [e];
    });
    if (!options.length) { Object.assign(p, spawn(), { t: 0 }); return; }
    p.from = at; p.edge = options[Math.floor(Math.random() * options.length)]; p.t = Math.min(p.t - 1, .99);
  }
  function placePulses(visible) {
    pulses.forEach((p, i) => {
      const m = members[p.edge], a = p.from === m.a ? m.from : m.to, b = p.from === m.a ? m.to : m.from;
      v.lerpVectors(a, b, Math.min(1, p.t));
      pulseMesh.setMatrixAt(i, m4.compose(v, q.identity(), sc.setScalar(visible)));
    });
    pulseMesh.instanceMatrix.needsUpdate = true;
  }

  // ---- Dust drifting upward through the scene.
  const DUST = mobile.matches ? 500 : 1200;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dustPos[i * 3] = (Math.random() - .5) * 1400; dustPos[i * 3 + 1] = Math.random() * 800; dustPos[i * 3 + 2] = (Math.random() - .5) * 1400; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 3, map: glowTex, color: 0x7fe9f5, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);

  // ---- Post: bloom gives the light its glow.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .85, .5, .82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- Camera stops: hero, foundation, structure, expression.
  const stops = [
    { r: 780, a: .78, y: 290, ty: 215, level: null },
    { r: 900, a: 1.05, y: 110, ty: 150, level: 0 },
    { r: 860, a: 1.35, y: 300, ty: 215, level: 200 },
    { r: 780, a: 1.7, y: 620, ty: 350, level: 400 },
  ];
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  function stageAt(s) {
    const i = Math.min(stops.length - 2, Math.floor(s)), t = smooth(Math.min(1, Math.max(0, s - i)));
    const A = stops[i], B = stops[i + 1];
    return { r: lerp(A.r, B.r, t), a: lerp(A.a, B.a, t), y: lerp(A.y, B.y, t), ty: lerp(A.ty, B.ty, t), A, B, t };
  }

  // Adaptive quality: if frames run slow, drop the glow pass and resolution.
  let lowPower = false, slowFrames = 0, sampled = 0;
  function watch(dt) {
    if (lowPower || sampled > 240) return;
    sampled++; if (dt > 34) slowFrames++;
    if (sampled > 45 && slowFrames / sampled > .5) { lowPower = true; renderer.setPixelRatio(1); renderer.setSize(w, h, false); dust.visible = false; }
  }
  let w = 0, h = 0, clock = 0, last = 0, raf = null, s = 0, sSmooth = 0, px = 0, py = 0, pxT = 0, pyT = 0, slabY = 0;
  function resize() {
    w = innerWidth; h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, mobile.matches ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    bloom.setSize(w * dpr / 2, h * dpr / 2);
    camera.aspect = w / h;
    // On wide screens the frame sits right of the copy; on phones it is centred above it.
    camera.filmOffset = mobile.matches ? 0 : -7;
    camera.updateProjectionMatrix();
    const dist = 1400, hh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
    bg.position.set(0, 0, -dist); bg.scale.set(hh * camera.aspect * 1.4, hh * 1.2, 1);
    bgMat.uniforms.uAspect.value = camera.aspect;
  }

  function progress() {
    const top = track.getBoundingClientRect().top;
    return Math.min(3, Math.max(0, -top / innerHeight));
  }

  function frame(dt) {
    clock += dt;
    s = progress();
    sSmooth += (s - sSmooth) * (reduce.matches ? 1 : 1 - Math.exp(-dt / 220));
    px += (pxT - px) * (1 - Math.exp(-dt / 400)); py += (pyT - py) * (1 - Math.exp(-dt / 400));
    const st = stageAt(sSmooth);
    const sway = reduce.matches ? 0 : Math.sin(clock * .00012) * .06;
    const ang = st.a + sway + px * .12;
    const rr = st.r * (mobile.matches ? 1.45 : 1), lift = mobile.matches ? 150 : 0;
    camera.position.set(Math.sin(ang) * rr, st.y + py * 30 + lift * .4, Math.cos(ang) * rr);
    camera.lookAt(0, st.ty - lift, 0);

    // Slab: cycles in the hero, then settles on each capability's level.
    const cycle = (Math.sin(clock * .00035 - Math.PI / 2) * .5 + .5) * TOP;
    const target = st.B.level === null ? cycle : st.A.level === null ? lerp(cycle, st.B.level, st.t) : lerp(st.A.level, st.B.level, st.t);
    slabY += (target - slabY) * (reduce.matches ? 1 : 1 - Math.exp(-dt / 160));
    const standing = reduce.matches ? 1 : Math.min(1, Math.max(0, (clock - buildEnd + 400) / 800));
    slab.position.y = slabY; slab.scale.setScalar(.6 + .4 * standing); slab.visible = standing > 0;
    slabFill.material.opacity = .1 * standing;

    // Joints near the slab flare; beams on that level turn cyan.
    for (let i = 0; i < P.length; i++) {
      const d = Math.abs(P[i].y - slabY), k = Math.max(0, 1 - d / 45) * standing;
      jointCol[i * 3] = .02 + k * .3; jointCol[i * 3 + 1] = .2 + k * 2.4; jointCol[i * 3 + 2] = .26 + k * 2.8;
    }
    jointGeo.attributes.color.needsUpdate = true;
    members.forEach((m, i) => {
      const near = m.type === 'beam' && Math.abs(m.from.y - slabY) < 22 && standing > 0;
      bars.setColorAt(i, near ? HOT : tone[m.type]);
    });
    bars.instanceColor.needsUpdate = true;

    if (clock < buildEnd + 50 || reduce.matches) placeBars(clock);
    if (!reduce.matches && clock > buildEnd - 400) pulses.forEach(p => advance(p, dt));
    placePulses(reduce.matches ? 0 : standing);

    if (!reduce.matches) {
      const a = dustGeo.attributes.position.array;
      for (let i = 1; i < a.length; i += 3) { a[i] += dt * .012; if (a[i] > 800) a[i] = 0; }
      dustGeo.attributes.position.needsUpdate = true;
    }
    bgMat.uniforms.uTime.value = clock / 1000;
    bgMat.uniforms.uLift.value = sSmooth * .18;

    // After the capabilities, the scene settles back as a quiet background.
    const after = Math.min(1, Math.max(0, (-track.getBoundingClientRect().bottom + innerHeight) / innerHeight));
    canvas.style.opacity = String(1 - after * .75);
    if (lowPower) renderer.render(scene, camera); else composer.render();
    watch(dt);
  }

  function tick(time) {
    raf = null;
    const dt = last ? Math.min(time - last, 120) : 16; last = time;
    try { frame(dt); } catch (err) { console.error(err); }
    if (!reduce.matches && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function wake() { if (raf === null) { last = 0; raf = requestAnimationFrame(tick); } }

  resize();
  addEventListener('resize', () => { resize(); wake(); });
  addEventListener('scroll', wake, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  reduce.addEventListener('change', wake);
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pxT = e.clientX / innerWidth - .5; pyT = e.clientY / innerHeight - .5; wake();
  });
  if (reduce.matches) clock = buildEnd + 2000;
  document.documentElement.classList.add('has-scene');
  wake();
}

// Section entrances, once each; nothing is hidden unless this script runs.
const reveals = [...document.querySelectorAll('[data-reveal]')];
if ('IntersectionObserver' in window && !reduce.matches) {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  reveals.forEach(el => { if (el.getBoundingClientRect().top > innerHeight * .9) io.observe(el); else el.classList.add('in'); });
  document.documentElement.classList.add('reveals-on');
} else reveals.forEach(el => el.classList.add('in'));

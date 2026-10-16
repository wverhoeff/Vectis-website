// Hero frame: builds storey by storey, turns slowly, carries points of light
// through its members and a cyan plane up through its levels.
import { buildFrame, makeView, LEVELS, MID } from './frame-geometry.js';

const figure = document.querySelector('.hero-visual');
const canvas = figure && figure.querySelector('.frame-canvas');
const toggle = figure && figure.querySelector('.motion-toggle');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

if (canvas && canvas.getContext) {
  const ctx = canvas.getContext('2d');
  const { nodes, members } = buildFrame();
  const CYAN = '0,238,255', LINE = '207,230,239';
  const BASE_YAW = .62, PITCH = .42, YAW_MIN = .28, YAW_MAX = 1.22;
  const top = LEVELS[LEVELS.length - 1] - MID;

  // Edges by node, for the travelling points.
  const links = nodes.map(() => []);
  members.forEach((m, i) => { links[m.a].push(i); links[m.b].push(i); });

  // Build order: bottom up, columns then beams then braces.
  const typeDelay = { column: 0, beam: .14, brace: .3 };
  members.forEach(m => {
    const low = Math.min(nodes[m.a][1], nodes[m.b][1]) + MID;
    m.start = 120 + low * 4.2 + typeDelay[m.type] * 1000;
    m.len = Math.hypot(...nodes[m.a].map((v, k) => v - nodes[m.b][k]));
  });
  const buildEnd = Math.max(...members.map(m => m.start)) + 520;

  let w = 0, h = 0, scale = 1, cx = 0, cy = 0, dpr = 1;
  let yaw = BASE_YAW, yawPointer = 0, yawTarget = 0, pitchPointer = 0, pitchTarget = 0;
  let clock = 0, last = 0, frame = null, inView = true, paused = false;
  const animated = () => !reduce.matches && !paused;

  // Fit: sample every angle the frame turns through, then scale the widest view into the box.
  function fit() {
    const r = figure.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    let bw = 0, bh = 0;
    for (let a = YAW_MIN - .05; a <= YAW_MAX + .05; a += .05) {
      const v = makeView(a, PITCH + .1, 1, 0, 0);
      const pts = nodes.map(v).concat([[-155, 0, -110], [155, 0, 110], [-155, 0, 110], [155, 0, -110]].map(q => v([q[0], top, q[2]])));
      bw = Math.max(bw, ...pts.map(q => Math.abs(q[0])));
      bh = Math.max(bh, ...pts.map(q => Math.abs(q[1])));
    }
    scale = Math.min((w * .46) / bw, (h * .45) / bh);
    cx = w / 2; cy = h / 2;
  }

  // Travelling points of light.
  const pulses = Array.from({ length: 16 }, (_, i) => newPulse(i));
  function newPulse(seed) {
    const start = Math.floor((seed * 7919) % nodes.length);
    const edge = links[start][0];
    return { from: start, edge, t: Math.random(), speed: .1 + Math.random() * .08 };
  }
  function advance(p, dt) {
    const m = members[p.edge];
    p.t += (p.speed * dt) / m.len;
    while (p.t >= 1) {
      p.t -= 1;
      const at = m.a === p.from ? m.b : m.a;
      const options = links[at].filter(e => e !== p.edge);
      // Lean upward, so the light climbs the structure; restart at the base from the top.
      const weighted = options.flatMap(e => {
        const n = members[e], other = n.a === at ? n.b : n.a;
        return nodes[other][1] > nodes[at][1] ? [e, e, e] : [e];
      });
      if (nodes[at][1] >= top || !weighted.length) { Object.assign(p, newPulse(Math.random() * 1e6), { t: 0 }); return; }
      p.from = at; p.edge = weighted[Math.floor(Math.random() * weighted.length)];
      return advance(p, 0);
    }
  }

  function draw() {
    const v = makeView(Math.min(YAW_MAX, Math.max(YAW_MIN, yaw + yawPointer)), PITCH + pitchPointer, scale, cx, cy);
    const p = nodes.map(v);
    const zr = 220;
    const fade = z => .45 + .55 * Math.min(1, Math.max(0, (zr - z) / (zr * 2)));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';

    // Ground grid, fading towards its edges.
    const gy = -MID, step = 60, ext = 360;
    for (let g = -ext; g <= ext; g += step) {
      const a = .16 * (1 - Math.abs(g) / (ext + step));
      ctx.strokeStyle = `rgba(${LINE},${a})`; ctx.lineWidth = 1;
      for (const [s, e] of [[[g, gy, -ext], [g, gy, ext]], [[-ext, gy, g], [ext, gy, g]]]) {
        const a1 = v(s), b1 = v(e); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
      }
    }

    const plane = animated() || clock > 0 ? -MID + (Math.sin(clock * .00032 - Math.PI / 2) * .5 + .5) * (top + MID) : 0;
    const built = reduce.matches ? Infinity : clock;

    for (const m of members) {
      const k = Math.min(1, Math.max(0, (built - m.start) / 520));
      if (k <= 0) continue;
      const a = p[m.a], b = p[m.b];
      const z = (a[2] + b[2]) / 2;
      const near = m.type === 'beam' && Math.abs(nodes[m.a][1] - plane) < 26;
      const alpha = (m.type === 'brace' ? .38 : m.type === 'beam' ? .62 : .8) * fade(z);
      ctx.strokeStyle = near ? `rgba(${CYAN},${.9 * fade(z)})` : `rgba(${LINE},${alpha})`;
      ctx.lineWidth = m.type === 'column' ? 1.6 : m.type === 'beam' ? 1.3 : 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]);
      ctx.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); ctx.stroke();
    }

    // The scan plane, once the frame stands.
    const standing = Math.min(1, Math.max(0, (built - buildEnd + 300) / 700));
    if (standing > 0) {
      const q = [[-155, plane, -110], [155, plane, -110], [155, plane, 110], [-155, plane, 110]].map(v);
      ctx.beginPath(); q.forEach((c, i) => i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])); ctx.closePath();
      ctx.fillStyle = `rgba(${CYAN},${.11 * standing})`; ctx.fill();
      ctx.strokeStyle = `rgba(${CYAN},${.85 * standing})`; ctx.lineWidth = 1.8; ctx.stroke();
    }

    // Nodes light up as the plane passes.
    for (let i = 0; i < p.length; i++) {
      const d = Math.abs(nodes[i][1] - plane);
      if (standing <= 0 || d > 40) continue;
      ctx.fillStyle = `rgba(${CYAN},${(1 - d / 40) * standing})`;
      ctx.beginPath(); ctx.arc(p[i][0], p[i][1], 2.6, 0, Math.PI * 2); ctx.fill();
    }

    // Points of light with short tails.
    if (standing > 0 && !reduce.matches) for (const pl of pulses) {
      const m = members[pl.edge];
      const from = pl.from === m.a ? m.a : m.b, to = from === m.a ? m.b : m.a;
      const A = p[from], B = p[to];
      const x = A[0] + (B[0] - A[0]) * pl.t, y = A[1] + (B[1] - A[1]) * pl.t;
      const tail = Math.max(0, pl.t - 26 / m.len);
      ctx.strokeStyle = `rgba(${CYAN},${.55 * standing})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(A[0] + (B[0] - A[0]) * tail, A[1] + (B[1] - A[1]) * tail); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(${CYAN},${.18 * standing})`; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(230,253,255,${standing})`; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function tick(time) {
    frame = null;
    if (!inView || document.hidden || !animated()) { last = 0; return; }
    const dt = last ? Math.min(time - last, 50) : 16;
    last = time; clock += dt;
    // Sway gently rather than spin, so the frame never turns edge-on.
    yaw = BASE_YAW + Math.sin(clock * .00016) * .2 + scrollYaw();
    yawPointer += (yawTarget - yawPointer) * (1 - Math.exp(-dt / 220));
    pitchPointer += (pitchTarget - pitchPointer) * (1 - Math.exp(-dt / 220));
    if (clock > buildEnd - 300) pulses.forEach(pl => advance(pl, dt));
    draw();
    frame = requestAnimationFrame(tick);
  }
  const scrollYaw = () => Math.min(scrollY, innerHeight) / innerHeight * .3;
  function start() { if (frame === null && inView && !document.hidden && animated()) frame = requestAnimationFrame(tick); }
  function still() { if (frame !== null) cancelAnimationFrame(frame); frame = null; last = 0; draw(); }

  function reconcile() {
    toggle.hidden = reduce.matches;
    if (reduce.matches) { clock = 0; yaw = BASE_YAW; still(); return; }
    if (paused) { if (clock < buildEnd) clock = buildEnd + 1200; still(); return; }
    start();
  }

  fit();
  figure.classList.add('canvas-ready');
  draw();
  reconcile();

  new ResizeObserver(() => { fit(); draw(); }).observe(figure);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { inView = e.isIntersecting; reconcile(); }).observe(figure);
  document.addEventListener('visibilitychange', reconcile);
  reduce.addEventListener('change', reconcile);
  addEventListener('scroll', () => { if (reduce.matches || paused) return; start(); }, { passive: true });

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  figure.closest('.hero')?.addEventListener('pointermove', e => {
    if (!fine.matches) return;
    yawTarget = (e.clientX / innerWidth - .5) * .6;
    pitchTarget = (e.clientY / innerHeight - .5) * .14;
  });
  figure.closest('.hero')?.addEventListener('pointerleave', () => { yawTarget = 0; pitchTarget = 0; });
  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.textContent = paused ? 'Play motion' : 'Pause motion';
    toggle.setAttribute('aria-pressed', String(paused));
    reconcile();
  });
}

// Section entrances: heading, then text, then the rest, once.
const reveals = [...document.querySelectorAll('[data-reveal]')];
if ('IntersectionObserver' in window && !reduce.matches) {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  // Only hide what is below the fold, and only now that the script is running.
  reveals.forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.remove('in'); io.observe(el); } else el.classList.add('in'); });
  document.documentElement.classList.add('reveals-on');
} else reveals.forEach(el => el.classList.add('in'));

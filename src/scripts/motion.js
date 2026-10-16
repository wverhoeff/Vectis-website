// Vectis structural frame: the plan rises into a frame on load, then a cyan
// plane climbs through the levels as each capability is read.
const root = document.documentElement;
const svg = document.querySelector('#structure');
const visual = document.querySelector('.structural-visual');
const toggle = document.querySelector('#motion-toggle');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (svg && visual && toggle) {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const baseYaw = .64;
  const levelHeights = [0, 180, 360];
  const paths = [...svg.querySelectorAll('[data-points]')].map(element => ({
    element,
    points: element.dataset.points.split(';').map(p => p.split(',').map(Number)),
    closed: element.dataset.closed === 'true',
    plane: element.dataset.plane === 'true',
  }));
  const dots = [...svg.querySelectorAll('[data-point]')].map(element => ({ element, point: element.dataset.point.split(',').map(Number) }));
  const slabs = [...svg.querySelectorAll('[data-slab]')];
  const levels = [...document.querySelectorAll('[data-level]')];
  const label = svg.querySelector('#level-label');

  let yaw = baseYaw, targetYaw = baseYaw, rise = 1, planeY = 180, target = null, active = -1;
  let paused = false, inView = false, frame = null, lastTime = 0, elapsed = 0, introStart = null;
  const animated = !reduceMotion.matches;
  if (animated) rise = 0;

  const project = ([x, y, z]) => [405 + (x * Math.cos(yaw) + z * Math.sin(yaw)) * 1.12, 520 - y * rise * 1.04 + (z * Math.cos(yaw) - x * Math.sin(yaw)) * .42];
  function draw() {
    for (const item of paths) {
      const pts = item.points.map(p => project(item.plane ? [p[0], planeY, p[2]] : p));
      item.element.setAttribute('d', 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + (item.closed ? 'Z' : ''));
    }
    if (label) { const [lx, ly] = project([150, planeY, 118]); label.setAttribute('x', (lx + 18).toFixed(1)); label.setAttribute('y', (ly + 5).toFixed(1)); }
    for (const { element, point } of dots) {
      const [x, y] = project(point);
      element.setAttribute('cx', x.toFixed(1)); element.setAttribute('cy', y.toFixed(1));
    }
  }

  function setActive(index) {
    if (index === active) return;
    active = index;
    target = index < 0 ? null : levelHeights[index];
    levels.forEach((el, i) => el.classList.toggle('is-active', i === index));
    slabs.forEach(el => el.classList.toggle('is-active', Number(el.dataset.slab) === index));
    if (label) label.textContent = index < 0 ? '' : levels[index].dataset.place;
    if (reduceMotion.matches && target !== null) { planeY = target; draw(); }
    wake();
  }

  const canRun = () => !paused && !reduceMotion.matches && inView && !document.hidden;
  const ease = t => 1 - Math.pow(1 - t, 3);

  function animate(time) {
    frame = null;
    if (!canRun()) { lastTime = 0; return; }
    const delta = lastTime ? Math.min(time - lastTime, 64) : 0;
    lastTime = time; elapsed += delta;
    if (rise < 1) {
      if (introStart === null) introStart = time;
      rise = ease(Math.min(1, Math.max(0, (time - introStart - 350) / 1400)));
      if (rise === 1) svg.classList.remove('intro');
    }
    const goal = target ?? 180 + Math.sin(elapsed * .00028) * 150;
    planeY += (goal - planeY) * (1 - Math.exp(-delta / (target === null ? 120 : 260)));
    yaw += (targetYaw - yaw) * (1 - Math.exp(-delta / 180));
    draw();
    frame = requestAnimationFrame(animate);
  }
  function wake() { if (frame === null && canRun()) frame = requestAnimationFrame(animate); }
  function reconcile() {
    toggle.hidden = reduceMotion.matches;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; lastTime = 0;
    if (reduceMotion.matches) { yaw = targetYaw = baseYaw; rise = 1; planeY = target ?? 180; svg.classList.remove('intro'); draw(); }
    wake();
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.textContent = paused ? 'Play motion' : 'Pause motion';
    toggle.setAttribute('aria-pressed', String(paused));
    if (paused && rise < 1) { rise = 1; svg.classList.remove('intro'); draw(); }
    reconcile();
  });
  visual.addEventListener('pointermove', event => {
    if (!finePointer.matches) return;
    const b = visual.getBoundingClientRect();
    targetYaw = baseYaw + Math.max(-.5, Math.min(.5, (event.clientX - b.left) / b.width - .5)) * .55;
    wake();
  });
  visual.addEventListener('pointerleave', () => { targetYaw = baseYaw; wake(); });

  // Hover, focus or tap a level to light it; scrolling also moves through them.
  levels.forEach((el, i) => {
    el.addEventListener('pointerenter', () => setActive(i));
    el.addEventListener('focusin', () => setActive(i));
    el.addEventListener('click', () => setActive(i));
  });
  if ('IntersectionObserver' in window) {
    const seen = new Map();
    const levelWatch = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(e.target, e.isIntersecting));
      const index = levels.findIndex(el => seen.get(el));
      if (index >= 0) setActive(index);
      else if (levels[0] && levels[0].getBoundingClientRect().top > innerHeight * .5) setActive(-1);
    }, { rootMargin: '-45% 0px -45% 0px' });
    levels.forEach(el => levelWatch.observe(el));
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; reconcile(); }, { threshold: .05 }).observe(visual);
  } else inView = true;

  if (animated) { svg.classList.add('intro'); draw(); }
  visual.classList.add('ready');
  reduceMotion.addEventListener('change', reconcile);
  document.addEventListener('visibilitychange', reconcile);
  reconcile();
}

// Section entrances: heading, then text, then the rest, once.
const reveals = [...document.querySelectorAll('[data-reveal]')];
if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  reveals.forEach(el => io.observe(el));
} else reveals.forEach(el => el.classList.add('in'));
root.classList.add('motion-ready');

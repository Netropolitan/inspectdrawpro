import * as THREE from 'three';

/* ---------- Nav scroll state ---------- */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Reveal on scroll ---------- */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const reveals = document.querySelectorAll('.section, .card');
if (!reduced && 'IntersectionObserver' in window) {
  reveals.forEach((el) => el.setAttribute('data-reveal', ''));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  reveals.forEach((el) => io.observe(el));
}

/* ---------- Hero: three.js wireframe blueprint ---------- */
const canvas = document.getElementById('hero-canvas');
if (canvas && !reduced) initHero(canvas);

function initHero(canvas) {
  const BLUE = 0x116dff;
  const CYAN = 0x3dd2d6;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0b0d, 14, 34);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 7.5, 13);
  camera.lookAt(0, 0, 0);

  const world = new THREE.Group();
  world.rotation.x = -Math.PI / 2.35; // lay the plan back like a drawing on a table
  scene.add(world);

  /* --- Procedural floor plan in wireframe --- */
  const plan = new THREE.Group();
  world.add(plan);
  const W = 20, H = 13;
  const pts = [];
  const line = (x1, y1, x2, y2) => pts.push(x1, y1, 0, x2, y2, 0);

  // outer wall
  line(-W/2, -H/2, W/2, -H/2); line(W/2, -H/2, W/2, H/2);
  line(W/2, H/2, -W/2, H/2); line(-W/2, H/2, -W/2, -H/2);
  // faint grid
  for (let x = -W/2 + 2; x < W/2; x += 2) line(x, -H/2, x, H/2);
  for (let y = -H/2 + 2; y < H/2; y += 2) line(-W/2, y, W/2, y);

  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.18 }));
  plan.add(grid);

  // stronger "rooms" overlay
  const rooms = [];
  const rp = [];
  const rect = (x, y, w, h) => { rp.push(x,y,0, x+w,y,0, x+w,y,0, x+w,y+h,0, x+w,y+h,0, x,y+h,0, x,y+h,0, x,y,0); rooms.push([x+w/2, y+h/2]); };
  rect(-W/2, -H/2, 7, 6); rect(-W/2, H/2-5, 6, 5); rect(1, -H/2, 6, 5);
  rect(W/2-6, -H/2, 6, 7); rect(W/2-7, H/2-6, 7, 6); rect(-1.5, 0.5, 5, 4.5);
  const roomGeo = new THREE.BufferGeometry();
  roomGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  const roomLines = new THREE.LineSegments(roomGeo, new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.65 }));
  plan.add(roomLines);

  /* --- Marker pins that drop in --- */
  const markers = [];
  const markerGeo = new THREE.SphereGeometry(0.32, 16, 16);
  rooms.slice(0, 5).forEach((r, i) => {
    const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? CYAN : BLUE }));
    m.position.set(r[0], r[1], 0);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 24), new THREE.MeshBasicMaterial({ color: i % 2 ? CYAN : BLUE, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.position.copy(m.position);
    plan.add(m); plan.add(ring);
    markers.push({ m, ring, base: r, delay: i * 0.45, t: 0 });
  });

  /* --- Pointer parallax --- */
  let px = 0, py = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', (e) => {
    tx = (e.clientX / window.innerWidth - 0.5);
    ty = (e.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  /* --- Resize --- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* --- Pause when offscreen / tab hidden --- */
  let running = true;
  const heroEl = canvas.closest('.hero');
  const vis = new IntersectionObserver((es) => { running = es[0].isIntersecting; if (running) tick(); }, { threshold: 0 });
  vis.observe(heroEl);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) tick(); });

  /* --- Animate --- */
  const clock = new THREE.Clock();
  let raf = null;
  function tick() {
    if (!running) { if (raf) cancelAnimationFrame(raf); raf = null; return; }
    raf = requestAnimationFrame(tick);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    world.rotation.z = Math.sin(t * 0.08) * 0.22; // gentle orbit
    px += (tx - px) * 0.04; py += (ty - py) * 0.04;
    world.rotation.y = px * 0.5;
    camera.position.y = 7.5 + py * 1.5;
    camera.lookAt(0, 0, 0);

    markers.forEach((mk) => {
      mk.t += dt;
      const local = Math.max(0, mk.t - mk.delay);
      const drop = Math.min(1, local * 2.2);
      const ease = 1 - Math.pow(1 - drop, 3);
      mk.m.position.z = (1 - ease) * 6;       // drop onto the plan
      mk.m.material.opacity = ease; mk.m.material.transparent = true;
      const pulse = 1 + Math.sin(t * 2.5 + mk.delay * 6) * 0.18;
      mk.ring.scale.setScalar(ease * pulse);
      mk.ring.material.opacity = 0.5 * ease;
    });

    renderer.render(scene, camera);
  }
  tick();
}

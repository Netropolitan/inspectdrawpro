import * as THREE from 'three';

const BLUE = 0x116dff;
const CYAN = 0x3dd2d6;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Nav scroll state ---------- */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Reveal on scroll ---------- */
if (!reduced && 'IntersectionObserver' in window) {
  const reveals = document.querySelectorAll('.section, .card');
  reveals.forEach((el) => el.setAttribute('data-reveal', ''));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  reveals.forEach((el) => io.observe(el));
}

/* ---------- Shared pointer ---------- */
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  ptr.tx = e.clientX / window.innerWidth - 0.5;
  ptr.ty = e.clientY / window.innerHeight - 0.5;
}, { passive: true });

/* ---------- Scene helpers ---------- */
function lineMat(color, opacity) { return new THREE.LineBasicMaterial({ color, transparent: true, opacity }); }

function blueprint({ w = 20, h = 13, grid = 0.16, rooms = true } = {}) {
  const g = new THREE.Group();
  const gp = [];
  const ln = (x1, y1, x2, y2) => gp.push(x1, y1, 0, x2, y2, 0);
  ln(-w/2,-h/2,w/2,-h/2); ln(w/2,-h/2,w/2,h/2); ln(w/2,h/2,-w/2,h/2); ln(-w/2,h/2,-w/2,-h/2);
  for (let x=-w/2+2; x<w/2; x+=2) ln(x,-h/2,x,h/2);
  for (let y=-h/2+2; y<h/2; y+=2) ln(-w/2,y,w/2,y);
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  g.add(new THREE.LineSegments(gg, lineMat(BLUE, grid)));
  const roomCenters = [];
  if (rooms) {
    const rp = [];
    const rect = (x,y,rw,rh) => { rp.push(x,y,0,x+rw,y,0, x+rw,y,0,x+rw,y+rh,0, x+rw,y+rh,0,x,y+rh,0, x,y+rh,0,x,y,0); roomCenters.push([x+rw/2,y+rh/2]); };
    rect(-w/2,-h/2,7,6); rect(-w/2,h/2-5,6,5); rect(1,-h/2,6,5);
    rect(w/2-6,-h/2,6,7); rect(w/2-7,h/2-6,7,6); rect(-1.5,0.5,5,4.5);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    g.add(new THREE.LineSegments(rg, lineMat(BLUE, 0.62)));
  }
  g.userData.rooms = roomCenters;
  return g;
}

function marker(color) {
  const grp = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), new THREE.MeshBasicMaterial({ color, transparent: true }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  grp.add(m); grp.add(ring); grp.userData = { m, ring };
  return grp;
}

function depthGrid(size = 40, step = 2, z = -7) {
  const pos = [];
  for (let x = -size/2; x <= size/2; x += step) pos.push(x, -size/2, z, x, size/2, z);
  for (let y = -size/2; y <= size/2; y += step) pos.push(-size/2, y, z, size/2, y, z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, lineMat(BLUE, 0.08));
}

/* ---------- Scene runner ---------- */
class Scene3D {
  constructor(canvas, build) {
    this.canvas = canvas; this.build = build;
    this.running = false; this.raf = null; this.built = false;
    const host = canvas.closest('section') || canvas;
    const io = new IntersectionObserver((es) => { this.running = es[0].isIntersecting; if (this.running) this.start(); }, { threshold: 0 });
    io.observe(host);
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    document.addEventListener('visibilitychange', () => { this.running = !document.hidden && this.running; if (this.running) this.start(); });
  }
  ensureBuilt() {
    if (this.built) return;
    // Lazily create the WebGL context only when this section first scrolls into view.
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.clock = new THREE.Clock();
    this.update = this.build(this) || (() => {});
    this.built = true; this.resize();
  }
  resize() {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  start() {
    this.ensureBuilt();
    if (this.raf) return;
    const loop = () => {
      if (!this.running) { this.raf = null; return; }
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(this.clock.elapsedTime, dt);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}

/* ---------- Scene builders ---------- */
function buildHero(s) {
  s.scene.fog = new THREE.Fog(0x0a0b0d, 16, 38);
  s.camera.fov = 42; s.camera.position.set(0, 8, 13);
  const world = new THREE.Group(); world.rotation.x = -Math.PI / 2.35; s.scene.add(world);
  world.add(depthGrid(44, 1.5, -8));
  const plan = blueprint(); world.add(plan);
  const rooms = plan.userData.rooms;
  const mk = rooms.slice(0, 5).map((r, i) => { const g = marker(i % 2 ? CYAN : BLUE); g.position.set(r[0], r[1], 0); plan.add(g); return { g, base: r, delay: i * 0.5, t: 0 }; });
  // search ring that hops between rooms
  const search = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.0, side: THREE.DoubleSide }));
  plan.add(search);
  let sIdx = 0, sTimer = 0;
  return (t, dt) => {
    world.rotation.z = Math.sin(t * 0.07) * 0.2;
    ptr.x += (ptr.tx - ptr.x) * 0.04; ptr.y += (ptr.ty - ptr.y) * 0.04;
    world.rotation.y = ptr.x * 0.5;
    s.camera.position.z = 13 + Math.sin(t * 0.25) * 0.8;
    s.camera.position.y = 8 + ptr.y * 1.6;
    s.camera.lookAt(0, 0, 0);
    mk.forEach((o) => {
      o.t += dt; const local = Math.max(0, o.t - o.delay); const e = 1 - Math.pow(1 - Math.min(1, local * 2), 3);
      o.g.position.z = (1 - e) * 6; o.g.userData.m.material.opacity = e;
      const p = 1 + Math.sin(t * 2.5 + o.delay * 6) * 0.18;
      o.g.userData.ring.scale.setScalar(e * p); o.g.userData.ring.material.opacity = 0.5 * e;
    });
    sTimer += dt; if (sTimer > 3) { sTimer = 0; sIdx = (sIdx + 1) % rooms.length; }
    const room = rooms[sIdx]; search.position.set(room[0], room[1], 0.1);
    const sp = (sTimer % 3) / 3; search.scale.setScalar(0.6 + sp * 0.9); search.material.opacity = Math.max(0, 0.55 * (1 - sp));
  };
}

function buildProblem(s) {
  s.camera.fov = 40; s.camera.position.set(0, 0, 12);
  const grp = new THREE.Group(); grp.rotation.set(-0.12, 0.3, 0); s.scene.add(grp);
  grp.add(depthGrid(34, 1.7, -7));
  // loose drawing sheets with greyed-out text lines
  const sheet = (w, h, op) => {
    const g = new THREE.Group();
    const pg = []; const ln = (a, b, c, d) => pg.push(a, b, 0, c, d, 0);
    ln(-w/2,-h/2,w/2,-h/2); ln(w/2,-h/2,w/2,h/2); ln(w/2,h/2,-w/2,h/2); ln(-w/2,h/2,-w/2,-h/2);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pg, 3));
    g.add(new THREE.LineSegments(gg, lineMat(BLUE, op)));
    const tl = [];
    const rows = Math.floor(h / 0.75) - 1;
    for (let i = 0; i < rows; i++) {
      const y = h/2 - 0.65 - i * 0.7; const wl = (w - 1) * (0.5 + ((i * 7) % 4) * 0.13);
      tl.push(-w/2 + 0.45, y, 0, -w/2 + 0.45 + wl, y, 0);
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tl, 3));
    g.add(new THREE.LineSegments(tg, lineMat(0x9aa1ac, op * 0.45)));
    return g;
  };
  const defs = [
    [-3.4, 1.7, -1.5, 3.2, 4.2, 0.5, 0.22],
    [0.4, 2.4, -2.5, 2.6, 3.4, 0.3, -0.3],
    [3.3, 0.6, -1, 2.8, 3.8, 0.55, 0.1],
    [-1.4, -1.7, 0.5, 3.6, 2.6, 0.35, -0.14],
    [2.4, -2.5, -0.5, 2.3, 3.0, 0.4, 0.38],
    [-4, -2.2, -2, 2.1, 2.8, 0.25, -0.46],
  ];
  const sheets = defs.map(([x, y, z, w, h, op, rz], i) => {
    const g = sheet(w, h, op); g.position.set(x, y, z); g.rotation.z = rz;
    grp.add(g); return { g, y, rz, ph: i * 1.1 };
  });
  // photos detached from their location
  const photo = (x, y, z, rz) => {
    const g = new THREE.Group();
    const w = 1.5, h = 1.1;
    const pg = []; const ln = (a, b, c, d) => pg.push(a, b, 0, c, d, 0);
    ln(-w/2,-h/2,w/2,-h/2); ln(w/2,-h/2,w/2,h/2); ln(w/2,h/2,-w/2,h/2); ln(-w/2,h/2,-w/2,-h/2);
    ln(-w/2+0.2,-h/2+0.25,-0.1,h/2-0.45); ln(-0.1,h/2-0.45,w/2-0.2,-h/2+0.25);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pg, 3));
    g.add(new THREE.LineSegments(gg, lineMat(CYAN, 0.5)));
    g.position.set(x, y, z); g.rotation.z = rz; grp.add(g); return g;
  };
  const photos = [photo(1.4, -0.4, 1.2, -0.2), photo(-2.6, 3.2, 0.8, 0.35)];
  // a finding with nowhere to live
  const lost = marker(CYAN); lost.position.set(3.5, -1.6, 1.4); grp.add(lost);
  return (t) => {
    grp.rotation.y = 0.3 + Math.sin(t * 0.18) * 0.08 + ptr.x * 0.3;
    grp.rotation.x = -0.12 + ptr.y * 0.12;
    sheets.forEach((o) => {
      o.g.position.y = o.y + Math.sin(t * 0.7 + o.ph) * 0.22;
      o.g.rotation.z = o.rz + Math.sin(t * 0.5 + o.ph * 2) * 0.05;
    });
    photos.forEach((p, i) => { p.rotation.z += Math.sin(t * 0.4 + i * 2.4) * 0.0008; });
    lost.position.y = -1.6 + Math.sin(t * 0.8) * 0.3;
    const pu = 1 + Math.sin(t * 2.2) * 0.2;
    lost.userData.ring.scale.setScalar(pu); lost.userData.m.material.opacity = 0.75 + Math.sin(t * 2.2) * 0.25;
  };
}

function buildSolution(s) {
  s.camera.fov = 40; s.camera.position.set(0, 0, 11);
  const grp = new THREE.Group(); grp.rotation.set(-0.35, -0.5, 0); s.scene.add(grp);
  // document page outline
  const pw = 8, ph = 10.5;
  const pg = []; const ln = (a,b,c,d)=>pg.push(a,b,0,c,d,0);
  ln(-pw/2,-ph/2,pw/2,-ph/2); ln(pw/2,-ph/2,pw/2,ph/2); ln(pw/2,ph/2,-pw/2,ph/2); ln(-pw/2,ph/2,-pw/2,-ph/2);
  const pgg = new THREE.BufferGeometry(); pgg.setAttribute('position', new THREE.Float32BufferAttribute(pg, 3));
  grp.add(new THREE.LineSegments(pgg, lineMat(BLUE, 0.6)));
  // "text lines" that draw in
  const lines = [];
  for (let i = 0; i < 9; i++) {
    const y = ph/2 - 1.4 - i * 1.0; const wl = 5.5 - (i % 3) * 1.2;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([-pw/2+1, y, 0, -pw/2+1+wl, y, 0], 3));
    const m = new THREE.Line(geo, lineMat(0x9aa1ac, 0.0)); grp.add(m); lines.push(m);
  }
  // markers that pop onto the page
  const spots = [[1.6, 2.5], [-1.2, -1], [2, -3.2]];
  const mk = spots.map((p, i) => { const g = marker(i === 1 ? CYAN : BLUE); g.position.set(p[0], p[1], 0); g.scale.setScalar(0); grp.add(g); return g; });
  // scan line
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(pw, 0.06), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.5 }));
  grp.add(scan);
  return (t) => {
    grp.rotation.y = -0.5 + Math.sin(t * 0.3) * 0.12 + ptr.x * 0.25;
    grp.rotation.x = -0.35 + ptr.y * 0.12;
    const cyc = (t % 6) / 6;
    lines.forEach((l, i) => { l.material.opacity = 0.5 * Math.min(1, Math.max(0, cyc * 9 - i)); });
    mk.forEach((g, i) => { const e = Math.min(1, Math.max(0, cyc * 4 - 1.5 - i * 0.4)); g.scale.setScalar(1 - Math.pow(1 - e, 3)); g.userData.ring.scale.setScalar((1 - Math.pow(1 - e, 3)) * (1 + Math.sin(t * 3) * 0.15)); });
    scan.position.y = ph/2 - (cyc * ph); scan.material.opacity = 0.5 * Math.sin(cyc * Math.PI);
  };
}

function buildWorkflow(s) {
  s.camera.fov = 42; s.camera.position.set(0, 3.8, 13.5);
  const world = new THREE.Group(); world.rotation.x = -0.5; world.position.y = 1.1; s.scene.add(world);
  const plan = blueprint({ w: 14, h: 9 }); world.add(plan);
  const room = [3.5, -1.5];
  const hi = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0 })); hi.position.set(room[0], room[1], -0.02); plan.add(hi);
  const search = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, side: THREE.DoubleSide })); search.position.set(room[0], room[1], 0.1); plan.add(search);
  const mk = marker(BLUE); mk.position.set(room[0], room[1], 0); plan.add(mk);
  // Floating UI in screen-facing space (children of the scene, not the tilted plan):
  // inspection panel to the RIGHT, exported document to the LEFT, both held in front
  // of the blueprint so neither cuts through it.
  const uiMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op });
  const uiPanel = (w, h, fill, edge, op) => {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, h), uiMat(fill, op));
    const ed = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), lineMat(edge, 0.9));
    g.add(bg); g.add(ed); g.userData = { bg, ed }; return g;
  };
  const panel = uiPanel(3.5, 4.6, 0x12161f, 0x33405a, 0.92); s.scene.add(panel);
  const status = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), uiMat(0x5a6068, 1)); status.position.set(-1.05, 1.5, 0.03); panel.add(status);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), uiMat(0x1a2230, 1)); photo.position.set(0, -0.4, 0.03); panel.add(photo);
  panel.position.set(10, 2, 6); panel.rotation.y = -0.18;
  const report = uiPanel(3.2, 4.4, 0x0c1018, BLUE, 0.96); s.scene.add(report);
  for (let i = 0; i < 6; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1.15, 1.5 - i*0.55, 0.03, 1.15 - (i%2)*0.7, 1.5 - i*0.55, 0.03], 3)); report.add(new THREE.Line(g, lineMat(0x9aa1ac, 0.5))); }
  report.position.set(-5.4, 2, 6); report.rotation.y = 0.18; report.scale.setScalar(0);
  const steps = [...document.querySelectorAll('#story-steps li')];
  const CY = 9; // seconds per full loop
  let lastPhase = -1;
  s.camera.lookAt(0, 1.1, 0);
  return (t) => {
    world.rotation.y = ptr.x * 0.2;
    s.camera.lookAt(0, 1.1, 0);
    const c = (t % CY) / CY; const phase = Math.min(3, Math.floor(c * 4)); const local = (c * 4) % 1;
    if (phase !== lastPhase) { steps.forEach((el, i) => el.classList.toggle('active', i === phase)); lastPhase = phase; }
    // phase 0 search
    search.visible = phase === 0; if (phase === 0) { search.scale.setScalar(0.5 + local * 1); search.material.opacity = 0.6 * (1 - local); }
    hi.material.opacity = phase >= 0 ? 0.08 + (phase === 0 ? 0.1 * (1 - local) : 0.05) : 0;
    // phase 1 marker
    const md = phase < 1 ? 0 : (phase === 1 ? 1 - Math.pow(1 - local, 3) : 1);
    mk.position.z = (1 - md) * 5; mk.userData.m.material.opacity = md; mk.userData.ring.scale.setScalar(md * (1 + Math.sin(t * 3) * 0.15)); mk.userData.ring.material.opacity = 0.5 * md;
    // phase 2 inspection panel slides in from the right; fades out as export begins
    let pd = 0, pfade = 1;
    if (phase === 2) pd = 1 - Math.pow(1 - local, 3); else if (phase === 3) { pd = 1; pfade = 1 - local; }
    const pOp = pd * pfade;
    panel.visible = phase >= 2; panel.position.x = 10 - pd * 5.2;
    panel.userData.bg.material.opacity = 0.92 * pOp; panel.userData.ed.material.opacity = 0.9 * pOp;
    status.material.opacity = pOp; photo.material.opacity = pOp;
    status.material.color.setHex(phase >= 2 && local > 0.5 ? 0x116dff : 0x5a6068);
    // phase 3 exported document rises on the LEFT of the blueprint
    const rd = phase < 3 ? 0 : 1 - Math.pow(1 - local, 3);
    report.visible = phase >= 3; report.scale.setScalar(rd); report.position.x = -5.4 - (1 - rd) * 2; report.rotation.x = (1 - rd) * 1.0;
  };
}

function buildDeployment(s) {
  s.camera.fov = 42; s.camera.position.set(0, 6, 15);
  const world = new THREE.Group(); s.scene.add(world);
  world.add(depthGrid(40, 1.6, -6));
  // ground plan
  const plan = blueprint({ w: 18, h: 12, grid: 0.12, rooms: false }); plan.rotation.x = -Math.PI / 2; world.add(plan);
  // wireframe buildings
  const defs = [[-5, -2, 3, 4, 3.5], [0, 1, 4, 3, 5.5], [4.5, -3, 3, 3, 2.6], [3, 3, 2.5, 2.5, 4], [-3, 3.5, 2.5, 2, 3]];
  const mks = [];
  defs.forEach(([x, z, bw, bd, bh], i) => {
    const box = new THREE.BoxGeometry(bw, bh, bd);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), lineMat(BLUE, 0.55));
    edges.position.set(x, bh / 2, z); world.add(edges);
    const face = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x116dff, transparent: true, opacity: 0.05 }));
    face.position.copy(edges.position); world.add(face);
    const g = marker(i % 2 ? CYAN : BLUE); g.position.set(x, bh + 0.6, z); g.scale.setScalar(0.8); g.userData.delay = i * 0.4; g.userData.t = 0; world.add(g); mks.push(g);
  });
  return (t, dt) => {
    world.rotation.y = t * 0.12 + ptr.x * 0.3;
    s.camera.position.y = 6 + ptr.y * 1.2; s.camera.lookAt(0, 1.5, 0);
    mks.forEach((g) => { g.userData.t += dt; const bob = Math.sin(t * 1.6 + g.userData.delay * 6) * 0.18; g.position.y = g.position.y + 0; g.children[0].position.y = bob; g.userData.ring.scale.setScalar(0.8 * (1 + Math.sin(t * 2.5 + g.userData.delay * 6) * 0.2)); });
  };
}

/* ---------- Mount ---------- */
if (!reduced) {
  const map = { hero: buildHero, problem: buildProblem, solution: buildSolution, workflow: buildWorkflow, deployment: buildDeployment };
  document.querySelectorAll('canvas.scene').forEach((c) => {
    const b = map[c.dataset.scene];
    if (b) new Scene3D(c, b);
  });
}

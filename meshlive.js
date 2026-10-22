'use strict';
/*
 * Rob Mesh explainer — "watch it operate" card.
 * A self-contained demo of the ACTUAL mesh topology: the mac hub in the middle,
 * the five worker machines as their real geomesh ships on a ring around it, the
 * git wire between them, and pulses travelling along it — green = a job dispatched
 * (push), blue = the result returned (pull). Demo, not live telemetry.
 */
(function () {
  const details = document.getElementById('meshcard');
  const canvas = document.getElementById('mesh-canvas');
  if (!details || !canvas) return;

  let renderer, scene, camera, clock, started = false, running = false;
  let world, shipNodes = [], pulsePool = [], OUT, IN;

  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function makeLabel(text) {
    const c = document.createElement('canvas');
    const font = '600 30px system-ui, -apple-system, sans-serif';
    let g = c.getContext('2d');
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 30;
    c.width = w; c.height = 50;
    g = c.getContext('2d');
    g.font = font;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.95)'; g.shadowBlur = 10;
    g.fillStyle = 'rgba(230,238,250,0.96)';
    g.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    sp.scale.set(c.width / 170, c.height / 170, 1);
    return sp;
  }

  function init() {
    started = true;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    camera.position.set(0, 3.4, 14);

    world = new THREE.Group();
    scene.add(world);

    // ---- the actual machines -------------------------------------------------
    const R = 5.3;
    const NODES = [
      { name: 'mac',          role: 'orchestrator',          key: 'enterprise', hex: 0x6f8bff, hub: true },
      { name: 'win-2',        role: 'Legion Go · fastest',   key: 'viper',      hex: 0xff7a2a },
      { name: 'win',          role: 'field host',            key: 'falcon',     hex: 0xffb020 },
      { name: 'studio-linux', role: 'VM · Linux build',      key: 'tie',        hex: 0xb060ff },
      { name: 'studio-linux2',role: 'VM · Linux build',      key: 'discovery',  hex: 0xff5bd0 },
      { name: 'pacland-rog',  role: 'physical Linux',        key: 'serenity',   hex: 0x60a5fa },
    ];
    const workers = NODES.filter((n) => !n.hub);
    const legend = document.getElementById('mesh-legend');
    NODES.forEach((n, i) => {
      if (!n.hub) {
        const k = workers.indexOf(n);
        const a = (k / workers.length) * Math.PI * 2;
        n.pos = [Math.cos(a) * R, Math.sin(a * 2.4) * 0.55, Math.sin(a) * R];
      } else {
        n.pos = [0, 0, 0];
      }

      const ship = RobShips.build(n.key);
      const len = ship.userData.length || 1.5;
      const scale = (n.hub ? 1.5 : 0.92) / len;
      ship.scale.setScalar(scale);
      ship.userData.key = n.key;
      ship.userData.color = n.hex;

      const g = new THREE.Group();
      g.add(ship);
      g.position.set(n.pos[0], n.pos[1], n.pos[2]);
      if (!n.hub) g.lookAt(0, 0, 0);           // nose (+Z) faces the hub
      g.userData = { name: n.name, role: n.role, baseY: n.pos[1], i };
      world.add(g);
      shipNodes.push(g);

      // label sprite above the ship
      const label = makeLabel(n.hub ? 'mac · orchestrator' : n.name + ' · ' + n.role);
      label.position.set(n.pos[0], n.pos[1] + 1.25, n.pos[2]);
      world.add(label);

      // legend chip
      if (legend) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.color = '#' + n.hex.toString(16).padStart(6, '0');
        dot.style.background = dot.style.color;
        chip.appendChild(dot);
        chip.appendChild(document.createTextNode(n.name + (n.role ? ' · ' + n.role : '')));
        legend.appendChild(chip);
      }
    });

    // ---- the git wire (hub → each worker) ------------------------------------
    const linePts = new Float32Array(workers.length * 2 * 3);
    workers.forEach((n, k) => {
      linePts[k * 6 + 0] = 0; linePts[k * 6 + 1] = 0; linePts[k * 6 + 2] = 0;
      linePts[k * 6 + 3] = n.pos[0]; linePts[k * 6 + 4] = n.pos[1]; linePts[k * 6 + 5] = n.pos[2];
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePts, 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: lin(0x7cc8ff), transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    world.add(lines);

    // ---- pulses travelling the wire ------------------------------------------
    const glow = glowTexture();
    OUT = lin(0x7ee2a8); IN = lin(0x7cc8ff);
    const PULSES = 14;
    for (let i = 0; i < PULSES; i++) {
      const mat = new THREE.SpriteMaterial({ map: glow, color: OUT, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      world.add(sp);
      pulsePool.push({ sp, a: 0, b: 1, t: Math.random(), dir: Math.random() < 0.5 ? 'out' : 'in', speed: 0.25 + Math.random() * 0.3 });
    }

    // ---- starfield backdrop --------------------------------------------------
    {
      const N = 260;
      const arr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 40;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 26;
        arr[i * 3 + 2] = -4 - Math.random() * 22;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffffff, size: 0.10, map: glow, transparent: true, opacity: 0.6,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      world.add(pts);
    }

    clock = new THREE.Clock();
    resize();
    loop();
  }

  const _a = new THREE.Vector3(), _b = new THREE.Vector3();

  function loop() {
    requestAnimationFrame(loop);
    if (!running || !started) return;
    const dt = Math.min(0.1, clock.getDelta());
    const t = clock.elapsedTime;

    // gentle camera orbit
    const cx = Math.sin(t * 0.1) * 14;
    const cz = Math.cos(t * 0.1) * 14;
    camera.position.set(cx, 3.4 + Math.sin(t * 0.23) * 0.6, cz);
    camera.lookAt(0, 0, 0);

    // ships idle: slow roll + bob
    for (const g of shipNodes) {
      g.rotation.y += dt * 0.5;
      g.position.y = g.userData.baseY + Math.sin(t * 0.9 + g.userData.i) * 0.14;
      if (g.userData.name === 'mac') g.rotation.y = t * 0.4;
    }

    // pulses along hub ↔ worker
    for (const p of pulsePool) {
      p.t += p.speed * dt;
      if (p.t >= 1) {
        p.t = 0;
        p.b = 1 + ((Math.random() * (shipNodes.length - 1)) | 0);
        p.dir = Math.random() < 0.5 ? 'out' : 'in';
        p.speed = 0.22 + Math.random() * 0.32;
      }
      const from = shipNodes[p.dir === 'out' ? 0 : p.b];
      const to = shipNodes[p.dir === 'out' ? p.b : 0];
      from.getWorldPosition(_a);
      to.getWorldPosition(_b);
      _a.lerp(_b, p.t);
      p.sp.position.copy(_a);
      const s = 0.16 + 0.10 * Math.sin(p.t * Math.PI);
      p.sp.scale.set(s, s, 1);
      p.sp.material.color.copy(p.dir === 'out' ? OUT : IN);
      p.sp.visible = true;
    }

    renderer.render(scene, camera);
  }

  function resize() {
    if (!renderer || !canvas) return;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 640;
    const h = canvas.clientHeight || 430;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  details.addEventListener('toggle', () => {
    running = details.open;
    if (details.open && !started) init();
    if (details.open) resize();
  });

  // fullscreen toggle — the demo card expands to fill the viewport
  const fsBtn = document.getElementById('mesh-fs');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      if (el) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (canvas.requestFullscreen) {
        canvas.requestFullscreen();
      } else if (canvas.webkitRequestFullscreen) {
        canvas.webkitRequestFullscreen();
      }
    });
  }
  const onFullscreen = () => resize();
  document.addEventListener('fullscreenchange', onFullscreen);
  document.addEventListener('webkitfullscreenchange', onFullscreen);

  window.addEventListener('resize', () => { if (details.open || document.fullscreenElement) resize(); });

  // if the card is open on first load, start immediately; otherwise start the cheap loop
  if (details.open) { running = true; init(); }
  if (!started) requestAnimationFrame(loop);
})();

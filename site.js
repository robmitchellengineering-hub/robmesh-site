'use strict';
// Rob Mesh explainer — animated background. Reuses the board's ship geomesh (RobShips)
// plus a streaming hyperspace starfield, as a fixed full-screen canvas behind the text.
(function () {
  const canvas = document.getElementById('bg');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0.6, 12);
  camera.lookAt(0, 0, 0);

  // ---- round glow texture (star orbs) -------------------------------------
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  // ---- hyperspace starfield ------------------------------------------------
  const N = 600;
  const dirs = new Float32Array(N * 3);
  const radii = new Float32Array(N);
  const speeds = new Float32Array(N);
  const warpR = new Float32Array(N);
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 14 + Math.random() * 80;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    dirs[i * 3] = Math.sin(ph) * Math.cos(th);
    dirs[i * 3 + 1] = Math.sin(ph) * Math.sin(th);
    dirs[i * 3 + 2] = Math.cos(ph);
    radii[i] = r; warpR[i] = r; speeds[i] = 2 + Math.random() * 8;
    pos[i * 3] = dirs[i * 3] * r; pos[i * 3 + 1] = dirs[i * 3 + 1] * r; pos[i * 3 + 2] = dirs[i * 3 + 2] * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.22, map: glowTexture(), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  const streakMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  scene.add(streaks);

  // ---- ships (the demo fleet) ----------------------------------------------
  const shipGroup = new THREE.Group();
  scene.add(shipGroup);
  const fleet = [];
  const KEYS = ['enterprise', 'falcon', 'xwing', 'valiant', 'viper', 'serenity'];
  const SHIP_SCALE = 0.35;
  for (let i = 0; i < KEYS.length; i++) {
    const ship = RobShips.build(KEYS[i]);
    const len = ship.userData.length || 1.5;
    ship.scale.setScalar(SHIP_SCALE / len);
    ship.userData.baseOp = 1;
    ship.traverse((o) => { if (o.isMesh && o.material) o.material.userData.baseOp = o.material.opacity; });
    const g = new THREE.Group();
    g.add(ship);
    const a = (i / KEYS.length) * Math.PI * 2;
    g.position.set(Math.cos(a) * 6, Math.sin(a) * 3.4, -2 + Math.random() * 4);
    shipGroup.add(g);
    fleet.push({ g, ship, a, va: 0.04 + Math.random() * 0.06, r: 5.5 + Math.random() * 1.2, z: -2 + Math.random() * 4, color: RobShips.build(KEYS[i]).userData.color });
  }

  // laser beams (thin hot core + glow)
  const laserGroup = new THREE.Group();
  scene.add(laserGroup);
  const beams = fleet.map(() => {
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe0e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    core.visible = glow.visible = false;
    laserGroup.add(core); laserGroup.add(glow);
    return { core, glow, until: 0 };
  });

  const _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

  // ---- loop -----------------------------------------------------------------
  const clock = new THREE.Clock();
  let lastBeam = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, clock.getDelta());
    const t = clock.elapsedTime;

    // stars stream outward continuously (the "we are going fast" demo)
    {
      const pa = starGeo.attributes.position.array;
      const sa = streakGeo.attributes.position.array;
      const maxR = 96, minR = 12, hole = 10;
      for (let i = 0; i < N; i++) {
        warpR[i] += speeds[i] * dt * 2.2;
        if (warpR[i] > maxR) warpR[i] = minR + Math.random() * 6;
        const dx = dirs[i * 3], dy = dirs[i * 3 + 1], dz = dirs[i * 3 + 2];
        const r = warpR[i];
        pa[i * 3] = dx * r; pa[i * 3 + 1] = dy * r; pa[i * 3 + 2] = dz * r;
        const tail = r * 0.4;
        const ir = Math.max(hole, r - tail);
        sa[i * 6] = dx * r; sa[i * 6 + 1] = dy * r; sa[i * 6 + 2] = dz * r;
        sa[i * 6 + 3] = dx * ir; sa[i * 6 + 4] = dy * ir; sa[i * 6 + 5] = dz * ir;
      }
      starGeo.attributes.position.needsUpdate = true;
      streakGeo.attributes.position.needsUpdate = true;
      streakMat.opacity = 0.75;
      stars.rotation.y += dt * 0.05;
    }

    // ships fly around the perimeter, occasional lasers
    for (let i = 0; i < fleet.length; i++) {
      const f = fleet[i];
      f.a += f.va * dt;
      f.g.position.x = Math.cos(f.a) * f.r;
      f.g.position.y = Math.sin(f.a) * f.r * 0.6;
      f.g.position.z = f.z + Math.sin(t * 0.6 + i) * 0.6;
      f.g.lookAt(0, 0, 0);
      f.g.rotateY(Math.PI / 2);
      f.ship.rotation.y = t * 0.4;
    }
    // fire a laser between two random ships a few times a second
    if (t - lastBeam > 0.9) {
      lastBeam = t;
      const a = fleet[(Math.random() * fleet.length) | 0];
      const b = fleet[(Math.random() * fleet.length) | 0];
      if (a !== b) {
        _d.subVectors(b.g.position, a.g.position);
        const len = _d.length();
        _d.normalize();
        for (const beam of beams) {
          beam.core.position.copy(a.g.position).addScaledVector(_d, len * 0.5);
          beam.core.quaternion.setFromUnitVectors(_up, _d);
          beam.core.scale.set(1, len, 1);
          beam.glow.position.copy(beam.core.position);
          beam.glow.quaternion.copy(beam.core.quaternion);
          beam.glow.scale.copy(beam.core.scale);
          beam.core.visible = beam.glow.visible = true;
          beam.until = t + 0.24;
        }
      }
    }
    for (const beam of beams) {
      const k = Math.max(0, beam.until - t) / 0.24;
      if (k <= 0) { beam.core.visible = beam.glow.visible = false; continue; }
      beam.core.material.opacity = k;
      beam.glow.material.opacity = 0.55 * k;
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  frame();
})();

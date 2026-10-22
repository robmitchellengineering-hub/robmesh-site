'use strict';
// Rob Mesh explainer — animated background. Reuses the board's ship geomesh (RobShips)
// plus a streaming hyperspace starfield, as a fixed full-screen canvas behind the text.
(function () {
  const canvas = document.getElementById('bg');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

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

  // ---- the living nebula (the orchestrator, in the middle) ------------------
  const NOISE_GLSL = `
float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1.0,0.0,0.0)),f.x),mix(hash(i+vec3(0.0,1.0,0.0)),hash(i+vec3(1.0,1.0,0.0)),f.x),f.y),
             mix(mix(hash(i+vec3(0.0,0.0,1.0)),hash(i+vec3(1.0,0.0,1.0)),f.x),mix(hash(i+vec3(0.0,1.0,1.0)),hash(i+vec3(1.0,1.0,1.0)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float v=0.0; float a=0.5;
  for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; }
  return v;
}
`;
  const NEBULA_R = 2.52, GEOMESH_R = NEBULA_R * 0.58;
  const nebulaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmp: { value: 0.13 } },
    vertexShader: `
      uniform float uTime; uniform float uAmp;
      varying vec3 vNormal; varying vec3 vWorld; varying float vNoise;
      ${NOISE_GLSL}
      void main(){
        vec3 p=position;
        float ang=p.y*1.4+uTime*0.4;
        float c=cos(ang); float s=sin(ang);
        vec3 sp=vec3(c*p.x-s*p.z, p.y, s*p.x+c*p.z);
        float d=fbm(normalize(sp)*2.4+uTime*0.2);
        vNoise=d;
        vec3 np=sp+normal*d*uAmp;
        vNormal=normalize(normalMatrix*normal);
        vec4 wp=modelMatrix*vec4(np,1.0);
        vWorld=wp.xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(np,1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal; varying vec3 vWorld; varying float vNoise;
      ${NOISE_GLSL}
      vec3 ramp(float t){
        vec3 teal=vec3(0.10,0.60,0.75); vec3 blue=vec3(0.16,0.44,0.85);
        vec3 green=vec3(0.25,0.82,0.55); vec3 pink=vec3(0.95,0.36,0.55); vec3 red=vec3(0.95,0.24,0.38);
        vec3 col=mix(teal,blue,smoothstep(0.0,0.3,t));
        col=mix(col,green,smoothstep(0.3,0.55,t));
        col=mix(col,pink,smoothstep(0.55,0.8,t));
        col=mix(col,red,smoothstep(0.8,1.0,t));
        return col;
      }
      void main(){
        vec3 n=normalize(vNormal);
        vec3 vd=normalize(cameraPosition-vWorld);
        float fres=pow(1.0-clamp(dot(n,vd),0.0,1.0),2.0);
        vec3 dir=normalize(vWorld);
        float d=fbm(dir*2.6+uTime*0.12);
        float radial=1.0-fres;
        float t=clamp(radial*0.65+d*0.35,0.0,1.0);
        vec3 col=ramp(t);
        float luma=dot(col,vec3(0.2126,0.7152,0.0722));
        col=clamp(mix(vec3(luma),col,1.30),0.0,1.0);
        float dens=smoothstep(0.15,0.85,d);
        float i=dens*0.95+fres*0.18+vNoise*0.12+0.08;
        gl_FragColor=vec4(col*i,1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  });
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(NEBULA_R, 64, 64), nebulaMat);
  scene.add(nebula);
  const nebulaGeom = new THREE.Mesh(
    new THREE.IcosahedronGeometry(GEOMESH_R, 1),
    new THREE.MeshBasicMaterial({ color: 0x8fd8ff, wireframe: true, transparent: true, opacity: 0.34, depthWrite: false })
  );
  scene.add(nebulaGeom);
  const irisRings = [];
  const ringDefs = [
    { r: NEBULA_R * 1.18, tube: 0.035, color: 0x06b6d4, op: 0.32, tilt: 0.16, spin: 0.25 },
    { r: NEBULA_R * 1.42, tube: 0.028, color: 0x6ea8ff, op: 0.26, tilt: -0.12, spin: -0.2 },
  ];
  for (const rd of ringDefs) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(rd.r, rd.tube, 12, 128),
      new THREE.MeshBasicMaterial({ color: rd.color, transparent: true, opacity: rd.op, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.rotation.x = rd.tilt * 0.6;
    m.rotation.y = rd.tilt;
    m.userData = { spin: rd.spin };
    scene.add(m);
    irisRings.push(m);
  }

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

    // the nebula lives
    nebulaMat.uniforms.uTime.value = t;
    nebulaGeom.rotation.y = t * 0.12;
    nebulaGeom.rotation.x = Math.sin(t * 0.2) * 0.2;
    for (const ring of irisRings) {
      ring.rotation.z += ring.userData.spin * dt;
      ring.rotation.x = 0.16 * 0.6 + Math.sin(t * 0.3) * 0.03;
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

'use strict';
/*
 * Rob Mesh explainer — "watch it operate" card, grounded in the board's ACTUAL look:
 * the orchestrator is a living NEBULA in the middle (FBM + fresnel shader, "Eye of God"),
 * and the machines are GEOMESH node orbs around it — a wireframe sphere for real hardware,
 * a wireframe pyramid for the VMs — joined to the nebula by the git wire. Pulses travel
 * the wire: green = a job dispatched (push), blue = the result returned (pull).
 * Ported from board/client.js (buildNebula + buildNode), not re-invented.
 */
(function () {
  const details = document.getElementById('meshcard');
  const canvas = document.getElementById('mesh-canvas');
  if (!details || !canvas) return;

  let renderer, scene, camera, clock, started = false, running = false;
  let world, nebulaMat, nebulaGeom, irisRings = [], nodeOrbs = [], pulsePool = [], OUT, IN;

  const NEBULA_R = 2.52;            // nebula sphere radius (board/client.js)
  const GEOMESH_R = NEBULA_R * 0.58; // wireframe inside the nebula
  const CLOUD_R = NEBULA_R;          // resting cloud size
  const NODE_R = 0.60;               // NOMINAL.nodeR
  const MESH_BLUE = 0x4d6bfe;        // DeepSeek blue — the geomesh wireframe
  const MESH_GREEN = 0x00ff41;       // matrix green — dispatch pulse
  const HEX_BLUE = 0x2563eb, HEX_CYAN = 0x06b6d4;

  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  // ---- shared GLSL noise (value noise + fbm), verbatim from board/client.js ----
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

  function buildNebula() {
    nebulaMat = new THREE.ShaderMaterial({
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
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(CLOUD_R, 64, 64), nebulaMat);
    world.add(sphere);

    // faint wireframe polyhedron embedded inside the cloud
    nebulaGeom = new THREE.Mesh(
      new THREE.IcosahedronGeometry(GEOMESH_R, 1),
      new THREE.MeshBasicMaterial({ color: 0x8fd8ff, wireframe: true, transparent: true, opacity: 0.34, depthWrite: false })
    );
    world.add(nebulaGeom);

    // iris rings — face-on tori, gently tilted, slowly rotating
    const ringDefs = [
      { r: NEBULA_R * 1.18, tube: 0.035, color: HEX_CYAN, op: 0.32, tilt: 0.16, spin: 0.25 },
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
      world.add(m);
      irisRings.push(m);
    }

    // the hub label — the nebula IS the orchestrator (mac)
    const hubLabel = makeLabel('mac · orchestrator');
    hubLabel.position.set(0, -NEBULA_R - 0.7, 0);
    world.add(hubLabel);
  }

  function buildNode(host, role, isVm, pos, glowTex) {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);
    group.userData = { host, baseY: pos[1] };

    // two nested wireframe geomeshes: sphere for hardware, pyramid for VMs
    const geo = isVm
      ? new THREE.ConeGeometry(NODE_R * 0.90, NODE_R * 1.2, 4)
      : new THREE.SphereGeometry(NODE_R * 0.90, 6, 4);
    const hex = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: lin(MESH_BLUE), wireframe: true, transparent: true, opacity: 1.0, depthWrite: false, toneMapped: false,
    }));
    hex.renderOrder = 3;
    group.add(hex);

    const geo2 = isVm
      ? new THREE.ConeGeometry(NODE_R * 1.06, NODE_R * 1.4, 4)
      : new THREE.SphereGeometry(NODE_R * 1.06, 6, 4);
    const hexGlow = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({
      color: lin(MESH_BLUE), wireframe: true, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false,
    }));
    hexGlow.renderOrder = 2;
    group.add(hexGlow);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: HEX_BLUE, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(NODE_R * 2.0, NODE_R * 2.0, 1);
    group.add(glow);

    // label above the orb
    const label = makeLabel(host + ' · ' + role);
    label.position.set(0, 1.15, 0);
    group.add(label);

    world.add(group);
    nodeOrbs.push(group);
    return group;
  }

  function init() {
    started = true;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d);
    scene.fog = new THREE.FogExp2(0x05070d, 0.02);
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
    camera.position.set(0, 1.0, 10.5);
    camera.lookAt(0, 0, 0);

    world = new THREE.Group();
    world.rotation.x = 0.06;
    scene.add(world);

    buildNebula();

    // the five worker machines (mac is the nebula, not a node)
    const RING_R = 4.6;
    const WORKERS = [
      { host: 'win-2', role: 'Legion Go', vm: false },
      { host: 'win', role: 'laptop', vm: false },
      { host: 'studio-linux', role: 'VM', vm: true },
      { host: 'studio-linux2', role: 'VM', vm: true },
      { host: 'pacland-rog', role: 'Linux', vm: false },
    ];
    const glowTex = glowTexture();
    const legend = document.getElementById('mesh-legend');
    if (legend) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.color = '#06b6d4'; dot.style.background = '#06b6d4';
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode('mac · orchestrator (nebula)'));
      legend.appendChild(chip);
    }
    WORKERS.forEach((n, i) => {
      const a = (i / WORKERS.length) * Math.PI * 2;
      const pos = [Math.cos(a) * RING_R, Math.sin(a * 2.4) * 0.4, Math.sin(a) * RING_R];
      buildNode(n.host, n.role, n.vm, pos, glowTex);
      if (legend) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const dot = document.createElement('span');
        dot.className = 'dot';
        const col = '#' + MESH_BLUE.toString(16).padStart(6, '0');
        dot.style.color = col; dot.style.background = col;
        chip.appendChild(dot);
        chip.appendChild(document.createTextNode(n.host + (n.role ? ' · ' + n.role : '')));
        legend.appendChild(chip);
      }
    });

    // the git wire: nebula (origin) -> each worker orb
    {
      const pts = new Float32Array(WORKERS.length * 2 * 3);
      WORKERS.forEach((n, k) => {
        const a = (k / WORKERS.length) * Math.PI * 2;
        pts[k * 6 + 0] = 0; pts[k * 6 + 1] = 0; pts[k * 6 + 2] = 0;
        pts[k * 6 + 3] = Math.cos(a) * RING_R; pts[k * 6 + 4] = Math.sin(a * 2.4) * 0.4; pts[k * 6 + 5] = Math.sin(a) * RING_R;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      world.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        color: lin(0x7cc8ff), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })));
    }

    // pulses travelling the wire
    OUT = lin(MESH_GREEN); IN = lin(MESH_BLUE);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: glowTex, color: OUT, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat);
      world.add(sp);
      pulsePool.push({ sp, b: 1, t: Math.random(), dir: Math.random() < 0.5 ? 'out' : 'in', speed: 0.25 + Math.random() * 0.3 });
    }

    // starfield backdrop
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
      world.add(new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffffff, size: 0.10, map: glowTex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending,
      })));
    }

    clock = new THREE.Clock();
    resize();
    loop();
  }

  const _a = new THREE.Vector3(), _zero = new THREE.Vector3();

  function loop() {
    requestAnimationFrame(loop);
    if (!running || !started) return;
    const dt = Math.min(0.1, clock.getDelta());
    const t = clock.elapsedTime;

    // gentle camera orbit
    const cx = Math.sin(t * 0.1) * 10.5;
    const cz = Math.cos(t * 0.1) * 10.5;
    camera.position.set(cx, 1.0 + Math.sin(t * 0.23) * 0.4, cz);
    camera.lookAt(0, 0, 0);

    // nebula lives
    nebulaMat.uniforms.uTime.value = t;
    nebulaGeom.rotation.y = t * 0.12;
    nebulaGeom.rotation.x = Math.sin(t * 0.2) * 0.2;
    for (const ring of irisRings) {
      ring.rotation.z += ring.userData.spin * dt;
      ring.rotation.x = 0.16 * 0.6 + Math.sin(t * 0.3) * 0.03;
    }

    // node orbs idle: slow roll + bob
    nodeOrbs.forEach((g, i) => {
      g.rotation.y += dt * 0.5;
      g.position.y = g.userData.baseY + Math.sin(t * 0.9 + i) * 0.12;
    });

    // pulses along nebula <-> orb
    for (const p of pulsePool) {
      p.t += p.speed * dt;
      if (p.t >= 1) {
        p.t = 0;
        p.b = ((Math.random() * nodeOrbs.length) | 0);
        p.dir = Math.random() < 0.5 ? 'out' : 'in';
        p.speed = 0.22 + Math.random() * 0.32;
      }
      const a = p.dir === 'out' ? _zero : nodeOrbs[p.b].position;
      const b = p.dir === 'out' ? nodeOrbs[p.b].position : _zero;
      _a.copy(a).lerp(b, p.t);
      p.sp.position.copy(_a);
      const s = 0.15 + 0.10 * Math.sin(p.t * Math.PI);
      p.sp.scale.set(s, s, 1);
      p.sp.material.color.copy(p.dir === 'out' ? OUT : IN);
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

  if (details.open) { running = true; init(); }
  if (!started) requestAnimationFrame(loop);
})();

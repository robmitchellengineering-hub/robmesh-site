'use strict';

/*
 * RobShips — procedural geomesh spaceships for the Rob Mesh board.
 *
 * WIREFRAME geomesh approximations of famous spaceships (and one Valiant Charger),
 * built from low-poly primitives so each reads as a faceted "geomesh" — the same
 * visual language as the board's node orbs (Icosahedron + wireframe, harness blue,
 * tone-mapped OFF so the colour lands exactly).
 *
 * Loaded AFTER vendor/three.min.js. Defines window.RobShips.
 *
 * Coordinate convention for every builder: nose/forward = +Z, up = +Y, right = +X.
 * build(key) returns a THREE.Group whose:
 *   userData.extent = Vector3(x,y,z) bounding-box size
 *   userData.length = the longest extent (used to normalise display size)
 *   userData.rear   = the minimum Z (where the exhaust flame seats)
 */

(function () {
  const BLUE = 0x4d6bfe;
  const BLUE_LIN = new THREE.Color(BLUE).convertSRGBToLinear();
  const ACCENT = 0x9fd0ff;
  const ACCENT_LIN = new THREE.Color(ACCENT).convertSRGBToLinear();

  function hullMat(opacity) {
    return new THREE.MeshBasicMaterial({
      color: BLUE_LIN, wireframe: true, transparent: true,
      opacity: opacity == null ? 1.0 : opacity, depthWrite: false, toneMapped: false,
    });
  }
  function accentMat(opacity) {
    return new THREE.MeshBasicMaterial({
      color: ACCENT_LIN, wireframe: true, transparent: true,
      opacity: opacity == null ? 0.45 : opacity, depthWrite: false, toneMapped: false,
      blending: THREE.AdditiveBlending,
    });
  }
  const MAT = hullMat();
  const ACC = accentMat();

  // One distinct, vivid colour per ship so each reads as its own download at a
  // glance. tone-mapped OFF + sRGB->linear means each lands as the exact hex.
  const SHIP_COLORS = {
    enterprise:    0x6f8bff,   // bright blue (the flagship)
    falcon:        0xffb020,   // amber
    xwing:         0xdbe6f5,   // silver (was red — red reads as "offline")
    tie:           0xb060ff,   // violet
    stardestroyer: 0x2fd0ff,   // cyan
    galactica:     0xffd54d,   // gold
    viper:         0xff7a2a,   // orange
    borg:          0x9b87f5,   // soft violet (was matrix green — green is reserved for machine state)
    discovery:     0xff5bd0,   // magenta
    serenity:      0x60a5fa,   // soft blue (was mint — mint read as green)
    valiant:       0xffe14d,   // yellow (was red — red reads as "offline")
  };

  function shipGroup() { return new THREE.Group(); }
  function add(g, geom, mat, pos, rot, scale) {
    const m = new THREE.Mesh(geom, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    g.add(m);
    return m;
  }
  function cyl(rt, rb, h, seg) { return new THREE.CylinderGeometry(rt, rb, h, seg || 8, 1); }
  // A nose cone pointing along +Z (ConeGeometry points +Y by default).
  function nose(r, h, seg) { return new THREE.ConeGeometry(r, h, seg || 8, 1); }
  const NOSE_ROT = [Math.PI / 2, 0, 0];   // +Y -> +Z
  function ico(r, d) { return new THREE.IcosahedronGeometry(r, d == null ? 1 : d); }
  function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  function torus(r, t) { return new THREE.TorusGeometry(r, t, 6, 12); }

  const builders = {};

  // ---- USS Enterprise (TOS) -------------------------------------------------
  builders.enterprise = function () {
    const g = shipGroup();
    add(g, cyl(0.62, 0.62, 0.13, 12), MAT, [0, 0, 0.34]);                       // saucer
    add(g, cyl(0.22, 0.24, 0.72, 8), MAT, [0, -0.02, -0.42], [Math.PI / 2, 0, 0]); // hull
    add(g, cyl(0.1, 0.12, 0.28, 8), MAT, [0, -0.02, -0.02], [Math.PI / 2, 0, 0]);  // neck
    for (const sx of [-1, 1]) {
      // pylon: spans from the hull (x~0.2) out to the nacelle (x~0.42), so no gap
      add(g, box(0.26, 0.06, 0.14), MAT, [sx * 0.31, 0.15, -0.66], [0, 0, sx * 0.12]);
      add(g, cyl(0.13, 0.13, 0.85, 8), MAT, [sx * 0.42, 0.3, -0.7], [Math.PI / 2, 0, 0]);
      add(g, cyl(0.06, 0.06, 0.1, 6), ACC, [sx * 0.42, 0.3, -1.13]);
    }
    return g;
  };

  // ---- Millennium Falcon -----------------------------------------------------
  builders.falcon = function () {
    const g = shipGroup();
    add(g, cyl(0.6, 0.6, 0.16, 12), MAT, [0, 0, 0]);
    add(g, cyl(0.14, 0.14, 0.3, 8), MAT, [0.58, 0, 0.05], [0, 0, Math.PI / 2]);   // cockpit
    for (const sx of [-1, 1]) add(g, box(0.15, 0.13, 0.5), MAT, [sx * 0.26, 0, 0.55]); // mandibles
    add(g, cyl(0.02, 0.02, 0.14, 6), MAT, [-0.2, 0.14, -0.1]);                   // dish stalk
    add(g, cyl(0.15, 0.15, 0.03, 10), MAT, [-0.2, 0.21, -0.1]);                  // dish
    return g;
  };

  // ---- X-Wing ------------------------------------------------------------------
  builders.xwing = function () {
    const g = shipGroup();
    add(g, nose(0.15, 0.5), MAT, [0, 0, 0.62], NOSE_ROT);
    add(g, cyl(0.16, 0.18, 0.55, 8), MAT, [0, 0, 0.12], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      add(g, box(0.52, 0.025, 0.3), MAT, [Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.08], [0, 0, a]);
      add(g, cyl(0.055, 0.055, 0.32, 6), MAT, [Math.cos(a) * 0.56, Math.sin(a) * 0.56, -0.1], [Math.PI / 2, 0, 0]);
    }
    return g;
  };

  // ---- TIE Fighter -------------------------------------------------------------
  builders.tie = function () {
    const g = shipGroup();
    add(g, ico(0.24, 1), MAT, [0, 0, 0]);                          // smaller cockpit ball
    for (const sx of [-1, 1]) {
      add(g, cyl(0.03, 0.03, 0.3, 6), MAT, [sx * 0.36, 0, 0], [0, 0, Math.PI / 2]);  // pylon
      add(g, cyl(0.5, 0.5, 0.025, 6), MAT, [sx * 0.58, 0, 0], [0, 0, Math.PI / 2]);  // wide hex panel
    }
    return g;
  };

  // ---- Imperial Star Destroyer -------------------------------------------------
  builders.stardestroyer = function () {
    const g = shipGroup();
    // flattened triangular wedge, thicker so a side view still reads as a blade
    const v = new Float32Array([
       0.00,  0.22,  0.90,   // 0 nose top
       0.00, -0.22,  0.90,   // 1 nose bottom
      -0.82,  0.30, -0.55,   // 2 back top-left
       0.82,  0.30, -0.55,   // 3 back top-right
      -0.82, -0.30, -0.55,   // 4 back bottom-left
       0.82, -0.30, -0.55,   // 5 back bottom-right
    ]);
    const idx = [
      0, 2, 3, 1, 5, 4,
      0, 1, 4, 0, 4, 2,
      0, 3, 5, 0, 5, 1,
      2, 3, 5, 2, 5, 4,
    ];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    add(g, geom, MAT, [0, 0, 0]);
    // command tower, tall and clearly at the wide STERN (back, -Z)
    add(g, box(0.36, 0.22, 0.36), MAT, [0, 0.44, -0.48]);
    add(g, box(0.2, 0.1, 0.2), MAT, [0, 0.58, -0.5]);
    return g;
  };

  // ---- Battlestar Galactica ----------------------------------------------------
  builders.galactica = function () {
    const g = shipGroup();
    add(g, box(0.26, 0.26, 1.55), MAT, [0, 0, -0.05]);            // central hull
    add(g, box(0.38, 0.16, 0.42), MAT, [0, 0, 0.88]);             // alligator head
    for (const sx of [-1, 1]) {
      add(g, box(0.1, 0.34, 0.5), MAT, [sx * 0.34, 0.1, 0.05]);   // vertical strut
      add(g, box(0.46, 0.14, 1.05), MAT, [sx * 0.62, -0.16, -0.12]); // flight pod, offset down
    }
    add(g, box(0.36, 0.3, 0.3), MAT, [0, 0, -0.94]);              // engine block
    return g;
  };

  // ---- Colonial Viper ----------------------------------------------------------
  builders.viper = function () {
    const g = shipGroup();
    add(g, nose(0.13, 0.42), MAT, [0, 0, 0.62], NOSE_ROT);
    add(g, cyl(0.14, 0.17, 0.5, 8), MAT, [0, 0, 0.14], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      add(g, box(0.4, 0.03, 0.22), MAT, [sx * 0.26, -0.06, -0.18], [0, 0, sx * -0.35]);
    }
    add(g, cyl(0.08, 0.08, 0.34, 6), MAT, [0, 0.16, -0.5], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      add(g, cyl(0.08, 0.08, 0.34, 6), MAT, [sx * 0.18, -0.05, -0.5], [Math.PI / 2, 0, 0]);
    }
    return g;
  };

  // ---- Borg Cube ----------------------------------------------------------------
  builders.borg = function () {
    const g = shipGroup();
    add(g, box(0.82, 0.82, 0.82), MAT, [0, 0, 0]);
    add(g, box(0.5, 0.5, 0.5), ACC, [0, 0, 0]);   // inner detail, no sphere
    return g;
  };

  // ---- Discovery One (2001) -----------------------------------------------------
  builders.discovery = function () {
    const g = shipGroup();
    add(g, ico(0.3, 1), MAT, [0, 0, 1.0]);                                  // command sphere
    add(g, cyl(0.05, 0.05, 1.6, 8), MAT, [0, 0, -0.2], [Math.PI / 2, 0, 0]); // long thin spine
    add(g, box(0.4, 0.4, 0.55), MAT, [0, 0, -1.28]);                        // rectangular engine block
    return g;
  };

  // ---- Serenity (Firefly) -------------------------------------------------------
  builders.serenity = function () {
    const g = shipGroup();
    add(g, cyl(0.3, 0.26, 0.7, 8), MAT, [0, 0.02, -0.05], [Math.PI / 2, 0, 0]);
    add(g, cyl(0.13, 0.15, 0.5, 8), MAT, [0, 0.12, 0.34], [Math.PI / 2 + 0.32, 0, 0]); // neck
    add(g, ico(0.2, 1), MAT, [0, 0.1, 0.56]);                                       // head
    for (const sx of [-1, 1]) {
      add(g, cyl(0.13, 0.13, 0.62, 8), MAT, [sx * 0.5, -0.06, -0.25], [Math.PI / 2, 0, sx * 0.14]);
    }
    for (const sx of [-1, 1]) add(g, box(0.03, 0.32, 0.24), MAT, [sx * 0.2, 0.1, -0.5], [0, 0, sx * 0.25]);
    return g;
  };

  // ---- Valiant Charger — the Aussie muscle coupe, as a flying ship --------------
  // 2-door hardtop: long bonnet, raked glass, fastback tail, quad headlights.
  // Proportions follow the real VH: width ~0.41 x length (a famously WIDE coupe).
  builders.valiant = function () {
    const g = shipGroup();

    // Long, low, WIDE body.
    add(g, box(0.64, 0.16, 1.6), MAT, [0, -0.02, 0]);

    // Long bonnet, slightly dropped toward the nose.
    add(g, box(0.56, 0.06, 0.72), MAT, [0, 0.07, 0.5], [0.05, 0, 0]);
    // Front guards/shoulders.
    for (const sx of [-1, 1]) add(g, box(0.12, 0.05, 0.44), MAT, [sx * 0.36, 0.04, 0.44]);

    // Greenhouse — the 2-door hardtop: raked windscreen, short roof, fastback glass.
    add(g, box(0.46, 0.15, 0.3), MAT, [0, 0.17, -0.05], [-0.3, 0, 0]);   // windscreen (raked back)
    add(g, box(0.5, 0.05, 0.3), MAT, [0, 0.26, -0.21]);                  // roof (short)
    add(g, box(0.46, 0.15, 0.42), MAT, [0, 0.16, -0.43], [0.4, 0, 0]);   // fastback rear glass

    // Short deck + kicked-up tail.
    add(g, box(0.52, 0.07, 0.26), MAT, [0, 0.1, -0.62]);
    add(g, box(0.54, 0.04, 0.14), MAT, [0, 0.15, -0.74]);

    // The Charger's face: quad headlights, grille, chrome bumper.
    add(g, box(0.44, 0.1, 0.05), MAT, [0, 0.04, 0.82]);
    add(g, box(0.6, 0.06, 0.04), MAT, [0, -0.07, 0.85]);
    for (const sx of [-1, 1]) {
      for (const dx of [0.13, 0.24]) {
        add(g, cyl(0.032, 0.032, 0.05, 8), MAT, [sx * dx, 0.12, 0.83], [Math.PI / 2, 0, 0]);
      }
    }

    // Wheels — low, wide stance.
    for (const sx of [-1, 1]) {
      add(g, torus(0.1, 0.022), MAT, [sx * 0.34, -0.08, 0.4], [0, Math.PI / 2, 0]);
      add(g, torus(0.1, 0.022), MAT, [sx * 0.34, -0.08, -0.5], [0, Math.PI / 2, 0]);
    }
    return g;
  };

  // ---- exhaust flame (the "blue flame" from the logo animation) -----------------
  let _glowTex = null;
  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g2 = c.getContext('2d');
    const gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(180,210,255,0.55)');
    gr.addColorStop(0.65, 'rgba(90,130,255,0.18)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  // A geomesh flame: wireframe outer cone (matches the hull language) + a small
  // additive hot core + glow. Position it at the ship's rear; update(p, dt).
  function buildFlame(hex) {
    const g = new THREE.Group();
    const blue = new THREE.Color(hex || BLUE).convertSRGBToLinear();
    const hot = new THREE.Color(0xffffff).convertSRGBToLinear();

    const outerMat = new THREE.MeshBasicMaterial({
      color: blue, wireframe: true, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const coreMat = new THREE.MeshBasicMaterial({
      color: hot, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    });

    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 7, 1), outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.z = -0.2;
    g.add(outer);

    const core = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.26, 7, 1), coreMat);
    core.rotation.x = -Math.PI / 2;
    core.position.z = -0.13;
    g.add(core);

    if (!_glowTex) _glowTex = glowTexture();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: _glowTex, color: new THREE.Color(hex || BLUE).lerp(new THREE.Color(0xffffff), 0.3).convertSRGBToLinear(),
      transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    glow.scale.set(0.22, 0.22, 1);
    g.add(glow);

    g.userData = { outer, core, glow };
    g.update = function (p) {
      const flick = 1 + 0.1 * Math.sin((performance.now() / 1000) * 24) + 0.04 * Math.sin((performance.now() / 1000) * 9);
      const k = Math.max(0.001, 0.2 + 0.8 * p) * flick;
      outer.scale.set(0.7 + 0.3 * p, k, 0.7 + 0.3 * p);
      core.scale.set(0.7 + 0.3 * p, k, 0.7 + 0.3 * p);
      outer.material.opacity = 0.16 + 0.3 * p;
      core.material.opacity = 0.2 + 0.2 * p;
      glow.material.opacity = 0.12 + 0.18 * p;
      glow.scale.setScalar((0.2 + 0.12 * p) * flick);
      g.visible = p > 0.001;
    };
    return g;
  }

  window.RobShips = {
    BLUE,
    keys: Object.keys(builders),
    order: ['enterprise', 'falcon', 'xwing', 'tie', 'stardestroyer', 'galactica', 'viper', 'borg', 'discovery', 'serenity', 'valiant'],
    build: function (key) {
      const b = builders[key];
      if (!b) return null;
      const g = b();
      // Tint this ship its own colour. The builders share template materials, so
      // clone each mesh's material and recolour it (per-ship, independent).
      const hex = SHIP_COLORS[key] || BLUE;
      const lin = new THREE.Color(hex).convertSRGBToLinear();
      g.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material = o.material.clone();
          if (o.material.color) o.material.color.copy(lin);
        }
      });
      const box3 = new THREE.Box3().setFromObject(g);
      const size = new THREE.Vector3();
      box3.getSize(size);
      g.userData.key = key;
      g.userData.color = hex;
      g.userData.extent = size;
      g.userData.length = Math.max(size.x, size.y, size.z);
      g.userData.rear = box3.min.z;
      return g;
    },
    buildFlame: buildFlame,
    color: function (key) { return SHIP_COLORS[key] || BLUE; },
  };
})();

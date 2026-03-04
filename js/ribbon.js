/*
 * Stripe hero ribbon
 * Wide petal bands that fan out from a convergence/twist point
 * Three.js r178
 */

(function () {
  var container = document.getElementById('ribbon-container');
  var renderer, scene, camera;
  var bandMeshes = [];
  var clock = new THREE.Clock();

  // --- Band definitions ---
  // Each band fans from upper area down through a convergence twist
  // spreadAngle: how far from center this band starts (radians)
  // color: hex color
  var BAND_DEFS = [
    { color: 0xb8c8ff, spreadAngle: -0.55, zOff: -0.5, width: 0.65, phase: 0.0 },   // pale blue
    { color: 0x8b6cf0, spreadAngle: -0.38, zOff: -0.35, width: 0.70, phase: 0.3 },   // purple
    { color: 0xe83aaa, spreadAngle: -0.18, zOff: -0.20, width: 0.80, phase: 0.6 },   // magenta
    { color: 0xff48a0, spreadAngle: 0.0,   zOff: -0.05, width: 0.85, phase: 0.9 },   // hot pink
    { color: 0xff7828, spreadAngle: 0.20,  zOff: 0.10,  width: 0.75, phase: 1.2 },   // orange
    { color: 0xffa818, spreadAngle: 0.38,  zOff: 0.25,  width: 0.65, phase: 1.5 },   // amber
    { color: 0xffc848, spreadAngle: 0.52,  zOff: 0.35,  width: 0.55, phase: 1.8 },   // light gold
  ];

  // convergence point - where all bands pinch together
  var CONVERGE_Y = -0.6;
  var CONVERGE_X = 0.3;

  function createBandGeometry(def, time) {
    var segsY = 200;
    var segsX = 2; // just need front face, thin
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];

    var t = time * 0.05 + def.phase;

    for (var iy = 0; iy <= segsY; iy++) {
      // normalized parameter along band length
      var v = iy / segsY;
      // map to world Y: from top (+3) to bottom (-3)
      var worldY = 3.0 - v * 6.0;

      // --- compute how spread out the band is at this Y ---
      // near convergence point, width narrows to near zero
      // above and below, it fans out
      var distFromConverge = (worldY - CONVERGE_Y);
      var spread = Math.abs(distFromConverge) * 0.8;
      spread = Math.max(spread, 0.05); // never fully zero

      // the band's center X position fans based on its angle
      var fanX = CONVERGE_X + Math.sin(def.spreadAngle) * spread * 1.2;
      // add some S-curve sway
      fanX += Math.sin(worldY * 0.8 + t * 0.3) * 0.15 * spread;

      // Z depth - bands separate in Z as they fan
      var fanZ = def.zOff * spread * 0.8;
      fanZ += Math.sin(worldY * 1.2 + t * 0.2 + def.phase) * 0.1 * spread;

      // twist angle changes along the length
      var twist = 0.0;
      if (distFromConverge > 0) {
        // above convergence: twist one way
        twist = distFromConverge * 0.5 + def.spreadAngle * 0.3;
      } else {
        // below convergence: twist the other way (creates the fold)
        twist = distFromConverge * -0.4 + def.spreadAngle * -0.3;
      }
      twist += Math.sin(t * 0.2 + v * 2.0) * 0.1;

      var cosT = Math.cos(twist);
      var sinT = Math.sin(twist);

      // actual ribbon width at this point
      var w = def.width * spread;
      w = Math.max(w, 0.02);

      for (var ix = 0; ix <= segsX; ix++) {
        var u = ix / segsX;
        var localX = (u - 0.5) * w;

        // apply twist rotation around the band's center line
        var px = fanX + localX * cosT;
        var py = worldY;
        var pz = fanZ + localX * sinT;

        positions.push(px, py, pz);
        // approximate normal (face normal pointing roughly toward camera)
        normals.push(-sinT * 0.3, 0.0, cosT);
        uvs.push(u, v);
      }
    }

    // indices
    for (var iy = 0; iy < segsY; iy++) {
      for (var ix = 0; ix < segsX; ix++) {
        var a = iy * (segsX + 1) + ix;
        var b = a + 1;
        var c = (iy + 1) * (segsX + 1) + ix;
        var d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function updateBand(mesh, def, time) {
    var geo = mesh.geometry;
    var positions = geo.attributes.position;
    var segsY = 200;
    var segsX = 2;

    var t = time * 0.05 + def.phase;

    for (var iy = 0; iy <= segsY; iy++) {
      var v = iy / segsY;
      var worldY = 3.0 - v * 6.0;

      var distFromConverge = (worldY - CONVERGE_Y);
      var spread = Math.abs(distFromConverge) * 0.8;
      spread = Math.max(spread, 0.05);

      var fanX = CONVERGE_X + Math.sin(def.spreadAngle) * spread * 1.2;
      fanX += Math.sin(worldY * 0.8 + t * 0.3) * 0.15 * spread;

      var fanZ = def.zOff * spread * 0.8;
      fanZ += Math.sin(worldY * 1.2 + t * 0.2 + def.phase) * 0.1 * spread;

      var twist = 0.0;
      if (distFromConverge > 0) {
        twist = distFromConverge * 0.5 + def.spreadAngle * 0.3;
      } else {
        twist = distFromConverge * -0.4 + def.spreadAngle * -0.3;
      }
      twist += Math.sin(t * 0.2 + v * 2.0) * 0.1;

      var cosT = Math.cos(twist);
      var sinT = Math.sin(twist);

      var w = def.width * spread;
      w = Math.max(w, 0.02);

      for (var ix = 0; ix <= segsX; ix++) {
        var u = ix / segsX;
        var localX = (u - 0.5) * w;

        var idx = iy * (segsX + 1) + ix;
        positions.setXYZ(idx,
          fanX + localX * cosT,
          worldY,
          fanZ + localX * sinT
        );
      }
    }

    positions.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0.8, 0.0, 7.0);
    camera.lookAt(0.3, -0.3, 0.0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // lighting
    var key = new THREE.DirectionalLight(0xfff5e0, 3.5);
    key.position.set(3, 4, 6);
    scene.add(key);

    var fill = new THREE.DirectionalLight(0xd0e0ff, 1.8);
    fill.position.set(-3, -1, 4);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(0, 1, -4);
    scene.add(rim);

    var bounce = new THREE.DirectionalLight(0xffe0c0, 0.8);
    bounce.position.set(1, -4, 2);
    scene.add(bounce);

    scene.add(new THREE.AmbientLight(0x605070, 0.5));

    // create bands
    for (var i = 0; i < BAND_DEFS.length; i++) {
      var def = BAND_DEFS[i];
      var geo = createBandGeometry(def, 0);

      var mat = new THREE.MeshPhysicalMaterial({
        color: def.color,
        roughness: 0.18,
        metalness: 0.02,
        clearcoat: 0.4,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide,
        flatShading: false
      });

      var mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      bandMeshes.push({ mesh: mesh, def: def });
    }

    handleResize();
    window.addEventListener('resize', handleResize);
  }

  function handleResize() {
    var w = container.offsetWidth;
    var h = container.offsetHeight;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function animate() {
    var elapsed = clock.getElapsedTime();

    for (var i = 0; i < bandMeshes.length; i++) {
      updateBand(bandMeshes[i].mesh, bandMeshes[i].def, elapsed);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  init();
  animate();
})();

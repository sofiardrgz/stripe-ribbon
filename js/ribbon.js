/*
 * Stripe-style 3D ribbon
 * Multiple flat ribbon bands swept along curve paths
 * Uses Three.js TubeGeometry + scene lighting
 */

(function () {
  var container = document.getElementById('ribbon-container');
  var renderer, scene, camera;
  var ribbons = [];
  var startTime = Date.now();

  // --- ribbon definitions ---
  // Each ribbon: color, a set of base control points, width (tube radius), phase
  var RIBBON_DEFS = [
    {
      // pale blue-white (leftmost/back)
      color: 0xb8c4ff,
      emissive: 0x1a1a3a,
      points: [
        [0.9, 2.8, -0.8], [0.4, 1.8, -0.3], [-0.2, 0.9, -0.6],
        [-0.6, 0.0, 0.2], [-0.2, -0.9, -0.4], [-0.7, -1.8, 0.1], [-1.0, -2.6, -0.3]
      ],
      radius: 0.18,
      flatScale: 3.5,
      phase: 0.0
    },
    {
      // lavender-purple
      color: 0x9474e8,
      emissive: 0x1a0a3a,
      points: [
        [1.0, 2.6, -0.4], [0.5, 1.7, 0.2], [0.0, 0.8, -0.3],
        [-0.4, -0.1, 0.5], [0.1, -1.0, -0.2], [-0.5, -1.9, 0.3], [-0.8, -2.7, -0.1]
      ],
      radius: 0.20,
      flatScale: 3.8,
      phase: 0.5
    },
    {
      // magenta
      color: 0xe838c8,
      emissive: 0x3a0a2a,
      points: [
        [1.1, 2.5, 0.0], [0.6, 1.6, 0.5], [0.1, 0.7, 0.0],
        [-0.3, -0.2, 0.6], [0.2, -1.1, 0.1], [-0.3, -2.0, 0.5], [-0.6, -2.8, 0.1]
      ],
      radius: 0.22,
      flatScale: 4.0,
      phase: 1.0
    },
    {
      // hot pink
      color: 0xff4da0,
      emissive: 0x3a0a1a,
      points: [
        [1.2, 2.4, 0.3], [0.7, 1.5, 0.7], [0.2, 0.6, 0.2],
        [-0.2, -0.3, 0.8], [0.3, -1.2, 0.3], [-0.1, -2.1, 0.7], [-0.4, -2.9, 0.3]
      ],
      radius: 0.20,
      flatScale: 3.6,
      phase: 1.5
    },
    {
      // coral/orange
      color: 0xff7a30,
      emissive: 0x3a1a0a,
      points: [
        [1.3, 2.3, 0.5], [0.8, 1.4, 0.3], [0.3, 0.5, 0.7],
        [0.0, -0.4, 0.3], [0.4, -1.3, 0.8], [0.1, -2.2, 0.4], [-0.2, -3.0, 0.6]
      ],
      radius: 0.19,
      flatScale: 3.5,
      phase: 2.0
    },
    {
      // warm amber/yellow-orange (rightmost/front)
      color: 0xffa020,
      emissive: 0x3a2a0a,
      points: [
        [1.4, 2.2, 0.7], [0.9, 1.3, 0.1], [0.4, 0.4, 0.9],
        [0.1, -0.5, 0.1], [0.5, -1.4, 0.6], [0.3, -2.3, 0.2], [0.0, -3.1, 0.8]
      ],
      radius: 0.17,
      flatScale: 3.2,
      phase: 2.5
    }
  ];

  function createCurve(basePts, time, phase) {
    var t = time * 0.08 + phase;
    var pts = [];
    for (var i = 0; i < basePts.length; i++) {
      var p = basePts[i];
      // very gentle drift on each control point
      var f = i / (basePts.length - 1);
      pts.push(new THREE.Vector3(
        p[0] + Math.sin(t * 0.7 + f * 2.0) * 0.08,
        p[1] + Math.sin(t * 0.5 + f * 1.5 + 1.0) * 0.05,
        p[2] + Math.sin(t * 0.6 + f * 2.5 + 0.5) * 0.07
      ));
    }
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  }

  function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0.5, 0.2, 5.5);
    camera.lookAt(0.1, -0.2, 0.0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- lighting setup for silk look ---

    // key light - warm, upper right
    var keyLight = new THREE.DirectionalLight(0xfff0e0, 2.5);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    // fill light - cool, left side
    var fillLight = new THREE.DirectionalLight(0xc0d0ff, 1.2);
    fillLight.position.set(-3, -1, 3);
    scene.add(fillLight);

    // back/rim light
    var rimLight = new THREE.DirectionalLight(0xffffff, 1.0);
    rimLight.position.set(0, 0, -4);
    scene.add(rimLight);

    // ambient
    var ambLight = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambLight);

    // --- create ribbon meshes ---
    for (var i = 0; i < RIBBON_DEFS.length; i++) {
      var def = RIBBON_DEFS[i];
      var curve = createCurve(def.points, 0, def.phase);

      var geo = new THREE.TubeGeometry(curve, 200, def.radius, 12, false);

      var mat = new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.emissive,
        emissiveIntensity: 0.15,
        roughness: 0.25,
        metalness: 0.1,
        side: THREE.DoubleSide
      });

      var mesh = new THREE.Mesh(geo, mat);
      // flatten the tube into a ribbon by scaling on one axis
      mesh.scale.set(1, 1, 1);

      scene.add(mesh);
      ribbons.push({ mesh: mesh, def: def, mat: mat });
    }

    // now flatten each tube to look like a flat ribbon
    // we do this by scaling the geometry cross-section
    flattenTubes();

    handleResize();
    window.addEventListener('resize', handleResize);
  }

  function flattenTubes() {
    // TubeGeometry creates round tubes. To make flat ribbons,
    // we manipulate the geometry positions to flatten them along the
    // local normal direction
    for (var r = 0; r < ribbons.length; r++) {
      var geo = ribbons[r].mesh.geometry;
      var positions = geo.attributes.position;
      var normals = geo.attributes.normal;
      var def = ribbons[r].def;
      var flatScale = def.flatScale;

      // We'll use TubeGeometry's structure:
      // it has (tubularSegments+1) rings of (radialSegments+1) vertices each
      // For each ring, flatten the cross-section

      var tubularSegs = 200;
      var radialSegs = 12;

      var curve = createCurve(def.points, 0, def.phase);
      var frames = curve.computeFrenetFrames(tubularSegs, false);

      for (var i = 0; i <= tubularSegs; i++) {
        var N = frames.normals[i];
        var B = frames.binormals[i];
        var P = curve.getPointAt(i / tubularSegs);

        for (var j = 0; j <= radialSegs; j++) {
          var idx = i * (radialSegs + 1) + j;
          var angle = (j / radialSegs) * Math.PI * 2;

          // flat ribbon: stretch along binormal, compress along normal
          var cx = Math.cos(angle) * def.radius * 0.3;  // thin
          var cy = Math.sin(angle) * def.radius * flatScale;  // wide

          var px = P.x + N.x * cx + B.x * cy;
          var py = P.y + N.y * cx + B.y * cy;
          var pz = P.z + N.z * cx + B.z * cy;

          positions.setXYZ(idx, px, py, pz);
        }
      }

      positions.needsUpdate = true;
      geo.computeVertexNormals();
    }
  }

  function updateGeometry(time) {
    for (var r = 0; r < ribbons.length; r++) {
      var ribbon = ribbons[r];
      var def = ribbon.def;
      var geo = ribbon.mesh.geometry;
      var positions = geo.attributes.position;

      var curve = createCurve(def.points, time, def.phase);
      var frames = curve.computeFrenetFrames(200, false);

      var tubularSegs = 200;
      var radialSegs = 12;

      for (var i = 0; i <= tubularSegs; i++) {
        var N = frames.normals[i];
        var B = frames.binormals[i];
        var P = curve.getPointAt(i / tubularSegs);

        for (var j = 0; j <= radialSegs; j++) {
          var idx = i * (radialSegs + 1) + j;
          var angle = (j / radialSegs) * Math.PI * 2;

          var cx = Math.cos(angle) * def.radius * 0.3;
          var cy = Math.sin(angle) * def.radius * def.flatScale;

          positions.setXYZ(idx,
            P.x + N.x * cx + B.x * cy,
            P.y + N.y * cx + B.y * cy,
            P.z + N.z * cx + B.z * cy
          );
        }
      }

      positions.needsUpdate = true;
      geo.computeVertexNormals();
    }
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
    var elapsed = (Date.now() - startTime) * 0.001;

    // update all ribbon curves slowly
    updateGeometry(elapsed);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  init();
  animate();
})();

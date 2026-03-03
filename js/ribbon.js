/*
 * Stripe hero ribbon
 * Wide flat bands swept along 3D curves with twist convergence
 * Three.js r178
 */

(function () {
  var container = document.getElementById('ribbon-container');
  var renderer, scene, camera;
  var bands = [];
  var clock = new THREE.Clock();

  // Band definitions - each is a wide flat ribbon
  // Colors sampled from Stripe's actual page
  var BANDS = [
    {
      // 0: pale blue-white (far left, behind everything)
      color: 0xc0d0ff,
      specColor: 0xffffff,
      path: [
        [-0.2, 3.2, -1.2], [-0.5, 2.0, -0.6], [-0.8, 0.8, -0.8],
        [-0.4, -0.4, -0.3], [-0.1, -1.5, -0.7], [-0.6, -2.8, -0.4], [-0.8, -3.8, -0.6]
      ],
      width: 0.7, thickness: 0.02, phase: 0.0
    },
    {
      // 1: purple/violet
      color: 0x7b5cfa,
      specColor: 0xc0b0ff,
      path: [
        [0.0, 3.0, -0.8], [-0.2, 1.9, -0.2], [-0.4, 0.7, -0.5],
        [-0.1, -0.3, 0.1], [0.1, -1.4, -0.3], [-0.2, -2.7, 0.0], [-0.5, -3.7, -0.2]
      ],
      width: 0.8, thickness: 0.02, phase: 0.4
    },
    {
      // 2: magenta/fuchsia
      color: 0xf23daa,
      specColor: 0xff80cc,
      path: [
        [0.2, 2.9, -0.4], [0.0, 1.8, 0.2], [-0.2, 0.6, -0.1],
        [0.1, -0.4, 0.5], [0.3, -1.5, 0.1], [0.0, -2.8, 0.4], [-0.3, -3.8, 0.1]
      ],
      width: 0.9, thickness: 0.02, phase: 0.8
    },
    {
      // 3: hot pink
      color: 0xff4895,
      specColor: 0xff90c0,
      path: [
        [0.4, 2.8, 0.0], [0.2, 1.7, 0.5], [0.0, 0.5, 0.2],
        [0.3, -0.5, 0.7], [0.5, -1.6, 0.3], [0.2, -2.9, 0.6], [-0.1, -3.9, 0.3]
      ],
      width: 0.85, thickness: 0.02, phase: 1.2
    },
    {
      // 4: bright orange
      color: 0xff7a20,
      specColor: 0xffb060,
      path: [
        [0.6, 2.7, 0.3], [0.4, 1.6, 0.8], [0.2, 0.4, 0.5],
        [0.5, -0.6, 0.9], [0.6, -1.7, 0.6], [0.4, -3.0, 0.8], [0.1, -4.0, 0.6]
      ],
      width: 0.8, thickness: 0.02, phase: 1.6
    },
    {
      // 5: warm amber/gold
      color: 0xffaa18,
      specColor: 0xffcc60,
      path: [
        [0.8, 2.6, 0.6], [0.6, 1.5, 0.4], [0.4, 0.3, 0.8],
        [0.7, -0.7, 0.5], [0.8, -1.8, 0.9], [0.6, -3.1, 0.5], [0.3, -4.1, 0.8]
      ],
      width: 0.7, thickness: 0.02, phase: 2.0
    }
  ];

  function getAnimatedCurve(basePts, time, phase) {
    var t = time * 0.06 + phase;
    var pts = [];
    for (var i = 0; i < basePts.length; i++) {
      var p = basePts[i];
      var f = i / (basePts.length - 1);
      pts.push(new THREE.Vector3(
        p[0] + Math.sin(t * 0.5 + f * 2.5) * 0.06,
        p[1] + Math.sin(t * 0.3 + f * 1.8 + 1.0) * 0.04,
        p[2] + Math.sin(t * 0.4 + f * 2.0 + 0.5) * 0.05
      ));
    }
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
  }

  function buildFlatRibbon(curve, width, thickness, segments, radialSegs) {
    // Create a tube then reshape cross-section to be flat (wide ribbon)
    var frames = curve.computeFrenetFrames(segments, false);
    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];

    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var P = curve.getPointAt(t);
      var N = frames.normals[i];
      var B = frames.binormals[i];

      // add twist that increases along the length
      var twistAngle = t * Math.PI * 1.5 + Math.sin(t * Math.PI * 2) * 0.5;
      var cosA = Math.cos(twistAngle);
      var sinA = Math.sin(twistAngle);

      // twisted frame
      var tN = new THREE.Vector3(
        N.x * cosA + B.x * sinA,
        N.y * cosA + B.y * sinA,
        N.z * cosA + B.z * sinA
      );
      var tB = new THREE.Vector3(
        -N.x * sinA + B.x * cosA,
        -N.y * sinA + B.y * cosA,
        -N.z * sinA + B.z * cosA
      );

      for (var j = 0; j <= radialSegs; j++) {
        var angle = (j / radialSegs) * Math.PI * 2;
        // elliptical cross-section: wide along binormal, thin along normal
        var cx = Math.cos(angle) * thickness;
        var cy = Math.sin(angle) * width;

        var px = P.x + tN.x * cx + tB.x * cy;
        var py = P.y + tN.y * cx + tB.y * cy;
        var pz = P.z + tN.z * cx + tB.z * cy;
        positions.push(px, py, pz);

        // normal points outward
        var nx = tN.x * Math.cos(angle) * width + tB.x * Math.sin(angle) * thickness;
        var ny = tN.y * Math.cos(angle) * width + tB.y * Math.sin(angle) * thickness;
        var nz = tN.z * Math.cos(angle) * width + tB.z * Math.sin(angle) * thickness;
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        normals.push(nx / len, ny / len, nz / len);

        uvs.push(j / radialSegs, t);
      }
    }

    for (var i = 0; i < segments; i++) {
      for (var j = 0; j < radialSegs; j++) {
        var a = i * (radialSegs + 1) + j;
        var b = a + 1;
        var c = (i + 1) * (radialSegs + 1) + j;
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

  function updateRibbonGeo(band, time) {
    var def = band.def;
    var curve = getAnimatedCurve(def.path, time, def.phase);
    var frames = curve.computeFrenetFrames(band.segments, false);
    var positions = band.mesh.geometry.attributes.position;
    var radialSegs = band.radialSegs;

    for (var i = 0; i <= band.segments; i++) {
      var t = i / band.segments;
      var P = curve.getPointAt(t);
      var N = frames.normals[i];
      var B = frames.binormals[i];

      var twistAngle = t * Math.PI * 1.5 + Math.sin(t * Math.PI * 2 + time * 0.04) * 0.5;
      var cosA = Math.cos(twistAngle);
      var sinA = Math.sin(twistAngle);

      var tNx = N.x * cosA + B.x * sinA;
      var tNy = N.y * cosA + B.y * sinA;
      var tNz = N.z * cosA + B.z * sinA;
      var tBx = -N.x * sinA + B.x * cosA;
      var tBy = -N.y * sinA + B.y * cosA;
      var tBz = -N.z * sinA + B.z * cosA;

      for (var j = 0; j <= radialSegs; j++) {
        var angle = (j / radialSegs) * Math.PI * 2;
        var cx = Math.cos(angle) * def.thickness;
        var cy = Math.sin(angle) * def.width;

        var idx = i * (radialSegs + 1) + j;
        positions.setXYZ(idx,
          P.x + tNx * cx + tBx * cy,
          P.y + tNy * cx + tBy * cy,
          P.z + tNz * cx + tBz * cy
        );
      }
    }
    positions.needsUpdate = true;
    band.mesh.geometry.computeVertexNormals();
  }

  function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0.6, 0.3, 6.0);
    camera.lookAt(0.1, -0.3, 0.0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // --- scene lighting ---
    // warm key light from upper right
    var key = new THREE.DirectionalLight(0xfff5e8, 3.0);
    key.position.set(4, 5, 6);
    scene.add(key);

    // cool fill from left
    var fill = new THREE.DirectionalLight(0xd0e0ff, 1.5);
    fill.position.set(-4, -2, 4);
    scene.add(fill);

    // back rim light
    var rim = new THREE.DirectionalLight(0xffffff, 1.0);
    rim.position.set(0, 2, -5);
    scene.add(rim);

    // warm bottom bounce
    var bounce = new THREE.DirectionalLight(0xffe0c0, 0.6);
    bounce.position.set(0, -5, 2);
    scene.add(bounce);

    // ambient
    scene.add(new THREE.AmbientLight(0x504868, 0.6));

    // --- create ribbon bands ---
    var tubularSegs = 250;
    var radialSegs = 16;

    for (var i = 0; i < BANDS.length; i++) {
      var def = BANDS[i];
      var curve = getAnimatedCurve(def.path, 0, def.phase);
      var geo = buildFlatRibbon(curve, def.width, def.thickness, tubularSegs, radialSegs);

      var mat = new THREE.MeshPhysicalMaterial({
        color: def.color,
        roughness: 0.2,
        metalness: 0.05,
        clearcoat: 0.3,
        clearcoatRoughness: 0.15,
        sheenColor: new THREE.Color(def.specColor),
        sheen: 0.5,
        side: THREE.DoubleSide
      });

      var mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      bands.push({ mesh: mesh, def: def, segments: tubularSegs, radialSegs: radialSegs });
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

    for (var i = 0; i < bands.length; i++) {
      updateRibbonGeo(bands[i], elapsed);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  init();
  animate();
})();

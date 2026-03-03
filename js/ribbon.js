/*
 * Stripe-style vertical ribbon wave
 * Multi-layer opaque silk bands with sheen
 * Three.js r178
 */

(function () {
  var container = document.getElementById('ribbon-container');
  var scene, camera, renderer;
  var ribbons = [];
  var startTime = Date.now();

  /*
   * Layer config — back to front
   * baseColor / highlightColor: RGB 0–1
   * xShift, yShift: lateral and vertical offset in world units
   * zDepth: depth position (negative = further back)
   * twist: how much the ribbon twists per unit height
   * phaseOffset: animation phase difference
   * widthScale, heightScale: geometry dimensions
   */
  var layers = [
    // 0: pale blue-white (far left edge, back)
    {
      baseColor: [0.72, 0.78, 0.96],
      highlightColor: [0.92, 0.95, 1.0],
      xShift: -0.35, yShift: 0.08, zDepth: -0.55,
      twist: 0.15, phaseOffset: 0.0,
      widthScale: 0.44, heightScale: 2.9
    },
    // 1: soft purple/violet
    {
      baseColor: [0.58, 0.38, 0.88],
      highlightColor: [0.80, 0.68, 1.0],
      xShift: -0.20, yShift: 0.04, zDepth: -0.42,
      twist: 0.18, phaseOffset: 0.4,
      widthScale: 0.50, heightScale: 2.9
    },
    // 2: magenta-pink (largest band)
    {
      baseColor: [0.96, 0.26, 0.62],
      highlightColor: [1.0, 0.62, 0.82],
      xShift: -0.05, yShift: 0.0, zDepth: -0.28,
      twist: 0.22, phaseOffset: 0.8,
      widthScale: 0.58, heightScale: 2.9
    },
    // 3: hot pink
    {
      baseColor: [1.0, 0.36, 0.70],
      highlightColor: [1.0, 0.70, 0.86],
      xShift: 0.07, yShift: -0.02, zDepth: -0.14,
      twist: 0.20, phaseOffset: 1.2,
      widthScale: 0.52, heightScale: 2.9
    },
    // 4: bright orange/amber (center band)
    {
      baseColor: [1.0, 0.52, 0.06],
      highlightColor: [1.0, 0.80, 0.42],
      xShift: 0.12, yShift: -0.03, zDepth: 0.0,
      twist: 0.25, phaseOffset: 1.6,
      widthScale: 0.46, heightScale: 2.9
    },
    // 5: warm peach-orange (front-right)
    {
      baseColor: [1.0, 0.66, 0.30],
      highlightColor: [1.0, 0.86, 0.62],
      xShift: 0.22, yShift: -0.05, zDepth: 0.14,
      twist: 0.20, phaseOffset: 2.0,
      widthScale: 0.42, heightScale: 2.9
    }
  ];

  // --- vertex shader ---
  var vertSrc = [
    'uniform float time;',
    'uniform float twist;',
    'uniform float phaseOffset;',
    'uniform vec2 shift;',
    '',
    'varying vec3 vWorldNormal;',
    'varying vec3 vWorldPos;',
    'varying vec2 vUv;',
    '',
    'float hash(float n) {',
    '  return fract(sin(n) * 43758.5453);',
    '}',
    '',
    'float noise3d(vec3 x) {',
    '  vec3 p = floor(x);',
    '  vec3 f = fract(x);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float n = p.x + p.y * 57.0 + 113.0 * p.z;',
    '  return mix(',
    '    mix(mix(hash(n), hash(n+1.0), f.x), mix(hash(n+57.0), hash(n+58.0), f.x), f.y),',
    '    mix(mix(hash(n+113.0), hash(n+114.0), f.x), mix(hash(n+170.0), hash(n+171.0), f.x), f.y),',
    '    f.z',
    '  );',
    '}',
    '',
    'void main() {',
    '  vUv = uv;',
    '  float t = time + phaseOffset;',
    '  float y = position.y;',
    '  float x = position.x;',
    '',
    '  // S-curve sway',
    '  float sway = sin(y * 1.8 + t * 0.3) * 0.28;',
    '  sway += sin(y * 3.2 + t * 0.2 + 1.5) * 0.12;',
    '',
    '  // twist around vertical axis',
    '  float angle = y * twist + t * 0.12;',
    '  float c = cos(angle);',
    '  float s = sin(angle);',
    '',
    '  float nx = x * c + sway;',
    '  float nz = x * s;',
    '',
    '  // organic noise',
    '  vec3 ni = vec3(x * 2.0, y * 1.5 + t * 0.08, t * 0.04);',
    '  float nv = noise3d(ni);',
    '  nx += nv * 0.05;',
    '  nz += nv * 0.03;',
    '',
    '  nx += shift.x;',
    '  float ny = y + shift.y;',
    '',
    '  vec3 deformed = vec3(nx, ny, nz);',
    '  vWorldPos = (modelMatrix * vec4(deformed, 1.0)).xyz;',
    '',
    '  // approximate normal from cross product of tangent vectors',
    '  float swayDy = cos(y * 1.8 + t * 0.3) * 0.28 * 1.8',
    '               + cos(y * 3.2 + t * 0.2 + 1.5) * 0.12 * 3.2;',
    '  vec3 tX = vec3(c, 0.0, s);',
    '  vec3 tY = normalize(vec3(-x * s * twist + swayDy, 1.0, x * c * twist));',
    '  vWorldNormal = normalize(cross(tY, tX));',
    '',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(deformed, 1.0);',
    '}'
  ].join('\n');

  // --- fragment shader: opaque silk with sheen ---
  var fragSrc = [
    'uniform vec3 baseColor;',
    'uniform vec3 highlightColor;',
    '',
    'varying vec3 vWorldNormal;',
    'varying vec3 vWorldPos;',
    'varying vec2 vUv;',
    '',
    'void main() {',
    '  vec3 N = normalize(vWorldNormal);',
    '  vec3 V = normalize(cameraPosition - vWorldPos);',
    '',
    '  // fresnel-based silk sheen',
    '  float fresnel = 1.0 - abs(dot(N, V));',
    '  fresnel = pow(fresnel, 1.8);',
    '',
    '  // soft directional light',
    '  vec3 L = normalize(vec3(0.5, 0.8, 1.0));',
    '  float diff = max(dot(N, L), 0.0);',
    '  diff = 0.55 + 0.45 * diff;',
    '',
    '  // specular for silk sheen',
    '  vec3 H = normalize(L + V);',
    '  float spec = pow(max(dot(N, H), 0.0), 40.0);',
    '',
    '  // color blend',
    '  vec3 col = mix(baseColor, highlightColor, fresnel * 0.55 + vUv.y * 0.12);',
    '  col *= diff;',
    '  col += spec * 0.3;',
    '',
    '  // subtle silk fiber lines',
    '  float fiber = sin(vUv.x * 350.0 + vUv.y * 40.0) * 0.012;',
    '  col += fiber;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3.5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.sortObjects = true;
    container.appendChild(renderer.domElement);

    for (var i = 0; i < layers.length; i++) {
      var cfg = layers[i];
      var geo = new THREE.PlaneGeometry(cfg.widthScale, cfg.heightScale, 60, 200);
      var mat = new THREE.ShaderMaterial({
        uniforms: {
          time:           { value: 0.0 },
          twist:          { value: cfg.twist },
          phaseOffset:    { value: cfg.phaseOffset },
          shift:          { value: new THREE.Vector2(cfg.xShift, cfg.yShift) },
          baseColor:      { value: new THREE.Vector3(cfg.baseColor[0], cfg.baseColor[1], cfg.baseColor[2]) },
          highlightColor: { value: new THREE.Vector3(cfg.highlightColor[0], cfg.highlightColor[1], cfg.highlightColor[2]) }
        },
        vertexShader: vertSrc,
        fragmentShader: fragSrc,
        side: THREE.DoubleSide,
        transparent: false,
        depthTest: true,
        depthWrite: true
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = cfg.zDepth;
      mesh.renderOrder = i;
      scene.add(mesh);
      ribbons.push(mesh);
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
    var elapsed = (Date.now() - startTime) * 0.001;
    var t = elapsed * 0.35; // slow

    for (var i = 0; i < ribbons.length; i++) {
      ribbons[i].material.uniforms.time.value = t;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  init();
  animate();
})();

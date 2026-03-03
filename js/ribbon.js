/*
 * Multi-layer ribbon wave animation
 * Based on RetroArch Menu Shader Pipeline
 * Ported for Three.js r178
 */

(function () {
  var scene, camera, renderer;
  var ribbons = [];
  var clock = new THREE.Clock();
  var container = document.getElementById('ribbon-container');

  // each ribbon layer: color (rgb 0-1), x/y offset, z-depth, rotation, time offset, opacity, scale
  var layers = [
    // deep blue-violet (back layer, far left sweep)
    { color: [0.38, 0.24, 0.92], xOff: -0.15, yOff: 0.1, z: -0.5, rot: -0.6, tOff: 0.0, alpha: 0.55, scaleX: 1.8, scaleY: 0.85 },
    // purple
    { color: [0.62, 0.18, 0.82], xOff: -0.05, yOff: 0.05, z: -0.4, rot: -0.52, tOff: 0.3, alpha: 0.5, scaleX: 1.7, scaleY: 0.8 },
    // magenta
    { color: [0.82, 0.12, 0.65], xOff: 0.05, yOff: 0.0, z: -0.3, rot: -0.45, tOff: 0.6, alpha: 0.55, scaleX: 1.65, scaleY: 0.78 },
    // hot pink
    { color: [1.0, 0.24, 0.67], xOff: 0.12, yOff: -0.04, z: -0.2, rot: -0.38, tOff: 0.9, alpha: 0.5, scaleX: 1.6, scaleY: 0.75 },
    // warm pink-orange
    { color: [1.0, 0.45, 0.42], xOff: 0.18, yOff: -0.06, z: -0.1, rot: -0.32, tOff: 1.2, alpha: 0.55, scaleX: 1.55, scaleY: 0.72 },
    // orange
    { color: [1.0, 0.55, 0.12], xOff: 0.25, yOff: -0.08, z: 0.0, rot: -0.25, tOff: 1.5, alpha: 0.5, scaleX: 1.5, scaleY: 0.7 },
    // bright warm orange (front)
    { color: [1.0, 0.72, 0.18], xOff: 0.30, yOff: -0.1, z: 0.1, rot: -0.2, tOff: 1.8, alpha: 0.45, scaleX: 1.45, scaleY: 0.68 },
    // light peach highlight
    { color: [1.0, 0.82, 0.55], xOff: 0.22, yOff: -0.02, z: 0.15, rot: -0.35, tOff: 2.1, alpha: 0.3, scaleX: 1.5, scaleY: 0.65 }
  ];

  var vertexShader = [
    'varying vec3 vEC;',
    'uniform float time;',
    'uniform float timeOffset;',
    'uniform float rotAngle;',
    'uniform vec2 posOffset;',
    '',
    'float iqhash(float n) {',
    '  return fract(sin(n) * 43758.5453);',
    '}',
    '',
    'float noise(vec3 x) {',
    '  vec3 p = floor(x);',
    '  vec3 f = fract(x);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float n = p.x + p.y * 57.0 + 113.0 * p.z;',
    '  return mix(mix(mix(iqhash(n), iqhash(n + 1.0), f.x),',
    '             mix(iqhash(n + 57.0), iqhash(n + 58.0), f.x), f.y),',
    '             mix(mix(iqhash(n + 113.0), iqhash(n + 114.0), f.x),',
    '             mix(iqhash(n + 170.0), iqhash(n + 171.0), f.x), f.y), f.z);',
    '}',
    '',
    'float xmb_noise2(vec3 x) {',
    '  return cos(x.z * 4.0) * cos(x.z + time / 10.0 + x.x);',
    '}',
    '',
    'void main() {',
    '  float t = time + timeOffset;',
    '  vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '  // apply rotation',
    '  float ca = cos(rotAngle);',
    '  float sa = sin(rotAngle);',
    '  vec2 rp = vec2(pos.x * ca - pos.y * sa, pos.x * sa + pos.y * ca);',
    '  rp += posOffset;',
    '  vec3 v = vec3(rp.x, 0.0, rp.y);',
    '  vec3 v2 = v;',
    '  vec3 v3 = v;',
    '  v.y = xmb_noise2(v2) / 8.0;',
    '  v3.x -= t / 5.0;',
    '  v3.x /= 4.0;',
    '  v3.z -= t / 10.0;',
    '  v3.y -= t / 100.0;',
    '  v.z -= noise(v3 * 7.0) / 15.0;',
    '  v.y -= noise(v3 * 7.0) / 15.0 + cos(v.x * 2.0 - t / 2.0) / 5.0 - 0.3;',
    '  vEC = v;',
    '  gl_Position = vec4(v, 1.0);',
    '}'
  ].join('\n');

  var fragmentShader = [
    'uniform float time;',
    'uniform float timeOffset;',
    'uniform vec3 ribbonColor;',
    'uniform float ribbonAlpha;',
    'varying vec3 vEC;',
    '',
    'void main() {',
    '  const vec3 up = vec3(0.0, 0.0, 1.0);',
    '  vec3 x = dFdx(vEC);',
    '  vec3 y = dFdy(vEC);',
    '  vec3 normal = normalize(cross(x, y));',
    '  float c = 1.0 - dot(normal, up);',
    '  c = (1.0 - cos(c * c)) / 3.0;',
    '  // brighten the ribbon and add color',
    '  float intensity = c * 2.5;',
    '  // mix base color with white highlights',
    '  vec3 col = mix(ribbonColor, vec3(1.0), intensity * 0.3);',
    '  gl_FragColor = vec4(col, intensity * ribbonAlpha);',
    '}'
  ].join('\n');

  function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000);
    camera.position.z = 2;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // create each ribbon layer
    for (var i = 0; i < layers.length; i++) {
      var cfg = layers[i];
      var geo = new THREE.PlaneGeometry(1, 1, 150, 150);
      var mat = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 1.0 },
          timeOffset: { value: cfg.tOff },
          rotAngle: { value: cfg.rot },
          posOffset: { value: new THREE.Vector2(cfg.xOff, cfg.yOff) },
          ribbonColor: { value: new THREE.Vector3(cfg.color[0], cfg.color[1], cfg.color[2]) },
          ribbonAlpha: { value: cfg.alpha }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        extensions: { derivatives: true },
        side: THREE.DoubleSide,
        transparent: true,
        depthTest: false
      });

      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = cfg.z;
      mesh.userData = { scaleX: cfg.scaleX, scaleY: cfg.scaleY };
      scene.add(mesh);
      ribbons.push(mesh);
    }

    onResize();
    window.addEventListener('resize', onResize);
  }

  function onResize() {
    var w = container.offsetWidth;
    var h = container.offsetHeight;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    for (var i = 0; i < ribbons.length; i++) {
      var r = ribbons[i];
      r.scale.set(camera.aspect * r.userData.scaleX, r.userData.scaleY, 1);
    }
  }

  function animate() {
    var elapsed = clock.getElapsedTime();
    for (var i = 0; i < ribbons.length; i++) {
      ribbons[i].material.uniforms.time.value = elapsed;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  init();
  animate();
})();

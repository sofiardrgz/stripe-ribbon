// stripe hero wave — three.js r178

(function () {

  const canvas = document.getElementById('wave-canvas');
  if (!canvas) return;

  // ── renderer ────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);

  // ── scene / camera ───────────────────────────────────────────────────────
  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ── geometry ─────────────────────────────────────────────────────────────
  // high-res plane — same density Stripe uses
  const geometry = new THREE.PlaneGeometry(2, 2, 320, 160);

  // ── shaders ──────────────────────────────────────────────────────────────

  const vertexShader = /* glsl */`
    uniform float  u_time;
    uniform vec2   u_resolution;
    uniform float  u_amp;
    uniform float  u_freq;
    uniform float  u_speed;
    uniform float  u_seed;

    varying vec2   v_uv;
    varying float  v_noise;

    // Ian McEwan / Ashima Arts — MIT licence
    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
    vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

    float snoise(vec3 v){
      const vec2 C = vec2(1./6., 1./3.);
      const vec4 D = vec4(0., .5, 1., 2.);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g  = step(x0.yzx, x0.xyz);
      vec3 l  = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0., i1.z, i2.z, 1.))
        + i.y + vec4(0., i1.y, i2.y, 1.))
        + i.x + vec4(0., i1.x, i2.x, 1.));
      float n_ = .142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j   = p - 49. * floor(p * ns.z * ns.z);
      vec4 x_  = floor(j * ns.z);
      vec4 y_  = floor(j - 7. * x_);
      vec4 x   = x_ * ns.x + ns.yyyy;
      vec4 y   = y_ * ns.x + ns.yyyy;
      vec4 h   = 1. - abs(x) - abs(y);
      vec4 b0  = vec4(x.xy, y.xy);
      vec4 b1  = vec4(x.zw, y.zw);
      vec4 s0  = floor(b0) * 2. + 1.;
      vec4 s1  = floor(b1) * 2. + 1.;
      vec4 sh  = -step(h, vec4(0.));
      vec4 a0  = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1  = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0  = vec3(a0.xy, h.x);
      vec3 p1  = vec3(a0.zw, h.y);
      vec3 p2  = vec3(a1.xy, h.z);
      vec3 p3  = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.);
      m = m * m;
      return 42. * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }

    void main() {
      v_uv = uv;

      vec3 pos = position;

      float t = u_time * u_speed;

      // primary wave — drives the big ribbon shape
      float n1 = snoise(vec3(
        uv.x * u_freq * 1.8 + t * 0.4,
        uv.y * u_freq * 3.2,
        t * 0.15 + u_seed
      ));

      // secondary wave — adds the undulating detail
      float n2 = snoise(vec3(
        uv.x * u_freq * 3.5 + t * 0.6,
        uv.y * u_freq * 5.0,
        t * 0.22 + u_seed + 4.3
      ));

      float n3 = snoise(vec3(
        uv.x * u_freq * 6.0 + t * 0.9,
        uv.y * u_freq * 2.5,
        t * 0.18 + u_seed + 8.7
      ));

      float noise = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

      // taper at top and bottom edges — ribbon doesn't touch canvas edges
      float edge = 1.0 - pow(abs(uv.y * 2.0 - 1.0), 2.2);
      noise *= edge;

      // diagonal ribbon tilt — matches Stripe's orientation
      float tilt = (uv.x - 0.5) * 0.35;

      pos.z = noise * u_amp + tilt;
      v_noise = noise;

      gl_Position = vec4(pos.xy, 0.0, 1.0);
    }
  `;

  const fragmentShader = /* glsl */`
    uniform vec3  u_color0;
    uniform vec3  u_color1;
    uniform vec3  u_color2;
    uniform vec3  u_color3;
    uniform float u_time;

    varying vec2  v_uv;
    varying float v_noise;

    vec3 palette(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3) {
      // four-stop gradient across the ribbon
      if (t < 0.333) return mix(c0, c1, t / 0.333);
      if (t < 0.666) return mix(c1, c2, (t - 0.333) / 0.333);
      return mix(c2, c3, (t - 0.666) / 0.334);
    }

    void main() {
      // colour driven by x position + animated noise offset
      float t = clamp(v_uv.x + v_noise * 0.4 + sin(u_time * 0.3) * 0.06, 0.0, 1.0);

      vec3 col = palette(t, u_color0, u_color1, u_color2, u_color3);

      // subtle brightness variation across y
      float bright = 0.9 + 0.1 * (1.0 - abs(v_uv.y * 2.0 - 1.0));
      col *= bright;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // ── uniforms ─────────────────────────────────────────────────────────────

  // Stripe orange→magenta palette (sampled from stripe.com)
  function hex(h) {
    return new THREE.Color(h);
  }

  const uniforms = {
    u_time       : { value: 0.0 },
    u_resolution : { value: new THREE.Vector2() },
    u_amp        : { value: 0.18 },    // wave height  — tweak to taste
    u_freq       : { value: 2.4 },     // wave frequency
    u_speed      : { value: 0.28 },    // animation speed
    u_seed       : { value: 5.0 },
    u_color0     : { value: hex('#ff6a00') },   // deep orange
    u_color1     : { value: hex('#ff3cac') },   // hot pink
    u_color2     : { value: hex('#c026d3') },   // magenta/fuchsia
    u_color3     : { value: hex('#f97316') },   // warm orange (loops back)
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // ── sizing ───────────────────────────────────────────────────────────────

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.u_resolution.value.set(w, h);
  }

  window.addEventListener('resize', resize);
  resize();

  // ── animation loop ───────────────────────────────────────────────────────

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    uniforms.u_time.value = clock.getElapsedTime();
    renderer.render(scene, camera);
  }

  animate();

})();

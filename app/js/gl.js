// The sky behind the Taskmaster house: one full-screen WebGL2 fragment shader.
// Stars, drifting cloud, chimney smoke, a lamp that follows the pointer, and
// film grain. Rendered at reduced resolution and capped at 30fps; it pauses
// when the tab is hidden and renders a single still frame for reduced motion.

const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uTime, uScroll, uSteam, uNeon;
uniform vec2 uMouse, uChimney;
uniform vec3 uTop, uBot, uGlow, uLamp;

float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= .5; } return v; }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x*asp, uv.y);
  float t = uTime;

  // Sky gradient, dimming as the page scrolls indoors.
  vec3 col = mix(uBot, uTop, pow(uv.y, .85));

  // Horizon glow (steam-lit for the museum, neon for the diner).
  float hz = exp(-pow((uv.y-.22)*5.5, 2.));
  col += uGlow * hz * (.35 + .15*sin(t*.6)) ;
  col += uNeon * vec3(1., .2, .55) * exp(-pow((uv.y-.16)*14., 2.)) * (.55 + .45*step(.08, fract(sin(floor(t*3.))*43758.)));

  // Stars.
  vec2 g = p*vec2(90., 90.);
  vec2 cell = floor(g);
  float r = h21(cell);
  vec2 sp = fract(g) - .5 - (vec2(h21(cell+3.1), h21(cell+7.7))-.5)*.6;
  float star = smoothstep(.07, 0., length(sp)) * step(.965, r) * smoothstep(.25, .75, uv.y);
  star *= .55 + .45*sin(t*(1.+r*3.) + r*40.);
  col += vec3(1., .95, .85) * star * (1.-uScroll*.7);

  // Moon.
  vec2 mpos = asp < 1. ? vec2(asp*.56, .95) : vec2(asp*.82, .8);
  float md = length(p - mpos) * (asp < 1. ? 1.35 : 1.);
  col += vec3(1., .93, .78) * (smoothstep(.052, .048, md)*.9 + exp(-md*9.)*.22) * (1.-uScroll);

  // Drifting cloud / steam banks.
  float c = fbm(p*vec2(1.6, 3.) + vec2(t*.018, 0.));
  c = smoothstep(.5, .85, c) * smoothstep(.15, .7, uv.y);
  col = mix(col, uGlow*.55 + vec3(.08), c*.35*uSteam);

  // Chimney smoke: a column that widens, drifts and fades as it rises.
  vec2 q = p - vec2(uChimney.x*asp, uChimney.y);
  float rise = max(q.y, 0.);
  float drift = rise*rise*.3 + sin(rise*7. - t*.9)*.015*rise;
  float w = .01 + rise*.075;
  float n = fbm(vec2(q.x*9., q.y*5. - t*.55));
  float plume = exp(-pow((q.x - drift)/w, 2.)) * smoothstep(0., .02, q.y) * exp(-rise*3.4);
  plume *= smoothstep(.25, .8, n + .25);
  col = mix(col, vec3(.5, .49, .5) + uGlow*.12, clamp(plume*uSteam*.8, 0., .6));

  // Lamp that follows the pointer.
  vec2 m = vec2(uMouse.x*asp, uMouse.y);
  float ld = length(p - m);
  col += uLamp * (exp(-ld*ld*9.)*.16 + exp(-ld*ld*60.)*.07);

  // Indoors: lower the lights as you scroll past the house.
  col *= mix(1., .55, uScroll);

  // Vignette + grain.
  float v = smoothstep(1.25, .35, length((uv-.5)*vec2(asp*.9, 1.)));
  col *= mix(.55, 1., v);
  col += (h21(gl_FragCoord.xy + fract(t)*100.) - .5) * .035;

  o = vec4(col, 1.);
}`;

const THEMES = {
  greek: { top: [0.035, 0.05, 0.1], bot: [0.13, 0.12, 0.16], glow: [0.95, 0.62, 0.3], lamp: [1, 0.78, 0.45], steam: 1, neon: 0 },
  diner: { top: [0.06, 0.03, 0.1], bot: [0.24, 0.07, 0.2], glow: [0.2, 0.8, 0.78], lamp: [1, 0.55, 0.75], steam: 0.55, neon: 0.5 },
};

export function startSky(canvas, { reducedMotion }) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) return null;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ["uRes", "uTime", "uScroll", "uSteam", "uNeon", "uMouse", "uChimney", "uTop", "uBot", "uGlow", "uLamp"])
    U[n] = gl.getUniformLocation(prog, n);

  // Current and target values; themes and the pointer ease rather than snap.
  const cur = { ...structuredClone(THEMES.greek), mx: 0.5, my: 0.6, scroll: 0 };
  let target = structuredClone(THEMES.greek);
  let mouse = { x: 0.5, y: 0.6 };
  let chimney = { x: -1, y: -1 };
  let scroll = 0;

  const SCALE = 0.5;
  function resize() {
    const w = Math.min(innerWidth, 1600), h = Math.min(innerHeight, 1000);
    canvas.width = Math.max(1, Math.round(w * SCALE));
    canvas.height = Math.max(1, Math.round(h * SCALE));
    gl.viewport(0, 0, canvas.width, canvas.height);
    frame(performance.now(), true);
  }

  const lerp = (a, b, k) => a + (b - a) * k;
  const lerp3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
  let last = 0, raf = 0, running = false;

  function frame(now, force) {
    if (!force && now - last < 33) { raf = requestAnimationFrame(frame); return; }
    const k = force ? 1 : 0.06;
    last = now;
    for (const key of ["top", "bot", "glow", "lamp"]) cur[key] = lerp3(cur[key], target[key], k);
    cur.steam = lerp(cur.steam, target.steam, k);
    cur.neon = lerp(cur.neon, target.neon, k);
    cur.mx = lerp(cur.mx, mouse.x, force ? 1 : 0.08);
    cur.my = lerp(cur.my, mouse.y, force ? 1 : 0.08);
    cur.scroll = lerp(cur.scroll, scroll, force ? 1 : 0.15);

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, reducedMotion ? 12 : now / 1000);
    gl.uniform1f(U.uScroll, cur.scroll);
    gl.uniform1f(U.uSteam, cur.steam);
    gl.uniform1f(U.uNeon, cur.neon);
    gl.uniform2f(U.uMouse, cur.mx, cur.my);
    gl.uniform2f(U.uChimney, chimney.x, chimney.y);
    gl.uniform3fv(U.uTop, cur.top);
    gl.uniform3fv(U.uBot, cur.bot);
    gl.uniform3fv(U.uGlow, cur.glow);
    gl.uniform3fv(U.uLamp, cur.lamp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (running) raf = requestAnimationFrame(frame);
  }

  function play() {
    if (running || reducedMotion || document.hidden) return;
    running = true; raf = requestAnimationFrame(frame);
  }
  function pause() { running = false; cancelAnimationFrame(raf); }
  const still = () => reducedMotion && frame(performance.now(), true);

  addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
  addEventListener("pointermove", (e) => {
    mouse = { x: e.clientX / innerWidth, y: 1 - e.clientY / innerHeight };
  }, { passive: true });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); pause(); });
  canvas.addEventListener("webglcontextrestored", () => location.reload());

  resize();
  play();

  // Once the house has scrolled away the sky is just a dim backdrop, so stop
  // drawing it until it comes back (or the theme changes).
  let idle = 0;
  const settle = () => {
    clearTimeout(idle);
    if (scroll >= 1) idle = setTimeout(pause, 1200); else play();
  };

  return {
    setTheme(name) { target = structuredClone(THEMES[name] || THEMES.greek); play(); settle(); still(); },
    setScroll(v) { scroll = v; settle(); still(); },
    /** Chimney top in viewport CSS pixels. */
    setChimney(x, y) {
      chimney = { x: x / innerWidth, y: 1 - y / innerHeight };
      if (reducedMotion) still();
    },
  };
}

/* Lava hero: a million dots of fixed colour, sampled from the stitched patterns, carried by rivers of different speeds; dots leave downstream and new dots enter upstream. Raw WebGL, no library. */
(function(){
  'use strict';
  if(window.__lavaFlow) return; window.__lavaFlow = true;
  function start(hero){
  var canvas = hero.querySelector('canvas.flow');
  var srcs = [];
  try{ srcs = JSON.parse(hero.getAttribute('data-patterns') || '[]'); }catch(e){ srcs = []; }
  if(!canvas || srcs.length < 6) return;
  var RM = false;
  try{ RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  var gl = null;
  try{ gl = canvas.getContext('webgl', { antialias:false, alpha:false, preserveDrawingBuffer:true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer:true }); }catch(e){ gl = null; }
  if(!gl) return;
  if(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 2) return;
  var NOISE = [
    'vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }',
    'vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }',
    'vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }',
    'float snoise(vec2 v){',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
    '  vec2 i = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;',
    '  i = mod289(i);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);',
    '  m = m*m; m = m*m;',
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);',
    '  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}'
  ].join('\n');
  var PACK = [
    'vec4 pack2(vec2 c){ vec2 x = floor(clamp(c, 0.0, 0.9998) * 65535.0 + 0.5); vec2 hi = floor(x / 256.0); vec2 lo = x - hi * 256.0; return vec4(hi.x, lo.x, hi.y, lo.y) / 255.0; }',
    'vec2 unpack2(vec4 p){ vec4 b = floor(p * 255.0 + 0.5); return vec2(b.x * 256.0 + b.y, b.z * 256.0 + b.w) / 65535.0; }',
    'vec3 hash3(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }'
  ].join('\n');
  var VS = 'attribute vec2 p; varying vec2 v; void main(){ v = p*0.5+0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  var VEL = [
    'precision highp float;',
    'uniform float uT; uniform float uAspect; uniform float uK; uniform float uVmax; uniform vec2 uBase;',
    'uniform vec2 uStirP; uniform vec2 uStirD; uniform float uStirS; uniform float uStirR;',
    /* the pointer as a finger in the lava: a dipole, divergence-free, pushes along the stroke with a return flow around it */
    'vec2 stir(vec2 q){ vec2 r = q - uStirP; float R2 = uStirR*uStirR; float g = exp(-dot(r,r)/R2); vec2 n = vec2(-uStirD.y, uStirD.x);',
    '  vec2 gradPsi = uStirS * (n * g + dot(r, n) * g * (-2.0*r/R2));',
    '  return vec2(gradPsi.y, -gradPsi.x); }',
    'varying vec2 v;',
    NOISE,
    'float psi(vec2 q, float t){',
    '  float s = 0.0;',
    '  for(int k=0;k<3;k++){',
    '    float fk = float(k);',
    '    float ang = fk*2.094 + t*0.012*(1.0 + 0.35*fk) + snoise(vec2(fk*3.7, t*0.007))*1.3;',
    '    vec2 d = vec2(cos(ang), sin(ang)); vec2 n = vec2(-d.y, d.x);',
    '    float W = 0.5 + 0.2*fk;',
    '    float c = 0.35*sin(t*0.009*(1.0 + 0.4*fk) + fk*2.1) + 0.3;',
    '    float across = dot(q, n) - c + 0.05*snoise(vec2(dot(q, d)*0.8 + fk*7.0, t*0.01));',
    '    s += (0.010 + 0.003*fk) * W * smoothstep(-1.0, 1.0, across / W);',
    '  }',
    '  s += 0.001 * snoise(q*1.2 + vec2(t*0.015, -t*0.01));',
    '  s += dot(q, vec2(-uBase.y, uBase.x));',
    '  return s;',
    '}',
    'void main(){',
    '  vec2 q = v * vec2(uAspect, 1.0) * uK;',
    '  float e = 0.003;',
    '  vec2 vel = vec2((psi(q + vec2(0.0, e), uT) - psi(q - vec2(0.0, e), uT)) / (2.0*e), -(psi(q + vec2(e, 0.0), uT) - psi(q - vec2(e, 0.0), uT)) / (2.0*e));',
    '  vel += stir(q);',
    '  gl_FragColor = vec4(clamp(vel / uVmax, -1.0, 1.0) * 0.5 + 0.5, 0.0, 1.0);',
    '}'
  ].join('\n');
  var STEP = [
    'uniform sampler2D uPos; uniform sampler2D uV; uniform float uDt; uniform float uVmax; uniform float uInit; uniform float uFrame; uniform vec2 uExt;',
    'varying vec2 v;',
    PACK,
    'vec2 velAt(vec2 p){ return (texture2D(uV, p / uExt).rg * 2.0 - 1.0) * uVmax; }',
    'vec2 initPos(){ vec3 r = hash3(v*1000.0 + 0.5); return vec2(r.x, r.y) * 0.9998 * uExt; }',
    'vec2 moveDot(out float changed){',
    '  changed = 0.0;',
    '  vec2 pn = unpack2(texture2D(uPos, v));',
    '  bool parked = pn.y > 0.99995;',
    '  vec2 p = pn * uExt;',
    '  vec2 np = p + velAt(p) * uDt;',
    '  bool outside = parked || np.x < 0.0 || np.y < 0.0 || np.x > uExt.x || np.y > uExt.y;',
    '  if(!outside) return np;',
    '  for(int k=0;k<2;k++){',
    '    vec3 r = hash3(v*1000.0 + vec2(uFrame*0.37 + float(k)*11.1, uFrame*0.11));',
    '    float edge = floor(r.x*4.0);',
    '    vec2 cand; vec2 nrm;',
    '    if(edge < 1.0){ cand = vec2(0.001, r.y)*uExt; nrm = vec2(1.0, 0.0); }',
    '    else if(edge < 2.0){ cand = vec2(0.999, r.y)*uExt; nrm = vec2(-1.0, 0.0); }',
    '    else if(edge < 3.0){ cand = vec2(r.y, 0.001)*uExt; nrm = vec2(0.0, 1.0); }',
    '    else { cand = vec2(r.y, 0.999)*uExt; nrm = vec2(0.0, -1.0); }',
    '    float inward = dot(velAt(cand), nrm);',
    '    if(inward > 0.0 && r.z * uVmax * 0.5 < inward){ changed = 1.0; return cand; }',
    '  }',
    '  return vec2(0.0, -1.0);',
    '}'
  ].join('\n');
  var POS = [
    'precision highp float;',
    STEP,
    'void main(){',
    '  if(uInit > 0.5){ gl_FragColor = pack2(initPos() / uExt); return; }',
    '  float ch; vec2 np = moveDot(ch);',
    '  if(np.y < 0.0){ gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); return; }',
    '  gl_FragColor = pack2(np / uExt);',
    '}'
  ].join('\n');
  var COL = [
    'precision highp float;',
    STEP,
    'uniform sampler2D uCol; uniform sampler2D uM; uniform vec2 uInvW; uniform vec2 uDrift; uniform float uJit;',
    'vec3 world(vec2 q){ return texture2D(uM, fract((q + uDrift) * uInvW)).rgb; }',
    'void main(){',
    '  if(uInit > 0.5){ gl_FragColor = vec4(world(initPos()), 1.0); return; }',
    '  vec3 old = texture2D(uCol, v).rgb;',
    '  float ch; vec2 np = moveDot(ch);',
    '  if(ch > 0.5){ vec2 jit = (hash3(v*531.0 + vec2(uFrame*0.13, 7.7)).xy - 0.5) * uJit; gl_FragColor = vec4(world(np + jit), 1.0); return; }',
    '  gl_FragColor = vec4(old, 1.0);',
    '}'
  ].join('\n');
  var DVS = [
    'attribute vec2 a; uniform sampler2D uPos; uniform sampler2D uCol; uniform float uPt; varying vec3 vc;',
    PACK,
    'void main(){',
    '  vec2 p = unpack2(texture2D(uPos, a)); vc = texture2D(uCol, a).rgb;',
    '  if(p.y > 0.99995){ gl_Position = vec4(2.0, 2.0, 0.0, 1.0); gl_PointSize = 0.0; return; }',
    '  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = uPt;',
    '}'
  ].join('\n');
  var DFS = 'precision mediump float; varying vec3 vc; void main(){ gl_FragColor = vec4(vc, 1.0); }';
  function sh(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
  function mkProg(vsSrc, fsSrc, attr){
    var a = sh(gl.VERTEX_SHADER, vsSrc), b = sh(gl.FRAGMENT_SHADER, fsSrc); if(!a || !b) return null;
    var p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    var u = {}; ['uPos','uCol','uV','uM','uT','uDt','uAspect','uK','uVmax','uInit','uFrame','uExt','uInvW','uDrift','uBase','uPt','uJit','uStirP','uStirD','uStirS','uStirR'].forEach(function(n){ u[n] = gl.getUniformLocation(p, n); });
    return { p:p, u:u, a:gl.getAttribLocation(p, attr) };
  }
  var velP = mkProg(VS, VEL, 'p'), posP = mkProg(VS, POS, 'p'), colP = mkProg(VS, COL, 'p'), dotP = mkProg(DVS, DFS, 'a');
  if(!velP || !posP || !colP || !dotP) return;
  var quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  function useQuad(prog){ gl.useProgram(prog.p); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(prog.a); gl.vertexAttribPointer(prog.a, 2, gl.FLOAT, false, 0, 0); }
  function texParams(filter){
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  }
  function mkTarget(w, h, filter){
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); texParams(filter);
    var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t:t, f:f, w:w, h:h };
  }
  function kill(tg){ if(tg){ gl.deleteFramebuffer(tg.f); gl.deleteTexture(tg.t); } }
  var T = 1024, F = 160, COLS = 3, ROWS = 2;
  var WM = COLS*T - (COLS-1)*F, HM = ROWS*T - (ROWS-1)*F, PW = WM - F, PH = HM - F;
  var mosaicTex = null, ready = false;
  function ramp(ctx, w, h, horizontal, from, to){
    var g = horizontal ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
    var k = Math.min(1, F / (horizontal ? w : h));
    g.addColorStop(0, 'rgba(0,0,0,' + from + ')'); g.addColorStop(k, 'rgba(0,0,0,' + to + ')'); g.addColorStop(1, 'rgba(0,0,0,' + to + ')');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  function buildWorld(imgs){
    var mo = document.createElement('canvas'); mo.width = WM; mo.height = HM; var mc = mo.getContext('2d');
    for(var r=0;r<ROWS;r++){ for(var c=0;c<COLS;c++){
      var off = document.createElement('canvas'); off.width = T; off.height = T; var oc = off.getContext('2d');
      oc.drawImage(imgs[r*COLS + c], 0, 0, T, T);
      if(c > 0) ramp(oc, T, T, true, 0, 1);
      if(r > 0) ramp(oc, T, T, false, 0, 1);
      mc.drawImage(off, c*(T - F), r*(T - F));
    } }
    var a = document.createElement('canvas'); a.width = PW; a.height = HM; var ac = a.getContext('2d');
    ac.drawImage(mo, 0, 0);
    var sx = document.createElement('canvas'); sx.width = F; sx.height = HM; var sc = sx.getContext('2d');
    sc.drawImage(mo, WM - F, 0, F, HM, 0, 0, F, HM); ramp(sc, F, HM, true, 1, 0); ac.drawImage(sx, 0, 0);
    var b = document.createElement('canvas'); b.width = PW; b.height = PH; var bc = b.getContext('2d');
    bc.drawImage(a, 0, 0);
    var sy = document.createElement('canvas'); sy.width = PW; sy.height = F; var yc = sy.getContext('2d');
    yc.drawImage(a, 0, HM - F, PW, F, 0, 0, PW, F); ramp(yc, PW, F, false, 1, 0); bc.drawImage(sy, 0, 0);
    var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, b); texParams(gl.LINEAR);
    mosaicTex = t; ready = true;
    hero.classList.add('gl-on'); resize();
  }
  var imgs = [], loaded = 0;
  srcs.forEach(function(src, i){ var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function(){ imgs[i] = im; loaded++; if(loaded === srcs.length) buildWorld(imgs); }; im.src = src; });
  var K = 0.6, VMAX = 0.25, INVW = [PH / PW, 1.0], JIT = 0.006, STIR = 0.14, STIR_R = 0.085, STIR_DECAY = 0.6;
  /* pointer: position in world units, stroke direction, strength from speed, fading after the pointer stops */
  var stir = { x:-10, y:-10, dx:1, dy:0, s:0 }, lastP = null;
  function toWorld(e){ var r = canvas.getBoundingClientRect(); return { x:(e.clientX - r.left)/r.width * (r.width/r.height) * K, y:(1 - (e.clientY - r.top)/r.height) * K, t:performance.now() }; }
  hero.addEventListener('pointermove', function(e){
    var p = toWorld(e);
    if(lastP){ var dtp = Math.max(0.004, (p.t - lastP.t)/1000), vx = (p.x - lastP.x)/dtp, vy = (p.y - lastP.y)/dtp, sp = Math.sqrt(vx*vx + vy*vy);
      if(sp > 0.0005){ stir.dx = vx/sp; stir.dy = vy/sp; stir.s = Math.min(STIR, Math.max(stir.s, sp*0.85)); } }
    stir.x = p.x; stir.y = p.y; lastP = p;
  }, { passive:true });
  hero.addEventListener('pointerleave', function(){ lastP = null; });
  var S = 0, idxBuf = null, posA = null, posB = null, colA = null, colB = null, velT = null, init = true, tt = Math.random()*6000.0, frame = 0, drift = [Math.random()*1.5, Math.random()], PT = 2.0;
  function mkDots(size){
    S = size; var n = S*S, arr = new Float32Array(n*2), k = 0;
    for(var j=0;j<S;j++){ for(var i=0;i<S;i++){ arr[k++] = (i + 0.5)/S; arr[k++] = (j + 0.5)/S; } }
    if(idxBuf) gl.deleteBuffer(idxBuf);
    idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    kill(posA); kill(posB); kill(colA); kill(colB);
    posA = mkTarget(S, S, gl.NEAREST); posB = mkTarget(S, S, gl.NEAREST); colA = mkTarget(S, S, gl.NEAREST); colB = mkTarget(S, S, gl.NEAREST);
  }
  function resize(){
    var w = canvas.clientWidth, h = canvas.clientHeight; if(!w || !h) return;
    var small = w < 700;
    var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.0 : 1.25);
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    var size = small ? 512 : 1024; if(size !== S) mkDots(size);
    kill(velT); velT = mkTarget(Math.max(2, Math.round(canvas.width/8)), Math.max(2, Math.round(canvas.height/8)), gl.LINEAR);
    init = true;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.91, 0.38, 0.23, 1.0); gl.clear(gl.COLOR_BUFFER_BIT);
    if(RM && ready) render(0);
  }
  function render(dt){
    if(!ready || !posA) return;
    dt = Math.min(dt, 0.05); tt += dt; frame++;
    var bx = Math.cos(tt*0.01 + 1.0)*0.009, by = Math.sin(tt*0.013)*0.009;
    drift[0] -= bx*dt; drift[1] -= by*dt;
    var aspect = canvas.width / canvas.height, ext = [aspect*K, K];
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velT.f); gl.viewport(0, 0, velT.w, velT.h);
    useQuad(velP);
    gl.uniform1f(velP.u.uT, tt); gl.uniform1f(velP.u.uAspect, aspect); gl.uniform1f(velP.u.uK, K); gl.uniform1f(velP.u.uVmax, VMAX); gl.uniform2f(velP.u.uBase, bx, by);
    stir.s *= Math.exp(-dt/STIR_DECAY); gl.uniform2f(velP.u.uStirP, stir.x, stir.y); gl.uniform2f(velP.u.uStirD, stir.dx, stir.dy); gl.uniform1f(velP.u.uStirS, stir.s); gl.uniform1f(velP.u.uStirR, STIR_R);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, colB.f); gl.viewport(0, 0, S, S);
    useQuad(colP);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, posA.t);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, velT.t);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, colA.t);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, mosaicTex);
    gl.uniform1i(colP.u.uPos, 0); gl.uniform1i(colP.u.uV, 1); gl.uniform1i(colP.u.uCol, 2); gl.uniform1i(colP.u.uM, 3);
    gl.uniform1f(colP.u.uDt, dt); gl.uniform1f(colP.u.uVmax, VMAX); gl.uniform1f(colP.u.uInit, init ? 1.0 : 0.0); gl.uniform1f(colP.u.uFrame, frame);
    gl.uniform2f(colP.u.uExt, ext[0], ext[1]); gl.uniform2f(colP.u.uInvW, INVW[0], INVW[1]); gl.uniform2f(colP.u.uDrift, drift[0], drift[1]); gl.uniform1f(colP.u.uJit, JIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, posB.f); gl.viewport(0, 0, S, S);
    useQuad(posP);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, posA.t);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, velT.t);
    gl.uniform1i(posP.u.uPos, 0); gl.uniform1i(posP.u.uV, 1);
    gl.uniform1f(posP.u.uDt, dt); gl.uniform1f(posP.u.uVmax, VMAX); gl.uniform1f(posP.u.uInit, init ? 1.0 : 0.0); gl.uniform1f(posP.u.uFrame, frame);
    gl.uniform2f(posP.u.uExt, ext[0], ext[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    init = false;
    var s1 = posA; posA = posB; posB = s1; var s2 = colA; colA = colB; colB = s2;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(dotP.p); gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf); gl.enableVertexAttribArray(dotP.a); gl.vertexAttribPointer(dotP.a, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, posA.t);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, colA.t);
    gl.uniform1i(dotP.u.uPos, 0); gl.uniform1i(dotP.u.uCol, 2); gl.uniform1f(dotP.u.uPt, PT);
    gl.drawArrays(gl.POINTS, 0, S*S);
  }
  var active = true;
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){ entries.forEach(function(e){ active = e.isIntersecting; }); }, { threshold: 0 });
    io.observe(canvas);
  }
  var last = performance.now();
  function loop(now){
    requestAnimationFrame(loop);
    var dt = (now - last)/1000; last = now;
    if(RM || !active || document.hidden) return;
    render(dt);
  }
  window.addEventListener('resize', resize);
  resize();
  if(!RM) requestAnimationFrame(loop);
  }
  document.querySelectorAll('[data-lava-flow]').forEach(start);
})();

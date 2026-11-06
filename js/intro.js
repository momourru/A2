/* =========================================================
   INTRO · el giro de A2
   Carga:  el logo se arma como un plano: líneas de construcción, ejes,
           cotas, contornos y achurado; luego queda sólido.
   Scroll: el logo se inclina en 3D, las partículas vuelan a armar el
           edificio y el logo queda como techo; palabras gigantes, contador
           de m²; al final el edificio estalla y una cortina da paso al hero.
   ========================================================= */
(function(){
  var intro = document.getElementById('a2-intro');
  if (!intro) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var Q = function(s){ return intro.querySelector(s); };
  var stage = Q('.intro-stage'), cv = Q('.intro-cv'), logo = Q('.intro-logo'), info = Q('.intro-info');
  var cue = Q('.intro-cue'), skip = Q('.intro-skip'), login = Q('.intro-login'), flash = Q('.intro-flash');
  var verbs = Q('.intro-verbs'), vItems = [].slice.call(verbs.children);
  var m2 = Q('.intro-m2'), m2n = Q('.intro-m2 b');
  var box = document.getElementById('iso-box');
  document.body.classList.add('has-intro');

  var visto = false; try { visto = sessionStorage.getItem('a2-intro') === '1'; } catch(e){}
  if (location.hash && location.hash !== '#a2-intro') visto = true;
  if (reduce) { intro.classList.add('static', 'reduce'); return; }

  /* ---------- geometría ---------- */
  function dentro(pt, poly){ var x = pt[0], y = pt[1], c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; }
    return c; }
  var BLANCO = [[0,0],[28,0],[28,11],[11,11],[11,89],[89,89],[89,76],[100,76],[100,100],[0,100]];
  var ESCUADRA = [[42,0],[100,0],[100,60],[89,60],[89,53],[46,11],[42,11]], HUECO = [[66,11],[89,11],[89,35.8]];
  var H = 150, PISOS = 12, ALTO = H / PISOS, R0 = 0.28, R1 = 0.80;   // el techo sube entre R0 y R1
  var rnd = (function(s){ return function(){ s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(20261106);
  function dirAleatoria(){ var a = rnd() * Math.PI * 2, b = rnd() * 2 - 1, r = Math.sqrt(1 - b * b); return [Math.cos(a) * r, Math.sin(a) * r, b]; }
  function punto3(x, y, z, extra){ var d = dirAleatoria(), m = 140 + rnd() * 240;
    return Object.assign({x:x, y:y, z:z, dx:d[0] * m, dy:d[1] * m, dz:Math.abs(d[2]) * m * 0.8 + 40}, extra); }

  var LOGO = [];
  for (var gx = 1.6; gx < 100; gx += 3.2) for (var gy = 1.6; gy < 100; gy += 3.2) {
    var pt = [gx, gy], c = dentro(pt, BLANCO) ? 0 : (dentro(pt, ESCUADRA) && !dentro(pt, HUECO)) ? 1 : -1;
    if (c >= 0) LOGO.push(punto3(gx, gy, 0, {c:c, ang:rnd() * Math.PI * 2, rad:0.35 + rnd() * 0.65, del:rnd() * 0.28}));
  }
  var EDIF = [], k, t;
  for (k = 1; k < PISOS; k++) { var z = k * ALTO, pk = R0 + (R1 - R0) * (k / PISOS);
    for (t = 0; t < 100; t += 4) [[t, 0], [100, t], [100 - t, 100], [0, 100 - t]].forEach(function(q){
      EDIF.push(punto3(q[0], q[1], z, {k:k, a:pk - 0.075 + rnd() * 0.035, dur:0.06, al:0.5})); }); }
  [0, 33.3, 66.6, 100].forEach(function(a){ [0, 33.3, 66.6, 100].forEach(function(b){
    var borde = a === 0 || a === 100 || b === 0 || b === 100;
    for (var h = 0; h <= H; h += 3.5) EDIF.push(punto3(a, b, h, {col:1, a:R0 - 0.1 + (R1 - R0) * (h / H) + rnd() * 0.03, dur:0.07, al:borde ? 0.6 : 0.3})); }); });

  /* ---------- lienzo ---------- */
  var ctx = cv.getContext('2d'), dpr = 1, W = 0, Hh = 0, base = {cx:0, cy:0, s:1};
  function medir(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth; Hh = stage.clientHeight; cv.width = W * dpr; cv.height = Hh * dpr;
    var tr = logo.style.transform; logo.style.transform = 'translate(-50%,-50%)';
    var sr = stage.getBoundingClientRect(), br = box.getBoundingClientRect(); logo.style.transform = tr;
    base = {cx:br.left - sr.left + br.width / 2, cy:br.top - sr.top + br.height / 2, s:br.width / 100};
  }
  var sm = function(a, b, x){ x = Math.min(Math.max((x - a) / (b - a), 0), 1); return x * x * (3 - 2 * x); };
  var lerp = function(a, b, t){ return a + (b - a) * t; };
  var outExpo = function(x){ return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
  var inOut = function(x){ return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  /* ---------- mouse: las partículas se apartan ---------- */
  var mouse = {x:-9999, y:-9999, tx:-9999, ty:-9999};
  if (window.matchMedia('(pointer:fine)').matches) {
    stage.addEventListener('mousemove', function(e){ var r = stage.getBoundingClientRect(); mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; });
    stage.addEventListener('mouseleave', function(){ mouse.tx = mouse.ty = -9999; });
  }
  function apartar(px, py){
    var dx = px - mouse.x, dy = py - mouse.y, d2 = dx * dx + dy * dy;
    if (d2 > 14400 || d2 < 0.01) return [px, py];
    var d = Math.sqrt(d2), f = Math.pow(1 - d / 120, 2) * 38; return [px + dx / d * f, py + dy / d * f];
  }
  function cuadrito(px, py, tam, col, a){ if (a <= 0.003) return; var q = apartar(px, py);
    ctx.globalAlpha = Math.min(a, 1); ctx.fillStyle = col; ctx.fillRect(q[0] - tam / 2, q[1] - tam / 2, tam, tam); }

  /* ---------- 1. carga: el logo se arma como un plano (CSS) ---------- */
  var modo = visto ? 'scroll' : 'carga', t0 = 0;
  if (visto) intro.classList.add('static'); else intro.classList.add('play');
  function terminarCarga(){
    if (modo !== 'carga') return; modo = 'scroll';
    intro.classList.add('listo'); try { sessionStorage.setItem('a2-intro', '1'); } catch(e){}
  }
  function dibujarCarga(ms){ cv.style.opacity = 0; if (ms > 3900) terminarCarga(); }

  /* ---------- 2. scroll: el edificio ---------- */
  var prog = 0, deriva = 0;
  function progreso(){ var r = intro.getBoundingClientRect(), tot = intro.offsetHeight - Hh; return Math.min(Math.max(-r.top / tot, 0), 1); }
  var fmt = function(n){ return Math.round(n).toLocaleString('en-US'); };
  var idxPrev = -1;

  function dibujarScroll(){
    var p = prog, movil = W < 980;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    var t1 = sm(0.05, 0.28, p), salida = sm(0.86, 0.98, p);

    // logo nítido → partículas
    var fl = 1 - sm(0.02, 0.08, p);
    logo.style.opacity = fl; logo.style.transform = 'translate(-50%,-50%) scale(' + (1 - 0.05 * (1 - fl)) + ')';
    info.style.opacity = 1 - sm(0.015, 0.06, p);
    cue.style.opacity = p > 0.015 ? 0 : '';
    skip.style.opacity = p > 0.015 ? 1 - sm(0.82, 0.9, p) : ''; skip.style.pointerEvents = p > 0.88 ? 'none' : '';
    cv.style.opacity = sm(0.015, 0.06, p);

    // cámara y giro
    var fi = lerp(Math.PI / 2, 0.58, t1);
    var giro = lerp(0, -0.8, t1) + lerp(0, -1.9, sm(0.4, 1, p)) + deriva;
    var sF = (movil ? 0.44 : 0.7) * Hh / (H * Math.cos(0.58) + 141 * Math.sin(0.58));
    var s = lerp(base.s, sF, sm(0.05, 0.42, p)) * (1 + salida * 0.9);
    var techo = H * inOut(Math.min(Math.max((p - R0) / (R1 - R0), 0), 1));
    var cx = lerp(base.cx, movil ? W * 0.5 : W * 0.7, t1);
    var cy = lerp(base.cy, movil ? Hh * 0.42 : Hh * 0.53, t1) + s * techo * Math.cos(fi) * 0.5;
    var cs = Math.cos(giro), sn = Math.sin(giro), sf = Math.sin(fi), cf = Math.cos(fi);
    var tam = Math.max(1.3, Math.min(2.5, s * 1.25));
    function proy(x, y, z){ var X = x - 50, Y = y - 50, rx = X * cs - Y * sn, ry = X * sn + Y * cs;
      return [cx + s * rx, cy + s * (ry * sf - z * cf), fi < 1.4 ? 0.5 + 0.5 * ((ry + 71) / 142) : 1]; }
    var i, q, v, e = salida;

    // huella en el suelo
    var tg = sm(R0, R0 + 0.1, p) * (1 - e);
    if (tg > 0) for (i = 0; i < LOGO.length; i++) { q = LOGO[i]; v = proy(q.x, q.y, 0); cuadrito(v[0], v[1], tam, q.c ? '#DFE700' : '#F3F2EE', 0.15 * tg * v[2]); }
    // columnas y losas: llegan volando
    for (i = 0; i < EDIF.length; i++) { q = EDIF[i];
      if (q.col && q.z > techo + 0.5) continue;
      var r = sm(q.a, q.a + q.dur, p); if (r <= 0) continue;
      var f = 1 - Math.pow(1 - r, 3), sc = (1 - f) + e * 2.6;
      v = proy(q.x + q.dx * sc, q.y + q.dy * sc, q.z + q.dz * sc);
      var acento = q.k === PISOS - 1 && p > 0.76;
      cuadrito(v[0], v[1], tam, acento ? '#DFE700' : '#F3F2EE', q.al * (0.35 + 0.65 * f) * v[2] * (1 - e)); }
    // el logo es el techo
    for (i = 0; i < LOGO.length; i++) { q = LOGO[i]; var se = e * 2.2;
      v = proy(q.x + q.dx * se, q.y + q.dy * se, techo + q.dz * se); cuadrito(v[0], v[1], tam * (q.c ? 1.1 : 1), q.c ? '#DFE700' : '#F3F2EE', (q.c ? 1 : 0.88) * (1 - e)); }
    ctx.globalAlpha = 1;

    // destellos al cambiar de fase
    var fx = 0; [R0, 0.52, 0.78].forEach(function(b){ fx = Math.max(fx, 1 - Math.abs(p - b) / 0.012); });
    flash.style.opacity = fx * 0.22;

    // lo que hacemos y contador
    var idx = p < R0 ? 0 : p < 0.52 ? 1 : p < 0.78 ? 2 : 3;
    verbs.classList.toggle('show', p > 0.08 && p < 0.88);
    if (idx !== idxPrev) { vItems.forEach(function(li, n){ li.classList.toggle('on', n === idx); li.classList.toggle('done', n < idx); }); idxPrev = idx; }
    m2.style.opacity = p > R0 - 0.04 && p < 0.88 ? 1 : 0;
    m2n.textContent = fmt(750000 * inOut(Math.min(Math.max((p - R0) / (R1 - R0), 0), 1)));

  }

  /* ---------- bucle ---------- */
  var activo = false, ultimo = 0;
  function cuadro(ts){
    if (!activo) return;
    if (!t0) t0 = ts;
    var dt = ultimo ? Math.min(ts - ultimo, 50) : 16; ultimo = ts;
    mouse.x += (mouse.tx - mouse.x) * 0.2; mouse.y += (mouse.ty - mouse.y) * 0.2;
    if (mouse.tx < -9000) { mouse.x = mouse.y = -9999; }
    prog = progreso();
    if (modo === 'carga' && prog > 0.015) { intro.classList.remove('play'); intro.classList.add('static'); terminarCarga(); }
    if (modo === 'carga') dibujarCarga(ts - t0);
    else { if (prog > 0.06 && prog < 0.99) deriva += dt * 0.00007; dibujarScroll(); }
    requestAnimationFrame(cuadro);
  }
  function arrancar(){ if (!activo) { activo = true; ultimo = 0; requestAnimationFrame(cuadro); } }
  if ('IntersectionObserver' in window) new IntersectionObserver(function(en){
    if (en[0].isIntersecting) arrancar(); else activo = false; }, {threshold:0}).observe(intro);
  window.addEventListener('resize', medir);
  medir(); arrancar();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
})();

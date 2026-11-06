/* =========================================================
   INTRO · el giro de A2
   1. Al cargar: un punto dibuja el cuadro, la escuadra gira a su lugar
      y aparece "área cuadrada" (CSS).
   2. Al hacer scroll: el logo se vuelve puntos, se inclina en 3D y sube
      como un edificio; el logo queda como techo (canvas).
   ========================================================= */
(function(){
  var intro = document.getElementById('a2-intro');
  if (!intro) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage = intro.querySelector('.intro-stage'), cv = intro.querySelector('.intro-cv');
  var logo = intro.querySelector('.intro-logo'), info = intro.querySelector('.intro-info');
  var verbs = intro.querySelector('.intro-verbs'), vItems = [].slice.call(verbs.children);
  var cue = intro.querySelector('.intro-cue'), skip = intro.querySelector('.intro-skip'), box = document.getElementById('iso-box');
  document.body.classList.add('has-intro');

  /* ---- Una vez por visita: si ya la vio, el logo aparece armado ---- */
  var visto = false; try { visto = sessionStorage.getItem('a2-intro') === '1'; } catch(e){}
  if (location.hash && location.hash !== '#a2-intro') visto = true;
  if (reduce) { intro.classList.add('static', 'reduce'); return; }
  if (visto) intro.classList.add('static');
  else {
    intro.classList.add('play');
    setTimeout(function(){ intro.classList.add('listo'); try { sessionStorage.setItem('a2-intro', '1'); } catch(e){} }, 3500);
  }

  /* ---- Puntos: logo (plano) + edificio ---- */
  function dentro(pt, poly){ var x = pt[0], y = pt[1], c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; }
    return c; }
  var BLANCO = [[0,0],[28,0],[28,11],[11,11],[11,89],[89,89],[89,76],[100,76],[100,100],[0,100]];
  var ESCUADRA = [[42,0],[100,0],[100,60],[89,60],[89,53],[46,11],[42,11]], HUECO = [[66,11],[89,11],[89,35.8]];
  var logoPts = [], H = 150, PISOS = 12, alto = H / PISOS;
  for (var gx = 1.6; gx < 100; gx += 3.2) for (var gy = 1.6; gy < 100; gy += 3.2) {
    var p = [gx, gy];
    if (dentro(p, BLANCO)) logoPts.push({x:gx, y:gy, c:0});
    else if (dentro(p, ESCUADRA) && !dentro(p, HUECO)) logoPts.push({x:gx, y:gy, c:1});
  }
  var losas = [], cols = [], k, t;
  for (k = 1; k < PISOS; k++) { var z = k * alto;
    for (t = 0; t < 100; t += 4) { losas.push({x:t, y:0, z:z, k:k}, {x:100, y:t, z:z, k:k}, {x:100 - t, y:100, z:z, k:k}, {x:0, y:100 - t, z:z, k:k}); } }
  [0, 33.3, 66.6, 100].forEach(function(a){ [0, 33.3, 66.6, 100].forEach(function(b){
    for (var h = 0; h <= H; h += 3.5) cols.push({x:a, y:b, z:h, borde: a === 0 || a === 100 || b === 0 || b === 100}); }); });

  /* ---- Lienzo ---- */
  var ctx = cv.getContext('2d'), dpr = 1, W = 0, Hh = 0, base = {cx:0, cy:0, s:1};
  function medir(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth; Hh = stage.clientHeight;
    cv.width = W * dpr; cv.height = Hh * dpr;
    var sr = stage.getBoundingClientRect(), br = box.getBoundingClientRect();
    base = {cx: br.left - sr.left + br.width / 2, cy: br.top - sr.top + br.height / 2, s: br.width / 100};
  }
  function sm(a, b, x){ x = Math.min(Math.max((x - a) / (b - a), 0), 1); return x * x * (3 - 2 * x); }
  function lerp(a, b, t){ return a + (b - a) * t; }

  var prog = 0, deriva = 0, visible = true, ultimo = 0;
  function progreso(){
    var r = intro.getBoundingClientRect(), total = intro.offsetHeight - Hh;
    return Math.min(Math.max(-r.top / total, 0), 1);
  }

  function dibujar(){
    var p = prog, movil = W < 980;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    var t1 = sm(0.06, 0.30, p), t2 = sm(0.30, 0.80, p), t3 = sm(0.74, 0.94, p), salida = sm(0.93, 1, p);

    // logo SVG → puntos
    var fl = 1 - sm(0.03, 0.12, p);
    logo.style.opacity = fl; logo.style.transform = 'translate(-50%,-50%) scale(' + (1 - 0.04 * (1 - fl)) + ')';
    info.style.opacity = 1 - sm(0.02, 0.08, p); cue.style.opacity = '';
    if (p > 0.02) cue.style.opacity = 0;
    skip.style.opacity = p > 0.02 ? 1 - sm(0.82, 0.92, p) : '';
    skip.style.pointerEvents = p > 0.9 ? 'none' : '';
    cv.style.opacity = sm(0.02, 0.09, p) * (1 - salida * 0.85);

    // cámara
    var fi = lerp(Math.PI / 2, 0.58, t1);                             // de planta a vista 3D
    var giro = lerp(0, -0.72, t1) + lerp(0, -1.35, sm(0.45, 1, p)) + deriva;  // el giro
    var sF = (movil ? 0.44 : 0.7) * Hh / (H * Math.cos(0.58) + 141 * Math.sin(0.58));
    var s = lerp(base.s, sF, sm(0.06, 0.45, p));
    var techo = H * t2;
    var cx = lerp(base.cx, movil ? W * 0.5 : W * 0.7, t1);
    var cy0 = lerp(base.cy, movil ? Hh * 0.43 : Hh * 0.52, t1);
    var cy = cy0 + s * techo * Math.cos(fi) * 0.5 - salida * Hh * 0.08;
    var cs = Math.cos(giro), sn = Math.sin(giro), sf = Math.sin(fi), cf = Math.cos(fi);
    var tam = Math.max(1.3, Math.min(2.4, s * 1.25));

    function punto(x, y, z, col, a){
      var X = x - 50, Y = y - 50, rx = X * cs - Y * sn, ry = X * sn + Y * cs;
      var px = cx + s * rx, py = cy + s * (ry * sf - z * cf);
      var prof = 0.55 + 0.45 * ((ry + 71) / 142);                   // lo de atrás, más tenue
      ctx.globalAlpha = Math.max(0, Math.min(1, a * (fi < 1.4 ? prof : 1)));
      ctx.fillStyle = col; ctx.fillRect(px - tam / 2, py - tam / 2, tam, tam);
    }
    var i, q;
    // huella en el suelo (el plano)
    if (t2 > 0) for (i = 0; i < logoPts.length; i++) { q = logoPts[i]; punto(q.x, q.y, 0, q.c ? '#DFE700' : '#F3F2EE', 0.16 * t2); }
    // columnas: estructuramos
    var tc = sm(0.30, 0.52, p);
    for (i = 0; i < cols.length; i++) { q = cols[i]; if (q.z > techo + 0.01) continue;
      punto(q.x, q.y, q.z, '#F3F2EE', (q.borde ? 0.55 : 0.28) * tc); }
    // losas: construimos
    for (i = 0; i < losas.length; i++) { q = losas[i]; if (q.z > techo) continue;
      var nace = sm(q.z, q.z + alto * 1.5, techo);
      var acento = t3 > 0 && q.k === PISOS - 1;
      punto(q.x, q.y, q.z, acento ? '#DFE700' : '#F3F2EE', (0.18 + 0.32 * nace) * (acento ? 1 : 1)); }
    // el logo es el techo y sube con el edificio
    for (i = 0; i < logoPts.length; i++) { q = logoPts[i];
      punto(q.x, q.y, techo, q.c ? '#DFE700' : '#F3F2EE', q.c ? 0.95 : 0.85); }
    ctx.globalAlpha = 1;

    // palabras
    verbs.classList.toggle('show', p > 0.10 && p < 0.985);
    var idx = p < 0.30 ? 0 : p < 0.52 ? 1 : p < 0.78 ? 2 : 3;
    vItems.forEach(function(li, n){ li.classList.toggle('on', n === idx); li.classList.toggle('done', n < idx); });
    verbs.style.opacity = 1 - salida;
  }

  function cuadro(ts){
    if (!visible) return;
    var dt = ultimo ? Math.min(ts - ultimo, 50) : 16; ultimo = ts;
    if (prog > 0.08 && prog < 0.995) deriva += dt * 0.00006;            // respira mientras lo ves
    prog = progreso(); dibujar();
    requestAnimationFrame(cuadro);
  }
  function arrancar(){ if (!visible) { visible = true; ultimo = 0; requestAnimationFrame(cuadro); } }

  if ('IntersectionObserver' in window) new IntersectionObserver(function(en){
    if (en[0].isIntersecting) arrancar(); else visible = false; }, {threshold:0}).observe(intro);
  window.addEventListener('resize', function(){ medir(); });
  medir(); visible = false; arrancar();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
})();

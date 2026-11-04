/* Portal A2 · utilidades de interfaz compartidas */
(function(){
  var U = {};
  U.$ = function(s, c){ return (c || document).querySelector(s); };
  U.$$ = function(s, c){ return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  U.esc = function(s){ var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  U.fecha = function(iso, conHora){
    if (!iso) return '—'; var d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    var o = {day:'numeric', month:'short', year:'numeric'}; if (conHora) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString('es-GT', o);
  };
  U.param = function(k){ return new URLSearchParams(location.search).get(k); };

  /* ---------- Moneda: ver todo en Q o en $ ---------- */
  var KEY = 'a2-moneda', fx = 7.75, vista = 'orig';
  try { vista = localStorage.getItem(KEY) || 'orig'; } catch(e){}
  U.setFx = function(v){ fx = Number(v) || fx; };
  U.getFx = function(){ return fx; };
  U.vista = function(){ return vista; };
  U.num = function(n){ return Number(n || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); };
  U.convertir = function(m, de, a){ m = Number(m || 0); if (de === a) return m; return de === 'USD' ? m * fx : m / fx; };
  U.dinero = function(m, mon){
    var destino = vista === 'orig' ? mon : vista;
    var v = U.convertir(m, mon, destino);
    var txt = (destino === 'USD' ? 'US$ ' : 'Q ') + U.num(v);
    return destino !== mon ? '<span title="Original: ' + (mon === 'USD' ? 'US$ ' : 'Q ') + U.num(m) + '">≈ ' + txt + '</span>' : txt;
  };
  U.monedaToggle = function(cont, onChange){
    cont.innerHTML = '<span class="mt-l">Ver montos en</span>' +
      '<button type="button" data-v="orig">Original</button><button type="button" data-v="GTQ">Q</button><button type="button" data-v="USD">US$</button>';
    function pintar(){ U.$$('button', cont).forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.v === vista); }); }
    U.$$('button', cont).forEach(function(b){ b.addEventListener('click', function(){ vista = b.dataset.v; try { localStorage.setItem(KEY, vista); } catch(e){} pintar(); onChange && onChange(); }); });
    pintar();
  };

  /* ---------- Avisos y confirmaciones ---------- */
  U.flash = function(m, bad){
    var f = document.createElement('div'); f.className = 'u-flash' + (bad ? ' bad' : ''); f.textContent = m; document.body.appendChild(f);
    setTimeout(function(){ f.classList.add('show'); }, 10);
    setTimeout(function(){ f.classList.remove('show'); setTimeout(function(){ f.remove(); }, 300); }, 3400);
  };
  U.confirmar = function(btn, texto, accion){
    if (!btn.dataset.sure) { btn.dataset.sure = '1'; var t = btn.innerHTML; btn.textContent = texto; btn.classList.add('warn');
      setTimeout(function(){ if (btn.dataset.sure) { delete btn.dataset.sure; btn.innerHTML = t; btn.classList.remove('warn'); } }, 4000); return; }
    delete btn.dataset.sure; accion();
  };
  U.busy = function(el, on){ el.classList.toggle('loading', !!on); };
  U.err = function(box, m){ box.hidden = false; box.className = (box.className.replace(/\b(err-box|note)\b/g, '') + ' err-box').trim(); box.textContent = m; };

  /* ---------- Formularios ---------- */
  U.datos = function(form){ var o = {}; U.$$('[name]', form).forEach(function(i){
    if (i.type === 'checkbox') o[i.name] = i.checked; else if (i.type !== 'file') o[i.name] = i.value.trim() === '' ? null : i.value.trim(); }); return o; };
  U.llenar = function(form, obj){ U.$$('[name]', form).forEach(function(i){ var v = obj ? obj[i.name] : null;
    if (i.type === 'checkbox') i.checked = !!v; else if (i.type !== 'file') i.value = v == null ? '' : v; }); };
  U.requeridos = function(form){ var ok = true; U.$$('[required]', form).forEach(function(i){ var f = i.closest('.field'); var v = i.type === 'file' ? i.files.length : i.value.trim();
    if (f) f.classList.toggle('err', !v); if (!v) ok = false; }); return ok; };
  U.opciones = function(sel, lista, valor, texto, vacio){ sel.innerHTML = (vacio ? '<option value="">' + U.esc(vacio) + '</option>' : '') +
    lista.map(function(x){ return '<option value="' + U.esc(x[valor]) + '">' + U.esc(typeof texto === 'function' ? texto(x) : x[texto]) + '</option>'; }).join(''); };

  /* ---------- Sesión común de las páginas del portal ---------- */
  U.sesion = function(cb){
    A2Portal.me().then(function(me){
      if (!me) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return; }
      if (me.tipo === 'proveedor') { location.href = 'proveedor.html'; return; }
      if (me.sinPerfil) { document.body.innerHTML = '<p style="padding:40px">Tu perfil no está completo. Contactá a Gerencia.</p>'; return; }
      return A2Portal.getFx().then(function(v){ U.setFx(v); }, function(){}).then(function(){ cb(me); });
    }).catch(function(m){ var b = U.$('#c-err'); if (b) { b.hidden = false; b.textContent = String(m); } });
  };

  window.UI = U;
})();

/* =========================================================
   Portal A2 — capa de datos
   - Si js/config.js tiene supabaseUrl y supabaseAnonKey → modo REAL
     (Supabase Auth + base de datos + funciones que envían correos con Resend).
   - Si no → modo DEMO (todo en este navegador, sin correos).
   Las páginas solo llaman a window.A2Portal; no saben en qué modo están.
   ========================================================= */
(function(){
  var C = window.A2_CONFIG || {};
  var LIVE = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase && window.supabase.createClient);
  var sb = LIVE ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey) : null;
  var AREAS = C.areas || [];

  function areaName(id){ var a = AREAS.filter(function(x){return x.id===id})[0]; return a ? a.n : id; }

  /* ---------- utilidades ---------- */
  function fnErr(error){
    // Extrae el mensaje que devuelve la función (JSON {error:"..."}).
    if (error && error.context && typeof error.context.json === 'function') {
      return error.context.json().then(function(j){ throw (j && j.error) || 'Ocurrió un error. Intentá de nuevo.'; },
        function(){ throw 'Ocurrió un error. Intentá de nuevo.'; });
    }
    return Promise.reject((error && error.message) || 'Ocurrió un error. Intentá de nuevo.');
  }
  function invoke(name, body){
    var real = (C.funciones && C.funciones[name]) || name;
    return sb.functions.invoke(real, {body: body}).then(function(r){
      if (r.error) return fnErr(r.error);
      if (r.data && r.data.error) throw r.data.error;
      return r.data;
    });
  }

  /* ======================= MODO REAL ======================= */
  var live = {
    requestAccess: function(d){ return invoke('solicitar', d); },

    login: function(email, password){
      return sb.auth.signInWithPassword({email:email, password:password}).then(function(r){
        if (r.error) throw (/invalid/i.test(r.error.message) ? 'Correo o contraseña incorrectos.' : r.error.message);
        return r.data;
      });
    },
    logout: function(){ return sb.auth.signOut(); },
    forgot: function(email){
      return sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + 'restablecer.html'})
        .then(function(r){ if (r.error) throw r.error.message; });
    },
    setNewPassword: function(pw){ return sb.auth.updateUser({password: pw}).then(function(r){ if (r.error) throw r.error.message; }); },
    onRecovery: function(cb){ sb.auth.onAuthStateChange(function(ev){ if (ev === 'PASSWORD_RECOVERY') cb(); }); },

    me: function(){
      return sb.auth.getSession().then(function(r){
        var s = r.data.session; if (!s) return null;
        return sb.from('perfiles').select('*').eq('id', s.user.id).maybeSingle().then(function(p){
          if (p.error) throw p.error.message; return p.data ? p.data : {correo: s.user.email, sinPerfil: true};
        });
      });
    },

    getRequest: function(id){
      return sb.from('solicitudes').select('id,nombres,apellidos,correo,celular,puesto,nota,status,rol,areas,creada_at').eq('id', id).maybeSingle()
        .then(function(r){ if (r.error) throw r.error.message; return r.data; });
    },
    listPending: function(){
      return sb.from('solicitudes').select('id,nombres,apellidos,puesto,correo,creada_at').eq('status','pendiente').order('creada_at',{ascending:false})
        .then(function(r){ if (r.error) throw r.error.message; return r.data || []; });
    },
    approve: function(id, opts){ return invoke('aprobar', {id:id, accion:'autorizar', rol:opts.rol, areas:opts.areas}); },
    reject: function(id, motivo){ return invoke('aprobar', {id:id, accion:'rechazar', motivo:motivo||''}); },

    verifyCode: function(id, code){ return invoke('activar', {id:id, codigo:code, accion:'verificar'}); },
    completeProfile: function(id, code, perfil, password){ return invoke('activar', {id:id, codigo:code, accion:'completar', perfil:perfil, password:password}); },

    listUsers: function(){
      return sb.from('perfiles').select('id,correo,nombres,apellidos,puesto,rol,area,areas,permisos,activo,creado_at').order('nombres')
        .then(function(r){ if (r.error) throw r.error.message; return r.data || []; });
    },
    updateUser: function(id, d){ return invoke('usuarios', {accion:'actualizar', id:id, rol:d.rol, areas:d.areas, area:d.area, permisos:d.permisos}); },
    setActive: function(id, on){ return invoke('usuarios', {accion: on ? 'reactivar' : 'desactivar', id:id}); },
    deleteUser: function(id){ return invoke('usuarios', {accion:'eliminar', id:id}); },

    listNotices: function(){
      return sb.from('comunicados').select('id,titulo,cuerpo,categoria,destinatarios,autor_nombre,enviados,creado_at').order('creado_at',{ascending:false}).limit(30)
        .then(function(r){ if (r.error) throw r.error.message; return r.data || []; });
    },
    publishNotice: function(d){ return invoke('comunicados', {accion:'publicar', titulo:d.titulo, cuerpo:d.cuerpo, categoria:d.categoria, destinatarios:d.destinatarios, correo:d.correo}); },
    deleteNotice: function(id){ return invoke('comunicados', {accion:'eliminar', id:id}); }
  };

  /* ======================= MODO DEMO ======================= */
  var KEY = 'a2-portal-demo';
  function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return window.__a2mem || {}; } }
  function save(d){ window.__a2mem = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e){} }
  function genCode(){
    var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '', arr = new Uint32Array(6);
    crypto.getRandomValues(arr); for (var i=0;i<6;i++) s += c[arr[i] % c.length]; return s;
  }
  function P(v){ return Promise.resolve(v); }
  function R(m){ return Promise.reject(m); }
  var demo = {
    requestAccess: function(d){
      var db = load(); db.request = Object.assign({}, d, {id:'demo', status:'pendiente', created_at:new Date().toISOString()});
      save(db); return P({ok:true, id:'demo'});
    },
    login: function(email){
      var db = load(), r = db.request;
      if (r && r.status === 'activa' && r.correo === email.toLowerCase()) { db.session = true; save(db); return P({}); }
      return R('Demo: activá primero un usuario de prueba con ese correo.');
    },
    logout: function(){ var db = load(); db.session = false; save(db); return P(); },
    forgot: function(){ return P(); },
    setNewPassword: function(){ return P(); },
    onRecovery: function(){},
    me: function(){ var db = load(); var dm = (location.search.match(/demo=(\w+)/) || [])[1]; try { if (dm) sessionStorage.setItem('a2-demo-as', dm); else dm = sessionStorage.getItem('a2-demo-as'); } catch(e){} if (dm && window.A2Demo && A2Demo.me(dm)) return P(A2Demo.me(dm)); return P(db.session && db.request ? Object.assign({}, db.request, {rol: db.request.rol || 'colaborador'}) : null); },
    getRequest: function(){ return P(load().request || null); },
    listPending: function(){ var r = load().request; return P(r && r.status==='pendiente' ? [r] : []); },
    approve: function(id, o){
      var db = load(); if (!db.request) return R('No hay solicitud.');
      Object.assign(db.request, {status:'autorizada', rol:o.rol, areas:o.areas, code:genCode(), expiresAt:Date.now()+72*3600e3});
      save(db); return P({ok:true, demoCode: db.request.code});
    },
    reject: function(){ var db = load(); if (db.request) db.request.status = 'rechazada'; save(db); return P({ok:true}); },
    verifyCode: function(id, code){
      var r = load().request;
      if (!r || r.status !== 'autorizada') return R('No hay una autorización vigente para este enlace.');
      if (Date.now() > r.expiresAt) return R('El código venció. Pedí a Gerencia que lo vuelva a emitir.');
      if (String(code).toUpperCase() !== r.code) return R('El código no coincide. Revisá el correo e intentá de nuevo.');
      return P(r);
    },
    completeProfile: function(id, code, perfil){
      return demo.verifyCode(id, code).then(function(){
        var db = load(); Object.assign(db.request, perfil, {status:'activa', code:null}); save(db); return {ok:true, perfil: db.request};
      });
    },
    listUsers: function(){
      var db = load();
      if (!db.users && window.A2Demo) { db.users = JSON.parse(JSON.stringify(A2Demo.users)); save(db); }
      if (!db.users) { db.users = [
        {id:'u0', correo:'muc@a2desarrollos.com', nombres:'Mauricio', apellidos:'Urruela', puesto:'Gerente general', rol:'owner', area:null, areas:AREAS.map(function(a){return a.id}), activo:true},
        {id:'u1', correo:'ana.perez@a2desarrollos.com', nombres:'Ana Lucía', apellidos:'Pérez', puesto:'Asesor(a) de ventas', rol:'colaborador', area:'ventas', areas:['ventas','mercadeo'], activo:true},
        {id:'u2', correo:'jorge.lopez@a2desarrollos.com', nombres:'Jorge', apellidos:'López', puesto:'Supervisor(a) de obra', rol:'colaborador', area:'proyectos', areas:['proyectos'], activo:false}
      ]; save(db); }
      return P(db.users.slice());
    },
    updateUser: function(id, d){ var db = load(); db.users.forEach(function(u){ if (u.id===id){ u.rol=d.rol; u.areas=d.areas; u.area=d.area; if (d.permisos) u.permisos=d.permisos; } }); save(db); return P({ok:true}); },
    setActive: function(id, on){ var db = load(); db.users.forEach(function(u){ if (u.id===id) u.activo=on; }); save(db); return P({ok:true}); },
    deleteUser: function(id){ var db = load(); db.users = db.users.filter(function(u){ return u.id!==id; }); save(db); return P({ok:true}); },
    listNotices: function(){
      var db = load();
      if (!db.notices) { db.notices = [
        {id:'n1', titulo:'Asueto del 1 de noviembre', cuerpo:'Les recordamos que el sábado 1 de noviembre la oficina permanecerá cerrada.\nRetomamos labores el lunes.', categoria:'vacaciones', destinatarios:[], autor_nombre:'Mauricio Urruela', enviados:12, creado_at:new Date(Date.now()-3*864e5).toISOString()},
        {id:'n2', titulo:'Cierre contable de octubre', cuerpo:'Favor enviar facturas y liquidaciones pendientes antes del viernes.', categoria:'aviso', destinatarios:['finanzas','proyectos'], autor_nombre:'Mauricio Urruela', enviados:5, creado_at:new Date(Date.now()-6*864e5).toISOString()}
      ]; save(db); }
      return P(db.notices.slice());
    },
    publishNotice: function(d){
      var db = load(); db.notices = db.notices || [];
      db.notices.unshift({id:'n'+Date.now(), titulo:d.titulo, cuerpo:d.cuerpo, categoria:d.categoria, destinatarios:d.destinatarios, autor_nombre:'Mauricio Urruela', enviados:0, creado_at:new Date().toISOString()});
      save(db); return P({ok:true, enviados:0, demo:true});
    },
    deleteNotice: function(id){ var db = load(); db.notices = (db.notices||[]).filter(function(n){ return n.id!==id; }); save(db); return P({ok:true}); },
    reset: function(){ save({}); }
  };

  window.A2Portal = Object.assign({ live: LIVE, demo: !LIVE, areas: AREAS, puestos: C.puestos || [], dominio: C.dominioCorporativo || 'a2desarrollos.com', areaName: areaName,
    permisos: C.permisos || [],
    /* ¿El usuario tiene el permiso? (Owner tiene todos) */
    can: function(me, p){ return !!me && me.activo !== false && (me.rol === 'owner' || (me.permisos || []).indexOf(p) > -1); },
    inArea: function(me, a){ return !!me && (me.rol === 'owner' || me.rol === 'gerente' || me.area === a || (me.areas || []).indexOf(a) > -1); },
    _sb: sb, _invoke: LIVE ? invoke : null, _load: load, _save: save }, LIVE ? live : demo);

  if (window.console) console.info('[Portal A2] modo: ' + (LIVE ? 'REAL (Supabase conectado)' : 'DEMO') + (C.supabaseUrl && !LIVE ? ' — falta cargar la librería de Supabase' : ''));
  /* Barra de "modo demostración" solo cuando aplica */
  document.addEventListener('DOMContentLoaded', function(){
    var bar = document.querySelector('.demo-bar'); if (bar) bar.hidden = LIVE;
    var out = document.getElementById('hdr-logout');
    if (out) out.addEventListener('click', function(){ window.A2Portal.logout().then(function(){ location.href = 'login.html'; }); });
  });
})();

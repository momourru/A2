/* =========================================================
   Portal A2 · Fase 1 — capa de datos de Compras y pagos,
   Proyectos, Proveedores y Empresas.
   Igual que portal.js: modo REAL con Supabase o DEMO en el navegador.
   ========================================================= */
(function(){
  var A = window.A2Portal, sb = A._sb;
  function P(v){ return Promise.resolve(v); }
  function R(m){ return Promise.reject(m); }
  function ok(r){ if (r.error) throw (r.error.message || r.error); return r.data; }
  function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : 'id' + Math.random().toString(16).slice(2)); }
  function ruta(nombre){ var limpio = nombre.normalize('NFD').replace(/[^\w.\-]+/g, '_').slice(-80); return new Date().toISOString().slice(0,7) + '/' + uid() + '-' + limpio; }

  var FASES = [
    {id:'solicitada',    n:'Solicitud de pago',      corto:'Por revisar',     permiso:'revisar_solicitud', boton:'Autorizar y emitir orden de compra'},
    {id:'oc_emitida',    n:'Orden de compra',        corto:'OC emitida',      permiso:'vobo_contable',     boton:'Dar VoBo contable'},
    {id:'vobo_contable', n:'VoBo contable',          corto:'VoBo contable',   permiso:'aprobar_pago',      boton:'Aprobar para transferir'},
    {id:'aprobada',      n:'Aprobado para pago',     corto:'Por transferir',  permiso:'registrar_pago',    boton:'Cerrar pago con comprobante'},
    {id:'pagada',        n:'Pagado',                 corto:'Pagada'},
    {id:'rechazada',     n:'Rechazada',              corto:'Rechazada'}
  ];
  A.fases = FASES;
  A.fase = function(id){ return FASES.filter(function(f){ return f.id === id; })[0] || {id:id, n:id, corto:id}; };
  A.TIPOS_PROYECTO = {residencial:'Residencial', comercial:'Comercial', mixto:'Uso mixto', oficinas:'Oficinas', industrial:'Industrial', otro:'Otro'};
  A.ESTADOS_PROYECTO = {planificacion:'Planificación', en_obra:'En obra', terminado:'Terminado', pausado:'Pausado'};
  A.TIPOS_ADJUNTO = {cotizacion:'Cotización', factura:'Factura', retencion:'Constancia de retención', orden_compra:'Orden de compra', comprobante:'Comprobante de pago', otro:'Otro'};

  /* saldo de cada cotización a partir de sus solicitudes */
  A.saldos = function(cots, sols){
    return cots.map(function(c){
      var mias = sols.filter(function(s){ return s.cotizacion_id === c.id; });
      var pagado = mias.filter(function(s){ return s.fase === 'pagada'; }).reduce(function(t, s){ return t + Number(s.monto); }, 0);
      var proceso = mias.filter(function(s){ return s.fase !== 'pagada' && s.fase !== 'rechazada'; }).reduce(function(t, s){ return t + Number(s.monto); }, 0);
      return Object.assign({}, c, {pagado: pagado, en_proceso: proceso, pendiente: Number(c.monto_total) - pagado, disponible: Number(c.monto_total) - pagado - proceso, solicitudes: mias.length});
    });
  };

  /* ======================= REAL ======================= */
  var live = {
    getFx: function(){ return sb.from('ajustes').select('valor').eq('clave','tipo_cambio').maybeSingle().then(ok).then(function(d){ return d ? Number(d.valor.usd_gtq) : 7.75; }); },
    setFx: function(v){ return sb.from('ajustes').update({valor:{usd_gtq:Number(v)}}).eq('clave','tipo_cambio').then(ok); },

    directorio: function(){ return sb.from('directorio').select('*').eq('activo', true).order('nombres').then(ok); },

    listEmpresas: function(){ return sb.from('empresas').select('*').order('razon_social').then(ok); },
    saveEmpresa: function(e){ var d = Object.assign({}, e); var id = d.id; delete d.id;
      return (id ? sb.from('empresas').update(d).eq('id', id) : sb.from('empresas').insert(d)).then(ok); },
    deleteEmpresa: function(id){ return sb.from('empresas').delete().eq('id', id).then(ok); },

    listProyectos: function(){ return sb.from('proyectos').select('*, empresa:empresas(razon_social)').order('nombre').then(ok); },
    getProyecto: function(id){
      return Promise.all([
        sb.from('proyectos').select('*, empresa:empresas(id, razon_social, nit)').eq('id', id).maybeSingle().then(ok),
        sb.from('proyecto_miembros').select('perfil_id, funcion').eq('proyecto_id', id).then(ok),
        sb.from('proyecto_proveedores').select('servicio, proveedor:proveedores(id, codigo, razon_social, nombre_comercial, contacto_nombre, correo, telefono, rubro)').eq('proyecto_id', id).then(ok),
        sb.from('directorio').select('*').then(ok)
      ]).then(function(r){
        if (!r[0]) return null;
        var dir = {}; (r[3] || []).forEach(function(p){ dir[p.id] = p; });
        r[0].miembros = (r[1] || []).map(function(m){ return Object.assign({funcion: m.funcion, perfil_id: m.perfil_id}, dir[m.perfil_id] || {}); });
        r[0].proveedores = (r[2] || []).map(function(x){ return Object.assign({servicio: x.servicio}, x.proveedor); });
        return r[0];
      });
    },
    saveProyecto: function(p){ var d = Object.assign({}, p); var id = d.id; delete d.id; delete d.empresa; delete d.miembros; delete d.proveedores;
      return (id ? sb.from('proyectos').update(d).eq('id', id).select('id').single() : sb.from('proyectos').insert(d).select('id').single()).then(ok); },
    deleteProyecto: function(id){ return sb.from('proyectos').delete().eq('id', id).then(ok); },
    addMiembro: function(pid, perfil, funcion){ return sb.from('proyecto_miembros').upsert({proyecto_id:pid, perfil_id:perfil, funcion:funcion || null}).then(ok); },
    removeMiembro: function(pid, perfil){ return sb.from('proyecto_miembros').delete().eq('proyecto_id', pid).eq('perfil_id', perfil).then(ok); },
    addProveedorProyecto: function(pid, prv, servicio){ return sb.from('proyecto_proveedores').upsert({proyecto_id:pid, proveedor_id:prv, servicio:servicio || null}).then(ok); },
    removeProveedorProyecto: function(pid, prv){ return sb.from('proyecto_proveedores').delete().eq('proyecto_id', pid).eq('proveedor_id', prv).then(ok); },

    listProveedores: function(){ return sb.from('proveedores').select('*').order('razon_social').then(ok); },
    getProveedor: function(id){
      return Promise.all([
        sb.from('proveedores').select('*').eq('id', id).maybeSingle().then(ok),
        sb.from('proveedor_bancos').select('*').eq('proveedor_id', id).maybeSingle().then(function(r){ return r.data || null; }),
        sb.from('proyecto_proveedores').select('servicio, proyecto:proyectos(id, codigo, nombre)').eq('proveedor_id', id).then(function(r){ return r.data || []; })
      ]).then(function(r){ if (!r[0]) return null; r[0].banco = r[1]; r[0].proyectos = r[2].map(function(x){ return Object.assign({servicio:x.servicio}, x.proyecto); }); return r[0]; });
    },
    saveProveedor: function(p, banco){ var d = Object.assign({}, p); var id = d.id; delete d.id; delete d.banco; delete d.proyectos; delete d.codigo;
      return (id ? sb.from('proveedores').update(d).eq('id', id).select('id').single() : sb.from('proveedores').insert(d).select('id, codigo').single()).then(ok)
        .then(function(r){ if (!banco) return r; return sb.from('proveedor_bancos').upsert(Object.assign({proveedor_id: r.id}, banco)).then(ok).then(function(){ return r; }); }); },

    listCotizaciones: function(){ return sb.from('cotizaciones').select('*, proveedor:proveedores(codigo, razon_social), proyecto:proyectos(codigo, nombre)').order('creado_at', {ascending:false}).then(ok); },
    createCotizacion: function(c, file){
      return sb.auth.getUser().then(function(u){
        var d = Object.assign({}, c, {creado_por: u.data.user.id});
        return sb.from('cotizaciones').insert(d).select('*').single().then(ok).then(function(cot){
          return file ? live.uploadAdjunto({cotizacion_id: cot.id}, 'cotizacion', file).then(function(){ return cot; }) : cot;
        });
      });
    },

    listSolicitudes: function(){ return sb.from('solicitudes_pago').select('*, proveedor:proveedores(codigo, razon_social), proyecto:proyectos(codigo, nombre)').order('creado_at', {ascending:false}).then(ok); },
    getSolicitud: function(id){
      return sb.from('solicitudes_pago').select('*, proveedor:proveedores(id, codigo, razon_social, correo, nit), proyecto:proyectos(id, codigo, nombre), cotizacion:cotizaciones(*)').eq('id', id).maybeSingle().then(ok).then(function(s){
        if (!s) return null;
        return Promise.all([
          sb.from('firmas').select('*').eq('solicitud_id', id).order('id').then(ok),
          sb.from('adjuntos').select('*').or('solicitud_id.eq.' + id + ',cotizacion_id.eq.' + s.cotizacion_id).order('subido_at').then(ok),
          sb.from('solicitudes_pago').select('monto, fase').eq('cotizacion_id', s.cotizacion_id).then(ok),
          sb.from('proveedor_bancos').select('*').eq('proveedor_id', s.proveedor_id).maybeSingle().then(function(r){ return r.data || null; })
        ]).then(function(r){ s.firmas = r[0]; s.adjuntos = r[1]; s.hermanas = r[2]; s.banco = r[3]; return s; });
      });
    },
    crearSolicitud: function(d){ return A._invoke('pagos', Object.assign({accion:'crear'}, d)); },
    avanzar: function(id, d){ return A._invoke('pagos', Object.assign({accion:'avanzar', id:id}, d || {})); },
    rechazar: function(id, motivo){ return A._invoke('pagos', {accion:'rechazar', id:id, nota:motivo}); },

    uploadAdjunto: function(padre, tipo, file){
      if (file.size > 20 * 1024 * 1024) return R('El archivo pesa más de 20 MB.');
      var r = ruta(file.name);
      return sb.storage.from('a2-docs').upload(r, file, {contentType: file.type || 'application/octet-stream'}).then(ok).then(function(){
        return sb.auth.getUser().then(function(u){
          return sb.from('adjuntos').insert(Object.assign({tipo:tipo, nombre:file.name, ruta:r, subido_por:u.data.user.id}, padre)).then(ok);
        });
      });
    },
    urlAdjunto: function(r){ return sb.storage.from('a2-docs').createSignedUrl(r, 600).then(ok).then(function(d){ return d.signedUrl; }); }
  };

  /* ======================= DEMO ======================= */
  var DEMO_USERS = [
    {id:'u0', correo:'muc@a2desarrollos.com', nombres:'Mauricio', apellidos:'Urruela', puesto:'Gerente general', rol:'owner', area:null, areas:['admin','proyectos','ventas','mercadeo'], permisos:[], activo:true, celular:'+502 5555 0000'},
    {id:'u1', correo:'conta@a2desarrollos.com', nombres:'Lucía', apellidos:'Méndez', puesto:'Contador(a)', rol:'colaborador', area:'admin', areas:['admin'], permisos:['vobo_contable','registrar_pago'], activo:true, celular:'+502 5555 0101', extension:'104'},
    {id:'u2', correo:'obra@a2desarrollos.com', nombres:'Jorge', apellidos:'López', puesto:'Supervisor(a) de obra', rol:'colaborador', area:'proyectos', areas:['proyectos'], permisos:['solicitar_pago'], activo:true, celular:'+502 5555 0202'},
    {id:'u3', correo:'campo@a2desarrollos.com', nombres:'Ana', apellidos:'Pérez', puesto:'Arquitecto(a)', rol:'colaborador', area:'proyectos', areas:['proyectos'], permisos:[], activo:true, celular:'+502 5555 0303'},
    {id:'u4', correo:'mercadeo@a2desarrollos.com', nombres:'Sofía', apellidos:'Ramírez', puesto:'Coordinador(a)', rol:'colaborador', area:'mercadeo', areas:['mercadeo'], permisos:['solicitar_pago'], activo:true}
  ];
  window.A2Demo = {
    users: DEMO_USERS,
    me: function(k){ var m = {owner:'u0', conta:'u1', obra:'u2', campo:'u3', mercadeo:'u4'}[k]; return DEMO_USERS.filter(function(u){ return u.id === m; })[0] || null; }
  };
  function db(){
    var d = A._load();
    if (!d.f1) {
      var t = Date.now(), dia = 864e5;
      d.f1 = {
        fx: 7.75,
        empresas: [{id:'e1', razon_social:'Área Cuadrada, S.A.', nombre_comercial:'A2', nit:'1234567-8', representante_legal:'Mauricio Urruela', direccion:'Ciudad de Guatemala'},
                   {id:'e2', razon_social:'Inversiones Plaza Norte, S.A.', nit:'7654321-0', representante_legal:'Mauricio Urruela'}],
        proyectos: [{id:'p1', codigo:'A2-001', nombre:'Torre Zona 10', empresa_id:'e1', tipo:'oficinas', estado:'en_obra', ubicacion:'Zona 10, Guatemala', descripcion:'Edificio de oficinas de 12 niveles.', inicio:'2026-02-01', fin_estimado:'2027-08-30'},
                    {id:'p2', codigo:'A2-002', nombre:'Plaza Norte', empresa_id:'e2', tipo:'comercial', estado:'planificacion', ubicacion:'Mixco'}],
        miembros: [{proyecto_id:'p1', perfil_id:'u2', funcion:'Supervisor de obra'},{proyecto_id:'p1', perfil_id:'u3', funcion:'Arquitecta residente'}],
        proveedores: [{id:'v1', codigo:'PRV-0001', razon_social:'Concretos de Guatemala, S.A.', nombre_comercial:'Concretoguate', nit:'111111-1', rubro:'Concreto premezclado', contacto_nombre:'Carlos Ruiz', correo:'ventas@concretos.gt', telefono:'+502 2222 1111', activo:true},
                      {id:'v2', codigo:'PRV-0002', razon_social:'Impresos Express', rubro:'Imprenta', contacto_nombre:'Marta Gil', correo:'marta@impresos.gt', telefono:'+502 2222 2222', activo:true}],
        bancos: [{proveedor_id:'v1', banco:'Banco Industrial', tipo_cuenta:'Monetaria', numero_cuenta:'000-123456-7', nombre_cuenta:'Concretos de Guatemala, S.A.', moneda:'GTQ'}],
        pp: [{proyecto_id:'p1', proveedor_id:'v1', servicio:'Concreto para losas'}],
        cotizaciones: [{id:'c1', proveedor_id:'v1', proyecto_id:'p1', area:'proyectos', referencia:'COT-8812', descripcion:'Concreto 4000 PSI niveles 3 al 6', moneda:'GTQ', monto_total:185000, estado:'vigente', creado_por:'u2', creado_at:new Date(t-9*dia).toISOString()},
                       {id:'c2', proveedor_id:'v2', proyecto_id:null, area:'mercadeo', referencia:'1045', descripcion:'Brochures corporativos', moneda:'USD', monto_total:1200, estado:'vigente', creado_por:'u4', creado_at:new Date(t-4*dia).toISOString()}],
        solicitudes: [{id:'s1', numero:'SP-2026-0001', cotizacion_id:'c1', proveedor_id:'v1', proyecto_id:'p1', area:'proyectos', concepto:'Anticipo 50 %', moneda:'GTQ', monto:92500, fase:'pagada', oc_numero:'OC-2026-0001', retencion_tipo:'isr', retencion_isr:4625, retencion_iva:0, monto_a_pagar:87875, creado_por:'u2', creado_at:new Date(t-8*dia).toISOString()},
                      {id:'s2', numero:'SP-2026-0002', cotizacion_id:'c1', proveedor_id:'v1', proyecto_id:'p1', area:'proyectos', concepto:'Segundo pago 30 %', moneda:'GTQ', monto:55500, fase:'oc_emitida', oc_numero:'OC-2026-0002', retencion_isr:0, retencion_iva:0, creado_por:'u2', creado_at:new Date(t-2*dia).toISOString()},
                      {id:'s3', numero:'SP-2026-0003', cotizacion_id:'c2', proveedor_id:'v2', proyecto_id:null, area:'mercadeo', concepto:'Pago total brochures', moneda:'USD', monto:1200, fase:'solicitada', retencion_isr:0, retencion_iva:0, creado_por:'u4', creado_at:new Date(t-1*dia).toISOString()}],
        firmas: [],
        adjuntos: [{id:'a1', cotizacion_id:'c1', tipo:'cotizacion', nombre:'COT-8812.pdf', ruta:'#', subido_at:new Date(t-9*dia).toISOString()},
                   {id:'a2', solicitud_id:'s1', tipo:'factura', nombre:'Factura-A-5512.pdf', ruta:'#', subido_at:new Date(t-6*dia).toISOString()},
                   {id:'a3', solicitud_id:'s1', tipo:'comprobante', nombre:'Transferencia-BI.pdf', ruta:'#', subido_at:new Date(t-5*dia).toISOString()}]
      };
      function f(s, fase, accion, who, dd){ var u = DEMO_USERS.filter(function(x){ return x.id === who; })[0]; d.f1.firmas.push({id:d.f1.firmas.length+1, solicitud_id:s, fase:fase, accion:accion, usuario:who, nombre:u.nombres+' '+u.apellidos, puesto:u.puesto, huella:Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2), creado_at:new Date(t-dd*dia).toISOString()}); }
      f('s1','solicitada','Creó la solicitud de pago','u2',8); f('s1','oc_emitida','Revisó la solicitud y emitió la orden de compra','u0',7.5);
      f('s1','vobo_contable','Dio el VoBo contable','u1',6); f('s1','aprobada','Validó y aprobó para transferir','u0',5.6); f('s1','pagada','Cargó el comprobante y cerró el pago','u1',5);
      f('s2','solicitada','Creó la solicitud de pago','u2',2); f('s2','oc_emitida','Revisó la solicitud y emitió la orden de compra','u0',1.5);
      f('s3','solicitada','Creó la solicitud de pago','u4',1);
      A._save(d);
    }
    return d;
  }
  function F(){ return db().f1; }
  function guardar(fn){ var d = db(); fn(d.f1); A._save(d); }
  function meDemo(){ var k = (location.search.match(/demo=(\w+)/) || [])[1]; try { k = k || sessionStorage.getItem('a2-demo-as'); } catch(e){} return A2Demo.me(k || 'owner') || DEMO_USERS[0]; }
  function vprov(id){ return F().proveedores.filter(function(p){ return p.id === id; })[0]; }
  function vpry(id){ return F().proyectos.filter(function(p){ return p.id === id; })[0]; }
  function emp(id){ return F().empresas.filter(function(e){ return e.id === id; })[0]; }
  function join(x){ var p = vprov(x.proveedor_id), y = vpry(x.proyecto_id); return Object.assign({}, x, {proveedor: p ? {codigo:p.codigo, razon_social:p.razon_social} : null, proyecto: y ? {codigo:y.codigo, nombre:y.nombre} : null}); }

  var demo = {
    getFx: function(){ return P(F().fx); },
    setFx: function(v){ guardar(function(f){ f.fx = Number(v); }); return P(); },
    directorio: function(){ return P(DEMO_USERS.slice()); },

    listEmpresas: function(){ return P(F().empresas.slice()); },
    saveEmpresa: function(e){ guardar(function(f){ if (e.id) f.empresas = f.empresas.map(function(x){ return x.id === e.id ? Object.assign({}, x, e) : x; }); else f.empresas.push(Object.assign({id:uid()}, e)); }); return P(); },
    deleteEmpresa: function(id){ guardar(function(f){ f.empresas = f.empresas.filter(function(x){ return x.id !== id; }); }); return P(); },

    listProyectos: function(){ return P(F().proyectos.map(function(p){ var e = emp(p.empresa_id); return Object.assign({}, p, {empresa: e ? {razon_social:e.razon_social} : null}); })); },
    getProyecto: function(id){
      var p = vpry(id); if (!p) return P(null);
      var f = F(), e = emp(p.empresa_id);
      return P(Object.assign({}, p, {empresa: e || null,
        miembros: f.miembros.filter(function(m){ return m.proyecto_id === id; }).map(function(m){ return Object.assign({funcion:m.funcion, perfil_id:m.perfil_id}, DEMO_USERS.filter(function(u){ return u.id === m.perfil_id; })[0]); }),
        proveedores: f.pp.filter(function(x){ return x.proyecto_id === id; }).map(function(x){ return Object.assign({servicio:x.servicio}, vprov(x.proveedor_id)); })}));
    },
    saveProyecto: function(p){ var id = p.id || uid(); guardar(function(f){ var d = Object.assign({}, p); delete d.empresa; delete d.miembros; delete d.proveedores;
      if (p.id) f.proyectos = f.proyectos.map(function(x){ return x.id === p.id ? Object.assign({}, x, d) : x; }); else f.proyectos.push(Object.assign(d, {id:id})); }); return P({id:id}); },
    deleteProyecto: function(id){ guardar(function(f){ f.proyectos = f.proyectos.filter(function(x){ return x.id !== id; }); }); return P(); },
    addMiembro: function(pid, perfil, funcion){ guardar(function(f){ f.miembros = f.miembros.filter(function(m){ return !(m.proyecto_id === pid && m.perfil_id === perfil); }); f.miembros.push({proyecto_id:pid, perfil_id:perfil, funcion:funcion}); }); return P(); },
    removeMiembro: function(pid, perfil){ guardar(function(f){ f.miembros = f.miembros.filter(function(m){ return !(m.proyecto_id === pid && m.perfil_id === perfil); }); }); return P(); },
    addProveedorProyecto: function(pid, prv, servicio){ guardar(function(f){ f.pp = f.pp.filter(function(x){ return !(x.proyecto_id === pid && x.proveedor_id === prv); }); f.pp.push({proyecto_id:pid, proveedor_id:prv, servicio:servicio}); }); return P(); },
    removeProveedorProyecto: function(pid, prv){ guardar(function(f){ f.pp = f.pp.filter(function(x){ return !(x.proyecto_id === pid && x.proveedor_id === prv); }); }); return P(); },

    listProveedores: function(){ return P(F().proveedores.slice()); },
    getProveedor: function(id){ var p = vprov(id); if (!p) return P(null); var f = F();
      return P(Object.assign({}, p, {banco: f.bancos.filter(function(b){ return b.proveedor_id === id; })[0] || null,
        proyectos: f.pp.filter(function(x){ return x.proveedor_id === id; }).map(function(x){ return Object.assign({servicio:x.servicio}, vpry(x.proyecto_id)); })})); },
    saveProveedor: function(p, banco){ var id = p.id || uid(), codigo;
      guardar(function(f){ var d = Object.assign({}, p); delete d.banco; delete d.proyectos;
        if (p.id) f.proveedores = f.proveedores.map(function(x){ return x.id === p.id ? Object.assign({}, x, d) : x; });
        else { codigo = 'PRV-' + String(f.proveedores.length + 1).padStart(4, '0'); f.proveedores.push(Object.assign(d, {id:id, codigo:codigo, activo:true})); }
        if (banco) { f.bancos = f.bancos.filter(function(b){ return b.proveedor_id !== id; }); f.bancos.push(Object.assign({proveedor_id:id}, banco)); } });
      return P({id:id, codigo:codigo}); },

    listCotizaciones: function(){ return P(F().cotizaciones.map(join)); },
    createCotizacion: function(c, file){ var cot = Object.assign({id:uid(), estado:'vigente', creado_por:meDemo().id, creado_at:new Date().toISOString()}, c);
      guardar(function(f){ f.cotizaciones.unshift(cot); if (file) f.adjuntos.push({id:uid(), cotizacion_id:cot.id, tipo:'cotizacion', nombre:file.name, ruta:'#', subido_at:new Date().toISOString()}); });
      return P(cot); },

    listSolicitudes: function(){ return P(F().solicitudes.map(join)); },
    getSolicitud: function(id){ var f = F(), s = f.solicitudes.filter(function(x){ return x.id === id; })[0]; if (!s) return P(null);
      var x = join(s), p = vprov(s.proveedor_id);
      x.proveedor = Object.assign({id:p.id}, x.proveedor, {correo:p.correo, nit:p.nit});
      x.cotizacion = f.cotizaciones.filter(function(c){ return c.id === s.cotizacion_id; })[0];
      x.firmas = f.firmas.filter(function(z){ return z.solicitud_id === id; });
      x.adjuntos = f.adjuntos.filter(function(a){ return a.solicitud_id === id || a.cotizacion_id === s.cotizacion_id; });
      x.hermanas = f.solicitudes.filter(function(z){ return z.cotizacion_id === s.cotizacion_id; });
      x.banco = f.bancos.filter(function(b){ return b.proveedor_id === s.proveedor_id; })[0] || null;
      return P(x); },
    crearSolicitud: function(d){
      var f = F(), c = f.cotizaciones.filter(function(x){ return x.id === d.cotizacion_id; })[0], me = meDemo();
      var disp = A.saldos([c], f.solicitudes)[0].disponible;
      if (Number(d.monto) > disp + 0.001) return R('El monto supera el saldo disponible de la cotización.');
      var s = {id:uid(), numero:'SP-2026-' + String(f.solicitudes.length + 1).padStart(4,'0'), cotizacion_id:c.id, proveedor_id:c.proveedor_id, proyecto_id:c.proyecto_id, area:c.area,
               concepto:d.concepto, moneda:c.moneda, monto:Number(d.monto), fase:'solicitada', retencion_isr:0, retencion_iva:0, creado_por:me.id, creado_at:new Date().toISOString()};
      guardar(function(f){ f.solicitudes.unshift(s); f.firmas.push({id:f.firmas.length+1, solicitud_id:s.id, fase:'solicitada', accion:'Creó la solicitud de pago', usuario:me.id, nombre:me.nombres+' '+me.apellidos, puesto:me.puesto, nota:d.nota||null, huella:Math.random().toString(16).slice(2)+'demo', creado_at:new Date().toISOString()}); });
      return P({ok:true, id:s.id, numero:s.numero}); },
    avanzar: function(id, d){
      d = d || {}; var me = meDemo(), f = F(), s = f.solicitudes.filter(function(x){ return x.id === id; })[0];
      var orden = ['solicitada','oc_emitida','vobo_contable','aprobada','pagada'], i = orden.indexOf(s.fase); if (i < 0 || i > 3) return R('Esta solicitud ya está cerrada.');
      var fase = A.fase(s.fase); if (!A.can(me, fase.permiso)) return R('No tenés permiso para autorizar esta fase.');
      var tipos = f.adjuntos.filter(function(a){ return a.solicitud_id === id; }).map(function(a){ return a.tipo; });
      if (s.fase === 'oc_emitida' && tipos.indexOf('factura') < 0) return R('Adjuntá la factura antes de dar el VoBo contable.');
      if (s.fase === 'aprobada' && tipos.indexOf('comprobante') < 0) return R('Adjuntá el comprobante de la transferencia para cerrar el pago.');
      var textos = {solicitada:'Revisó la solicitud y emitió la orden de compra', oc_emitida:'Dio el VoBo contable', vobo_contable:'Validó y aprobó para transferir', aprobada:'Cargó el comprobante y cerró el pago'};
      guardar(function(f){ f.solicitudes.forEach(function(x){ if (x.id !== id) return;
        if (x.fase === 'solicitada') x.oc_numero = 'OC-2026-' + String(f.solicitudes.filter(function(z){ return z.oc_numero; }).length + 1).padStart(4,'0');
        if (x.fase === 'oc_emitida') { x.retencion_tipo = d.retencion_tipo || 'ninguna'; x.retencion_isr = Number(d.retencion_isr || 0); x.retencion_iva = Number(d.retencion_iva || 0); x.retencion_nota = d.retencion_nota; x.monto_a_pagar = x.monto - x.retencion_isr - x.retencion_iva; }
        f.firmas.push({id:f.firmas.length+1, solicitud_id:id, fase:orden[i+1], accion:textos[x.fase], usuario:me.id, nombre:me.nombres+' '+me.apellidos, puesto:me.puesto, nota:d.nota||null, huella:Math.random().toString(16).slice(2)+'demo', creado_at:new Date().toISOString()});
        x.fase = orden[i+1]; }); });
      return P({ok:true}); },
    rechazar: function(id, motivo){ var me = meDemo();
      guardar(function(f){ f.solicitudes.forEach(function(x){ if (x.id !== id) return; x.rechazada_en = x.fase; x.fase = 'rechazada'; x.rechazo_motivo = motivo; });
        f.firmas.push({id:f.firmas.length+1, solicitud_id:id, fase:'rechazada', accion:'Rechazó la solicitud', usuario:me.id, nombre:me.nombres+' '+me.apellidos, puesto:me.puesto, nota:motivo, huella:'demo', creado_at:new Date().toISOString()}); });
      return P({ok:true}); },
    uploadAdjunto: function(padre, tipo, file){ guardar(function(f){ f.adjuntos.push(Object.assign({id:uid(), tipo:tipo, nombre:file.name, ruta:'#', subido_at:new Date().toISOString()}, padre)); }); return P(); },
    urlAdjunto: function(){ return P('#'); }
  };

  Object.assign(A, A.live ? live : demo);
})();

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
  A.ESTADOS_PROVEEDOR = {
    solicitado:  {n:'Solicitó código',        corto:'Solicitud',      paso:1},
    en_registro: {n:'Completando registro',   corto:'En registro',    paso:2},
    en_revision: {n:'Expediente por aprobar', corto:'Por aprobar',    paso:3},
    corregir:    {n:'Correcciones pedidas',   corto:'Corrigiendo',    paso:2},
    aprobado:    {n:'Aprobado',               corto:'Aprobado',       paso:4}
  };
  var MIME_DOC = {pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', jfif:'image/jpeg', webp:'image/webp', heic:'image/heic', heif:'image/heif', gif:'image/gif', tif:'image/tiff', tiff:'image/tiff', bmp:'image/bmp'};
  function extDe(n){ var m = /\.([a-z0-9]+)\s*$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; }
  A.docPermitido = function(file){
    if (!file) return false;
    var t = (file.type || '').toLowerCase();
    return !!MIME_DOC[extDe(file.name)] || t === 'application/pdf' || t.indexOf('image/') === 0;
  };
  A.tipoArchivo = function(file){
    var t = (file.type || '').toLowerCase();
    return (t && t !== 'application/octet-stream') ? t : (MIME_DOC[extDe(file.name)] || 'application/octet-stream');
  };
  A.errorSubida = function(e){
    var m = String((e && (e.message || e.error)) || e || '');
    if (/mime|content.?type|not supported/i.test(m)) return 'El almacenamiento rechazó este tipo de archivo. Avisale a A2 para habilitar PDF e imágenes (' + m + ').';
    if (/size|too large|exceed|413/i.test(m)) return 'El archivo es demasiado grande para el almacenamiento (' + m + ').';
    if (/row.level|policy|unauthori|403|permission/i.test(m)) return 'No tenés permiso para cargar en esta carpeta. Volvé a iniciar sesión e intentá de nuevo (' + m + ').';
    return 'No se pudo cargar el archivo: ' + (m || 'error desconocido') + '.';
  };
  A.DOCS_PROVEEDOR = [
    {id:'rep_legal',        n:'Representación legal',          d:'Nombramiento o acta de representación legal vigente.', req:true},
    {id:'dpi_rep',          n:'DPI del representante legal',   d:'Ambos lados, legible.', req:true},
    {id:'rtu',              n:'RTU',                           d:'Constancia de inscripción y actualización en el RTU de la SAT.', req:true},
    {id:'patente_comercio', n:'Patente de comercio',           d:'Patente de comercio de empresa.', req:true},
    {id:'patente_sociedad', n:'Patente de sociedad',           d:'Solo si es sociedad anónima u otra sociedad.', req:false}
  ];
  A.DOCS_INDIVIDUAL = [
    {id:'dpi',              n:'DPI',                           d:'Tu Documento Personal de Identificación, ambos lados.', req:true},
    {id:'rtu',              n:'RTU',                           d:'Constancia de inscripción y actualización en el RTU de la SAT.', req:true},
    {id:'patente_comercio', n:'Patente de comercio',           d:'Solo si operás con un nombre comercial.', req:false}
  ];
  /* documentos que aplican según sea persona individual o empresa */
  A.docsProveedor = function(p){ return p && p.tipo_persona === 'individual' ? A.DOCS_INDIVIDUAL : A.DOCS_PROVEEDOR; };
  A.esIndividual = function(p){ return !!p && p.tipo_persona === 'individual'; };
  A.NOMBRE_DOC = {cuenta:'Cheque anulado o encabezado de cuenta', otro:'Otro documento'};
  A.DOCS_PROVEEDOR.concat(A.DOCS_INDIVIDUAL).forEach(function(d){ A.NOMBRE_DOC[d.id] = d.n; });
  A.REGIMENES_ISR = ['Régimen sobre las utilidades de actividades lucrativas', 'Régimen opcional simplificado sobre ingresos', 'Pequeño contribuyente', 'Exento', 'Otro'];
  /* ¿qué pasos del registro ya completó el proveedor? */
  A.pasosProveedor = function(x){
    var p = x.proveedor, docs = x.documentos || [], ctas = x.cuentas || [];
    var tipos = {}; docs.forEach(function(d){ tipos[d.tipo] = 1; });
    var docsOk = A.docsProveedor(p).every(function(d){ return !d.req || tipos[d.id]; });
    var ctasOk = ctas.length > 0 && ctas.every(function(c){ return docs.some(function(d){ return d.cuenta_id === c.id; }); });
    return {codigo: !!p.codigo_validado_at, datos: !!p.datos_at, terminos: !!p.terminos_at, documentos: docsOk, cuentas: ctasOk, enviado: p.estado === 'en_revision' || p.estado === 'aprobado'};
  };
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
      var vacio = function(r){ return r.data || []; };
      return Promise.all([
        sb.from('proveedores').select('*').eq('id', id).maybeSingle().then(ok),
        sb.from('proveedor_bancos').select('*').eq('proveedor_id', id).order('creado_at').then(vacio),
        sb.from('proyecto_proveedores').select('servicio, proyecto:proyectos(id, codigo, nombre)').eq('proveedor_id', id).then(vacio),
        sb.from('proveedor_expediente').select('*').eq('proveedor_id', id).maybeSingle().then(function(r){ return r.data || null; }),
        sb.from('proveedor_documentos').select('*').eq('proveedor_id', id).order('subido_at', {ascending:false}).then(vacio),
        sb.from('proveedor_historial').select('*').eq('proveedor_id', id).order('id').then(vacio)
      ]).then(function(r){ if (!r[0]) return null; var p = r[0];
        p.cuentas = r[1]; p.banco = r[1].filter(function(c){ return c.principal; })[0] || r[1][0] || null;
        p.proyectos = r[2].map(function(x){ return Object.assign({servicio:x.servicio}, x.proyecto); });
        p.expediente = r[3]; p.documentos = r[4]; p.historial = r[5]; return p; });
    },
    saveProveedor: function(p, banco){ var d = Object.assign({}, p); var id = d.id;
      ['id','banco','cuentas','proyectos','codigo','expediente','documentos','historial'].forEach(function(k){ delete d[k]; });
      return (id ? sb.from('proveedores').update(d).eq('id', id).select('id').single() : sb.from('proveedores').insert(d).select('id, codigo').single()).then(ok)
        .then(function(r){ if (!banco) return r; var bid = banco.id; var bd = Object.assign({}, banco); delete bd.id;
          return (bid ? sb.from('proveedor_bancos').update(bd).eq('id', bid) : sb.from('proveedor_bancos').insert(Object.assign({proveedor_id: r.id, principal:true}, bd))).then(ok).then(function(){ return r; }); }); },

    /* Registro de proveedores: todo pasa por la función "proveedores" */
    provAccion: function(accion, d){ return A._invoke('proveedores', Object.assign({accion:accion}, d || {})); },
    subirDocProveedor: function(provId, tipo, file, cuentaId){
      if (!A.docPermitido(file)) return R('Ese tipo de archivo no se puede cargar. Usá un PDF o una imagen (JPG, PNG, HEIC, etc.).');
      if (file.size > 20 * 1024 * 1024) return R('El archivo pesa más de 20 MB.');
      var limpio = file.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80);
      var r = 'proveedores/' + provId + '/' + tipo + '/' + uid() + '-' + limpio;
      return sb.storage.from('a2-docs').upload(r, file, {contentType: A.tipoArchivo(file), upsert:false})
        .then(function(res){ if (res.error) throw A.errorSubida(res.error); return res.data; })
        .then(function(){ return live.provAccion('registrar_documento', {tipo:tipo, nombre:file.name, ruta:r, cuenta_id:cuentaId || null}); });
    },
    eliminarSolicitud: function(id, motivo){ return A._invoke('pagos', {accion:'eliminar', id:id, nota:motivo}); },
    cambiarCuenta: function(id, cuentaId){ return A._invoke('pagos', {accion:'cuenta', id:id, cuenta_id:cuentaId}); },

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
      return sb.from('solicitudes_pago').select('*, proveedor:proveedores(id, codigo, razon_social, correo, nit, regimen_isr), proyecto:proyectos(id, codigo, nombre), cotizacion:cotizaciones(*)').eq('id', id).maybeSingle().then(ok).then(function(s){
        if (!s) return null;
        return Promise.all([
          sb.from('firmas').select('*').eq('solicitud_id', id).order('id').then(ok),
          sb.from('adjuntos').select('*').or('solicitud_id.eq.' + id + ',cotizacion_id.eq.' + s.cotizacion_id).order('subido_at').then(ok),
          sb.from('solicitudes_pago').select('monto, fase').eq('cotizacion_id', s.cotizacion_id).then(ok),
          sb.from('proveedor_bancos').select('*').eq('proveedor_id', s.proveedor_id).order('creado_at').then(function(r){ return r.data || []; })
        ]).then(function(r){ s.firmas = r[0]; s.adjuntos = r[1]; s.hermanas = r[2]; s.cuentas = r[3];
          s.banco = r[3].filter(function(c){ return c.id === s.cuenta_id; })[0] || null; return s; });
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
    if (!d.f1.prov2) {   /* registro de proveedores: datos demo */
      var t2 = Date.now(), dd = 864e5, f = d.f1;
      f.prov2 = true; f.expedientes = f.expedientes || []; f.documentos = f.documentos || []; f.historial = f.historial || []; f.eliminaciones = [];
      f.proveedores.forEach(function(p){ p.estado = p.estado || 'aprobado'; });
      f.bancos.forEach(function(b, i){ b.id = b.id || 'b' + (i + 1); b.principal = true; b.verificada = true; b.correo_notificacion = b.correo_notificacion || null; });
      f.solicitudes.forEach(function(s){ if (s.cuenta_id === undefined) { var b = f.bancos.filter(function(x){ return x.proveedor_id === s.proveedor_id; })[0]; s.cuenta_id = b ? b.id : null; } });
      f.proveedores.push({id:'v3', codigo:'PRV-0003', razon_social:'Electro Instalaciones Pacífico, S.A.', nombre_comercial:'ElectroPacífico', nit:'9876543-2', rubro:'Instalaciones eléctricas',
        regimen_isr:'Régimen sobre las utilidades de actividades lucrativas', correo:'admin@electropacifico.gt', telefono:'+502 2333 4455', direccion:'12 calle 5-40 zona 9, Guatemala', web:'electropacifico.gt',
        contacto:{nombre:'Diego', apellido:'Morales', sexo:'M', titulo:'Ing.', puesto:'Gerente comercial', telefono:'+502 5511 2233', correo:'dmorales@electropacifico.gt'}, contacto_nombre:'Diego Morales',
        estado:'en_revision', activo:false, usuario_id:'pv3', solicitado_at:new Date(t2-5*dd).toISOString(), codigo_validado_at:new Date(t2-4*dd).toISOString(), datos_at:new Date(t2-4*dd).toISOString(),
        terminos_at:new Date(t2-4*dd).toISOString(), diligencia_at:new Date(t2-3*dd).toISOString(), enviado_at:new Date(t2-3*dd).toISOString()});
      f.proveedores.push({id:'v4', codigo:null, razon_social:'Ferretería El Martillo, S.A.', nombre_comercial:'El Martillo', nit:'5554443-1', correo:'compras@elmartillo.gt', telefono:'+502 2444 1100',
        estado:'solicitado', activo:false, usuario_id:'pv4', solicitado_at:new Date(t2-0.5*dd).toISOString()});
      f.expedientes.push({proveedor_id:'v3', representante:{nombre:'Roberto', apellido:'Morales', dpi:'2546 78912 0101', sexo:'M', titulo:'Lic.', puesto:'Gerente general', telefono:'+502 5511 0000', correo:'rmorales@electropacifico.gt'},
        fecha_constitucion:'2011-03-14', referencias:[{nombre:'Constructora Alfa', telefono:'+502 2222 9090'},{nombre:'Grupo Delta', telefono:'+502 2333 8080'}]});
      f.bancos.push({id:'b9', proveedor_id:'v3', banco:'Banrural', tipo_cuenta:'Monetaria', nombre_cuenta:'Electro Instalaciones Pacífico, S.A.', numero_cuenta:'3-445-12345-6', moneda:'GTQ', correo_notificacion:'pagos@electropacifico.gt', principal:true, verificada:false});
      ['rep_legal','dpi_rep','rtu','patente_comercio','patente_sociedad'].forEach(function(tp){ f.documentos.push({id:'d-' + tp, proveedor_id:'v3', tipo:tp, nombre:tp.replace('_','-') + '.pdf', ruta:'#', subido_at:new Date(t2-3.2*dd).toISOString()}); });
      f.documentos.push({id:'d-cta', proveedor_id:'v3', cuenta_id:'b9', tipo:'cuenta', nombre:'cheque-anulado.jpg', ruta:'#', subido_at:new Date(t2-3.1*dd).toISOString()});
      [['v3','Solicitó código de proveedor',null,'ElectroPacífico',true,5],['v3','Autorizó la solicitud y asignó el código','PRV-0003','Mauricio Urruela',false,4.5],['v3','Validó su código de acceso',null,'ElectroPacífico',true,4],
       ['v3','Completó sus datos',null,'ElectroPacífico',true,4],['v3','Aceptó los términos y condiciones',null,'ElectroPacífico',true,4],['v3','Envió su expediente para aprobación','Aceptó la declaración de veracidad y autorización de verificación','ElectroPacífico',true,3],
       ['v4','Solicitó código de proveedor',null,'El Martillo',true,0.5]].forEach(function(h, i){
        f.historial.push({id:i + 1, proveedor_id:h[0], accion:h[1], detalle:h[2], nombre:h[3], es_proveedor:h[4], creado_at:new Date(t2-h[5]*dd).toISOString()}); });
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

  /* ---------- Registro de proveedores en modo demo ---------- */
  function sigCodigo(f){ var n = f.proveedores.reduce(function(m, p){ var k = Number(String(p.codigo || '').replace(/\D/g, '')); return k > m ? k : m; }, 0); return 'PRV-' + String(n + 1).padStart(4, '0'); }
  function nitL(n){ return String(n || '').toUpperCase().replace(/[^0-9K]/g, ''); }
  function demoProvId(){ var id; try { id = sessionStorage.getItem('a2-demo-prov'); } catch(e){} return id || F().demoProv || 'v3'; }
  A2Demo.provId = demoProvId;
  A2Demo.setProv = function(id){ try { sessionStorage.setItem('a2-demo-prov', id); sessionStorage.setItem('a2-demo-as', 'proveedor'); } catch(e){} };
  var meBase = A2Demo.me;
  A2Demo.me = function(k){ if (k === 'proveedor') { var p = vprov(demoProvId()); return p ? {tipo:'proveedor', id:p.usuario_id || 'pv', correo:p.correo, proveedor_id:p.id} : null; } return meBase(k); };
  function hist(f, id, accion, detalle, prov){ var me = meDemo(), p = f.proveedores.filter(function(x){ return x.id === id; })[0] || {};
    f.historial.push({id:f.historial.length + 1, proveedor_id:id, accion:accion, detalle:detalle || null, es_proveedor:!!prov,
      nombre: prov ? (p.nombre_comercial || p.razon_social) : me.nombres + ' ' + me.apellidos, creado_at:new Date().toISOString()}); }
  function upd(f, id, cambios){ f.proveedores.forEach(function(p){ if (p.id === id) Object.assign(p, cambios); }); }
  function provDemo(accion, d){
    var f = F(), ahora = new Date().toISOString();
    if (accion === 'solicitar') {
      var tipoP = d.tipo === 'individual' ? 'individual' : 'juridica';
      if (tipoP === 'individual') { d.razon_social = d.empresa; d.empresa = d.nombre_comercial || d.empresa; }
      if (!d.empresa || !d.razon_social || !d.nit || !d.correo || !d.telefono) return R('Completá todos los campos.');
      if (f.proveedores.some(function(p){ return nitL(p.nit) === nitL(d.nit); })) return R('Ya hay un proveedor registrado con ese NIT. Si es tu empresa, ingresá con tu correo y contraseña, o escribinos a info@a2desarrollos.com.');
      if (f.proveedores.some(function(p){ return (p.correo || '').toLowerCase() === d.correo.toLowerCase() && p.usuario_id; })) return R('Ese correo ya tiene una cuenta. Ingresá desde Log In con tu contraseña.');
      var nid = uid();
      guardar(function(f){ f.proveedores.push({id:nid, codigo:null, tipo_persona:tipoP, razon_social:d.razon_social, nombre_comercial:d.empresa, nit:d.nit, correo:d.correo.toLowerCase(), telefono:d.telefono, estado:'solicitado', activo:false, usuario_id:'pv-' + nid, solicitado_at:ahora});
        f.demoProv = nid; hist(f, nid, 'Solicitó código de proveedor', null, true); });
      A2Demo.setProv(nid); return P({ok:true, id:nid});
    }
    var staff = !d._prov && meDemo() && !/^pv/.test(meDemo().id || '') && accion.indexOf('decidir') === 0 || ['reenviar_codigo','verificar_cuenta','eliminar'].indexOf(accion) > -1;
    if (staff) {
      var me = meDemo(), x = vprov(d.id); if (!x) return R('No encontramos este proveedor.');
      var aprueba = A.can(me, 'aprobar_proveedores');
      if (accion === 'decidir_solicitud') {
        if (!aprueba) return R('No tenés permiso para aprobar proveedores.');
        if (x.estado !== 'solicitado') return R('Esta solicitud ya fue procesada.');
        if (d.decision === 'rechazar') { guardar(function(f){ f.proveedores = f.proveedores.filter(function(p){ return p.id !== x.id; }); f.eliminaciones.push({tipo:'proveedor', registro_id:x.id, descripcion:'Solicitud rechazada: ' + x.razon_social, motivo:d.motivo}); }); return P({ok:true, eliminado:true}); }
        var code = 'DEMO' + Math.floor(10 + Math.random() * 89), cod = sigCodigo(f);
        guardar(function(f){ upd(f, x.id, {estado:'en_registro', codigo:cod, _demoCode:code}); hist(f, x.id, 'Autorizó la solicitud y asignó el código', cod); });
        return P({ok:true, codigo:cod, demoCode:code});
      }
      if (accion === 'reenviar_codigo') { if (!aprueba) return R('No tenés permiso para aprobar proveedores.'); var c2 = 'DEMO' + Math.floor(10 + Math.random() * 89);
        guardar(function(f){ upd(f, x.id, {_demoCode:c2}); hist(f, x.id, 'Reenvió el código de acceso'); }); return P({ok:true, demoCode:c2}); }
      if (accion === 'decidir_registro') {
        if (!aprueba) return R('No tenés permiso para aprobar proveedores.');
        if (x.estado !== 'en_revision') return R('Este expediente no está pendiente de aprobación.');
        if (d.decision === 'corregir') { if (!d.motivo) return R('Indicá qué debe corregir el proveedor.');
          guardar(function(f){ upd(f, x.id, {estado:'corregir', observaciones:d.motivo}); hist(f, x.id, 'Pidió correcciones', d.motivo); }); return P({ok:true}); }
        guardar(function(f){ upd(f, x.id, {estado:'aprobado', activo:true, observaciones:null, aprobado_at:ahora}); f.bancos.forEach(function(b){ if (b.proveedor_id === x.id) b.verificada = true; }); hist(f, x.id, 'Aprobó el registro del proveedor', d.motivo); });
        return P({ok:true});
      }
      if (accion === 'verificar_cuenta') { if (!aprueba) return R('No tenés permiso para verificar cuentas.');
        guardar(function(f){ f.bancos.forEach(function(b){ if (b.id === d.cuenta_id) { b.verificada = true; hist(f, x.id, 'Verificó una cuenta bancaria', b.banco + ' · ' + b.numero_cuenta); } }); }); return P({ok:true}); }
      if (accion === 'eliminar') {
        if (!A.inArea(me, 'admin') && !aprueba) return R('Solo Administración o quien aprueba proveedores puede eliminar registros.');
        if (f.cotizaciones.some(function(c){ return c.proveedor_id === x.id; })) return R('Este proveedor ya tiene cotizaciones o pagos registrados. En lugar de eliminarlo, desactivalo.');
        guardar(function(f){ f.proveedores = f.proveedores.filter(function(p){ return p.id !== x.id; }); f.eliminaciones.push({tipo:'proveedor', registro_id:x.id, descripcion:'Proveedor eliminado: ' + x.razon_social, motivo:d.motivo}); });
        return P({ok:true});
      }
    }
    /* ----- lado del proveedor ----- */
    var id = d._prov || demoProvId(), p = vprov(id); if (!p) return R('Tu cuenta no está asociada a ningún proveedor.');
    function cuentas(){ return F().bancos.filter(function(b){ return b.proveedor_id === id; }); }
    function docs(){ return F().documentos.filter(function(x){ return x.proveedor_id === id; }).sort(function(a, b){ return a.subido_at < b.subido_at ? 1 : -1; }); }
    if (accion === 'yo') { var cp = Object.assign({}, p); delete cp._demoCode; delete cp.notas;
      return P({proveedor:cp, cuentas:cuentas(), documentos:docs(), expediente:F().expedientes.filter(function(e){ return e.proveedor_id === id; })[0] || null, demoCode:p._demoCode}); }
    if (accion === 'validar_codigo') {
      if (p.estado === 'solicitado') return R('Tu solicitud todavía está en revisión.');
      if (p.codigo_validado_at) return P({ok:true});
      if (String(d.codigo || '').toUpperCase() !== String(p._demoCode || '').toUpperCase()) return R('El código no coincide. Revisá el correo e intentá de nuevo.');
      guardar(function(f){ upd(f, id, {codigo_validado_at:ahora, _demoCode:null}); hist(f, id, 'Validó su código de acceso', null, true); }); return P({ok:true});
    }
    if (!p.codigo_validado_at || p.estado === 'en_revision' || p.estado === 'solicitado') return R(p.estado === 'en_revision' ? 'Tu expediente está en revisión; podrás editarlo cuando A2 responda.' : 'Primero validá tu código de acceso.');
    var aprobado = p.estado === 'aprobado';
    if (accion === 'guardar_datos') { var x2 = d.datos || {}, c = x2.contacto || {}, r = x2.representante || {}, falta = [];
      var ind = A.esIndividual(p), dpiOk = String(r.dpi || '').replace(/\D/g, '').length === 13;
      if (ind && !c.nombre) c = {nombre:r.nombre, apellido:r.apellido, sexo:r.sexo, titulo:r.titulo, puesto:r.puesto, telefono:r.telefono, correo:r.correo};
      if (!aprobado && (!x2.razon_social || !x2.nit)) falta.push(ind ? 'nombre completo y NIT' : 'razón social y NIT');
      if (!x2.telefono || !x2.direccion) falta.push('teléfonos y dirección');
      if (!ind && (!c.nombre || !c.apellido || !c.sexo || !c.puesto || !c.telefono || !c.correo)) falta.push('datos de contacto directo');
      if (ind ? (!r.nombre || !r.apellido || !r.sexo || !r.telefono || !r.correo || !dpiOk) : (!r.nombre || !r.sexo || !r.puesto || !r.telefono || !r.correo || !dpiOk))
        falta.push(ind ? 'tus datos personales (el DPI tiene 13 dígitos)' : 'datos del representante legal (el DPI tiene 13 dígitos)');
      if (!x2.rubro || (!ind && !x2.fecha_constitucion) || !x2.regimen_isr) falta.push('servicios a proveer');
      if (!(x2.referencias || []).some(function(z){ return z.nombre && z.telefono; })) falta.push('al menos una referencia');
      if (falta.length) return R('Falta: ' + falta.join(', ') + '.');
      guardar(function(f){ var cm = {telefono:x2.telefono, direccion:x2.direccion, web:x2.web, rubro:x2.rubro, regimen_isr:x2.regimen_isr, contacto:c, contacto_nombre:c.nombre + ' ' + c.apellido, datos_at:p.datos_at || ahora};
        if (!aprobado) { cm.razon_social = x2.razon_social; cm.nit = x2.nit; } upd(f, id, cm);
        f.expedientes = f.expedientes.filter(function(e){ return e.proveedor_id !== id; }); f.expedientes.push({proveedor_id:id, representante:r, fecha_constitucion:x2.fecha_constitucion, referencias:(x2.referencias || []).filter(function(z){ return z.nombre || z.telefono; })});
        hist(f, id, p.datos_at ? 'Actualizó sus datos' : 'Completó sus datos', null, true); });
      return P({ok:true}); }
    if (accion === 'aceptar_terminos') { if (d.acepto !== true) return R('Tenés que aceptar los términos y condiciones para continuar.');
      if (!p.terminos_at) guardar(function(f){ upd(f, id, {terminos_at:ahora, terminos_version:d.version}); hist(f, id, 'Aceptó los términos y condiciones', 'Versión ' + d.version, true); }); return P({ok:true}); }
    if (accion === 'registrar_documento') { guardar(function(f){ f.documentos.push({id:uid(), proveedor_id:id, cuenta_id:d.cuenta_id || null, tipo:d.tipo, nombre:d.nombre, ruta:'#', subido_at:ahora}); hist(f, id, 'Cargó: ' + A.NOMBRE_DOC[d.tipo], d.nombre, true); }); return P({ok:true}); }
    if (accion === 'guardar_cuenta') { var k = d.cuenta || {}, cid = k.id;
      if (!k.banco || !k.tipo_cuenta || !k.nombre_cuenta || !k.numero_cuenta) return R('Completá banco, tipo de cuenta, nombre y número de cuenta.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k.correo_notificacion || '')) return R('Ingresá un correo válido para las notificaciones de pago.');
      guardar(function(f){ var datos = {banco:k.banco, tipo_cuenta:k.tipo_cuenta, nombre_cuenta:k.nombre_cuenta, numero_cuenta:k.numero_cuenta, moneda:k.moneda || 'GTQ', correo_notificacion:k.correo_notificacion};
        if (cid) f.bancos.forEach(function(b){ if (b.id === cid) { var sens = b.banco !== datos.banco || b.numero_cuenta !== datos.numero_cuenta || b.nombre_cuenta !== datos.nombre_cuenta || b.tipo_cuenta !== datos.tipo_cuenta || b.moneda !== datos.moneda;
          Object.assign(b, datos); if (sens && aprobado) { b.verificada = false; hist(f, id, 'Modificó una cuenta bancaria', datos.banco + ' · ' + datos.numero_cuenta, true); } } });
        else { cid = uid(); var hay = f.bancos.some(function(b){ return b.proveedor_id === id; }); f.bancos.push(Object.assign({id:cid, proveedor_id:id, principal:!hay, verificada:false}, datos)); hist(f, id, 'Agregó una cuenta bancaria', datos.banco + ' · ' + datos.numero_cuenta, true); }
        if (k.principal) f.bancos.forEach(function(b){ if (b.proveedor_id === id) b.principal = b.id === cid; }); });
      return P({ok:true, id:cid}); }
    if (accion === 'eliminar_cuenta') { var ls = cuentas(), ct = ls.filter(function(b){ return b.id === d.id; })[0]; if (!ct) return R('No encontramos esa cuenta.');
      if (aprobado && ls.length <= 1) return R('Necesitás al menos una cuenta registrada. Agregá otra antes de eliminar esta.');
      guardar(function(f){ f.bancos = f.bancos.filter(function(b){ return b.id !== ct.id; }); f.documentos = f.documentos.filter(function(x){ return x.cuenta_id !== ct.id; });
        if (ct.principal) { var o = f.bancos.filter(function(b){ return b.proveedor_id === id; })[0]; if (o) o.principal = true; } hist(f, id, 'Eliminó una cuenta bancaria', ct.banco + ' · ' + ct.numero_cuenta, true); });
      return P({ok:true}); }
    if (accion === 'enviar') { if (d.acepto !== true) return R('Tenés que aceptar la declaración para enviar tu registro.');
      var est = A.pasosProveedor({proveedor:p, documentos:docs(), cuentas:cuentas()});
      if (!est.datos || !est.terminos || !est.documentos || !est.cuentas) return R('Para enviar falta completar: ' + [!est.datos && 'tus datos', !est.terminos && 'términos y condiciones', !est.documentos && 'documentos', !est.cuentas && 'cuentas bancarias con su cheque anulado o encabezado'].filter(Boolean).join(', ') + '.');
      guardar(function(f){ upd(f, id, {estado:'en_revision', diligencia_at:ahora, diligencia_version:d.version, enviado_at:ahora}); hist(f, id, p.estado === 'corregir' ? 'Reenvió su expediente con correcciones' : 'Envió su expediente para aprobación', 'Aceptó la declaración de veracidad y autorización de verificación', true); });
      return P({ok:true}); }
    return R('Acción no válida.');
  }

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
    getProveedor: function(id){ var p = vprov(id); if (!p) return P(null); var f = F(), me = meDemo();
      var ve = A.can(me, 'ver_expediente_proveedor') || A.can(me, 'aprobar_proveedores') || A.can(me, 'gestionar_proveedores');
      var vb = ve || A.inArea(me, 'admin') || ['revisar_solicitud','vobo_contable','aprobar_pago','registrar_pago'].some(function(x){ return A.can(me, x); });
      var ctas = vb ? f.bancos.filter(function(b){ return b.proveedor_id === id; }) : [];
      return P(Object.assign({}, p, {cuentas: ctas, banco: ctas.filter(function(c){ return c.principal; })[0] || ctas[0] || null,
        expediente: ve ? (f.expedientes.filter(function(e){ return e.proveedor_id === id; })[0] || null) : null,
        documentos: ve ? f.documentos.filter(function(d){ return d.proveedor_id === id; }).sort(function(a, b){ return a.subido_at < b.subido_at ? 1 : -1; }) : [],
        historial: (ve || A.inArea(me, 'admin')) ? f.historial.filter(function(h){ return h.proveedor_id === id; }) : [],
        proyectos: f.pp.filter(function(x){ return x.proveedor_id === id; }).map(function(x){ return Object.assign({servicio:x.servicio}, vpry(x.proyecto_id)); })})); },
    saveProveedor: function(p, banco){ var id = p.id || uid(), codigo;
      guardar(function(f){ var d = Object.assign({}, p); ['banco','cuentas','proyectos','expediente','documentos','historial'].forEach(function(k){ delete d[k]; });
        if (p.id) f.proveedores = f.proveedores.map(function(x){ return x.id === p.id ? Object.assign({}, x, d) : x; });
        else { codigo = sigCodigo(f); f.proveedores.push(Object.assign(d, {id:id, codigo:codigo, activo:true, estado:'aprobado'})); }
        if (banco) { if (banco.id) f.bancos = f.bancos.map(function(b){ return b.id === banco.id ? Object.assign({}, b, banco) : b; });
          else f.bancos.push(Object.assign({id:uid(), proveedor_id:id, principal:!f.bancos.some(function(b){ return b.proveedor_id === id; }), verificada:true}, banco)); } });
      return P({id:id, codigo:codigo}); },
    subirDocProveedor: function(provId, tipo, file, cuentaId){ if (!A.docPermitido(file)) return R('Ese tipo de archivo no se puede cargar. Usá un PDF o una imagen (JPG, PNG, HEIC, etc.).'); return demo.provAccion('registrar_documento', {tipo:tipo, nombre:file.name, ruta:'#', cuenta_id:cuentaId || null, _prov:provId}); },
    eliminarSolicitud: function(id, motivo){ var me = meDemo();
      if (!A.inArea(me, 'admin')) return R('Solo Administración puede eliminar solicitudes de pago.');
      var s = F().solicitudes.filter(function(x){ return x.id === id; })[0]; if (!s) return R('No encontramos la solicitud.');
      if (s.fase === 'pagada') return R('Una solicitud pagada no se puede eliminar.'); if (!motivo) return R('Indicá el motivo para eliminarla.');
      guardar(function(f){ f.eliminaciones.push({tipo:'solicitud_pago', registro_id:id, descripcion:s.numero, motivo:motivo, nombre:me.nombres + ' ' + me.apellidos, creado_at:new Date().toISOString()});
        f.solicitudes = f.solicitudes.filter(function(x){ return x.id !== id; }); f.firmas = f.firmas.filter(function(x){ return x.solicitud_id !== id; }); f.adjuntos = f.adjuntos.filter(function(x){ return x.solicitud_id !== id; }); });
      return P({ok:true}); },
    cambiarCuenta: function(id, cuentaId){ var me = meDemo(), c = F().bancos.filter(function(b){ return b.id === cuentaId; })[0];
      guardar(function(f){ f.solicitudes.forEach(function(s){ if (s.id === id) { s.cuenta_id = cuentaId;
        f.firmas.push({id:f.firmas.length+1, solicitud_id:id, fase:s.fase, accion:'Cambió la cuenta de pago a ' + c.banco + ' · ' + c.numero_cuenta, usuario:me.id, nombre:me.nombres+' '+me.apellidos, puesto:me.puesto, huella:'demo', creado_at:new Date().toISOString()}); } }); });
      return P({ok:true}); },

    /* ---------- Registro de proveedores (demo) ---------- */
    provAccion: function(accion, d){ d = d || {}; return provDemo(accion, d); },

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
      x.proveedor.regimen_isr = p.regimen_isr;
      x.cuentas = f.bancos.filter(function(b){ return b.proveedor_id === s.proveedor_id; });
      x.banco = x.cuentas.filter(function(b){ return b.id === s.cuenta_id; })[0] || null;
      return P(x); },
    crearSolicitud: function(d){
      var f = F(), c = f.cotizaciones.filter(function(x){ return x.id === d.cotizacion_id; })[0], me = meDemo();
      var pv = vprov(c.proveedor_id); if (!pv || pv.estado !== 'aprobado' || pv.activo === false) return R('El proveedor no está aprobado o está inactivo.');
      var cta = f.bancos.filter(function(b){ return b.proveedor_id === c.proveedor_id; }).sort(function(a, b){ return (b.principal ? 1 : 0) - (a.principal ? 1 : 0); })[0];
      var disp = A.saldos([c], f.solicitudes)[0].disponible;
      if (Number(d.monto) > disp + 0.001) return R('El monto supera el saldo disponible de la cotización.');
      var s = {id:uid(), numero:'SP-2026-' + String(f.solicitudes.length + 1).padStart(4,'0'), cotizacion_id:c.id, proveedor_id:c.proveedor_id, proyecto_id:c.proyecto_id, area:c.area,
               concepto:d.concepto, moneda:c.moneda, monto:Number(d.monto), fase:'solicitada', cuenta_id: cta ? cta.id : null, retencion_isr:0, retencion_iva:0, creado_por:me.id, creado_at:new Date().toISOString()};
      guardar(function(f){ f.solicitudes.unshift(s); f.firmas.push({id:f.firmas.length+1, solicitud_id:s.id, fase:'solicitada', accion:'Creó la solicitud de pago', usuario:me.id, nombre:me.nombres+' '+me.apellidos, puesto:me.puesto, nota:d.nota||null, huella:Math.random().toString(16).slice(2)+'demo', creado_at:new Date().toISOString()}); });
      return P({ok:true, id:s.id, numero:s.numero}); },
    avanzar: function(id, d){
      d = d || {}; var me = meDemo(), f = F(), s = f.solicitudes.filter(function(x){ return x.id === id; })[0];
      var orden = ['solicitada','oc_emitida','vobo_contable','aprobada','pagada'], i = orden.indexOf(s.fase); if (i < 0 || i > 3) return R('Esta solicitud ya está cerrada.');
      var fase = A.fase(s.fase); if (!A.can(me, fase.permiso)) return R('No tenés permiso para autorizar esta fase.');
      var tipos = f.adjuntos.filter(function(a){ return a.solicitud_id === id; }).map(function(a){ return a.tipo; });
      if (s.fase === 'oc_emitida' && tipos.indexOf('factura') < 0) return R('Adjuntá la factura antes de dar el VoBo contable.');
      if (s.fase === 'vobo_contable' && s.cuenta_id) { var ct = f.bancos.filter(function(b){ return b.id === s.cuenta_id; })[0]; if (ct && !ct.verificada) return R('La cuenta bancaria de este pago tiene cambios sin verificar. Pedí que la verifiquen en Proveedores antes de aprobar.'); }
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

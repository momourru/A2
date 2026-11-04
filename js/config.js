/* =========================================================
   CONFIGURACIÓN DEL PORTAL A2
   Lo único que hay que llenar para pasar de demo a real son
   las dos primeras líneas (Supabase → Project Settings → API).
   La clave "anon public" es pública por diseño: la seguridad
   la ponen los permisos de la base de datos y las funciones.
   ========================================================= */
window.A2_CONFIG = {
  supabaseUrl: 'https://lfpagqdemvjhdgkxnxrg.supabase.co',
  supabaseAnonKey: 'sb_publishable__iOKt9uzpBqNNaIYN449-w_6LDVYfxd',

  dominioCorporativo: 'a2desarrollos.com',

  /* Nombre con el que quedó cada función en Supabase → Edge Functions */
  funciones: {
    solicitar: 'quick-responder',
    aprobar:   'bright-task',
    activar:   'smart-action',
    usuarios:  'usuarios',
    comunicados: 'comunicados',
    pagos:     'pagos'
  },

  /* Puestos que puede elegir quien solicita usuario. Editá esta lista libremente. */
  puestos: [
    'Gerente general',
    'Gerente de área',
    'Coordinador(a)',
    'Analista',
    'Asistente',
    'Arquitecto(a)',
    'Ingeniero(a)',
    'Supervisor(a) de obra',
    'Asesor(a) de ventas',
    'Contador(a)',
    'Abogado(a)',
    'Diseñador(a)',
    'Otro'
  ],

  /* Áreas o departamentos. El "id" no se debe cambiar una vez haya usuarios. */
  areas: [
    {id:'admin',     n:'Administración, contabilidad y finanzas', corto:'Administración'},
    {id:'proyectos', n:'Proyectos y obra'},
    {id:'ventas',    n:'Ventas'},
    {id:'mercadeo',  n:'Mercadeo'}
  ],

  /* Permisos especiales que asigna el Owner a cada usuario (Usuarios → Editar) */
  permisos: [
    {id:'gestionar_proyectos',   n:'Gestionar proyectos',        d:'Crea proyectos y empresas internas, y asigna el equipo.'},
    {id:'gestionar_proveedores', n:'Gestionar proveedores',      d:'Crea y edita proveedores, sus datos bancarios y a qué proyecto pertenecen.'},
    {id:'solicitar_pago',        n:'Cargar cotizaciones y solicitar pagos', d:'Carga cotizaciones y crea solicitudes de pago.'},
    {id:'revisar_solicitud',     n:'Revisar solicitudes y emitir OC', d:'Revisa que la cotización o factura coincida y emite la orden de compra.'},
    {id:'vobo_contable',         n:'VoBo contable',              d:'Autoriza la orden de compra, detalla retenciones y adjunta documentos.'},
    {id:'aprobar_pago',          n:'Aprobar para transferir',    d:'Valida que todo está aprobado para cargar la transferencia en el banco.'},
    {id:'registrar_pago',        n:'Registrar pagos',            d:'Sube el comprobante de transferencia y cierra la orden.'}
  ]
};

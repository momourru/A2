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
    usuarios:  'usuarios'
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
    {id:'finanzas',  n:'Contabilidad y finanzas'},
    {id:'admin',     n:'Administración y RR. HH.'},
    {id:'legal',     n:'Legal'},
    {id:'proyectos', n:'Proyectos y obra'},
    {id:'ventas',    n:'Ventas'},
    {id:'mercadeo',  n:'Mercadeo'}
  ]
};

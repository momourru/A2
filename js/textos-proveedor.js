/* =========================================================
   TEXTOS QUE ACEPTA EL PROVEEDOR
   Editá libremente. Cuando cambiés un texto, cambiá también su "version":
   el portal guarda qué versión aceptó cada proveedor y cuándo.
   Un párrafo puede ser texto simple o {texto, items:[...], nota} para llevar viñetas.
   ========================================================= */
window.A2_TEXTOS_PROVEEDOR = {

  terminos: {
    version: '2026-11-09',
    titulo: 'Términos y condiciones para proveedores de A2',
    parrafos: [
      'Estos términos regulan la relación entre el proveedor, Área Cuadrada y sus empresas relacionadas ("A2") para la cotización, compra y pago de productos y servicios.',
      'Toda compra o contratación se formaliza únicamente mediante una orden de compra emitida por A2 a través del portal. No se reconoce ni se paga ningún trabajo, entrega o servicio realizado sin orden de compra.',
      'Las cotizaciones deben indicar el precio, la moneda, los impuestos, las condiciones de pago, el plazo de entrega y la vigencia. Una vez emitida la orden de compra, los precios no pueden cambiar salvo acuerdo por escrito.',
      'Las facturas deben ser electrónicas (FEL), emitidas a nombre de la empresa de A2 que emite la orden de compra, y deben coincidir con ella en conceptos y montos. A2 aplica las retenciones de ISR e IVA que correspondan.',
      'Los pagos se realizan únicamente mediante transferencia a cuentas registradas y verificadas en el portal, a nombre del proveedor.',
      'El proveedor cumple con los estándares de calidad, las especificaciones y los plazos acordados, así como con las normas de seguridad industrial y de conducta en los proyectos y oficinas de A2.',
      'El proveedor mantiene confidencial la información de A2 y sus proyectos y no la utiliza para fines ajenos a la relación comercial.',
      'El proveedor no ofrece pagos, regalos ni beneficios a colaboradores de A2 para obtener contratos o ventajas. Cualquier caso puede reportarse a info@a2desarrollos.com.',
      'A2 puede suspender o cancelar el registro por incumplimiento de estos términos.'
    ],
    secciones: [
      {
        titulo: 'Condiciones de facturación y pago',
        parrafos: [
          'Entrega de la factura: el proveedor entrega cada factura al responsable o encargado del proyecto correspondiente, quien la firma de recibido en nombre de A2. Una factura sin firma de recibido no se considera entregada.',
          'Detalle y respaldo: la factura debe detallar los conceptos, las cantidades, los precios unitarios y los montos, y entregarse junto con la cotización aprobada que la respalda. Una factura incompleta, sin respaldo o que no coincida con la cotización y la orden de compra se devuelve para corrección; en ese caso, la fecha de recepción será la de la factura corregida.',
          'Fecha límite de recepción: por cierre contable, A2 recibe facturas hasta el día 20 de cada mes. Las facturas recibidas después de esa fecha se procesan en el ciclo del mes siguiente.',
          'Plazo de pago: una vez recibida, la factura se procesa y se paga entre 30 y 45 días calendario contados a partir de la fecha de recepción firmada.',
          'Fechas de pago: A2 emite pagos únicamente los días 15 y 30 de cada mes (pago quincenal; en febrero, el último día del mes). Cada factura se paga en la fecha de pago que corresponda dentro del plazo anterior. Si la fecha cae en día inhábil, el pago se realiza el día hábil siguiente.'
        ]
      }
    ]
  },

  diligencia: {
    version: '2026-11-09',
    titulo: 'Declaración de veracidad y autorización de verificación',
    parrafos: [
      'Toda la información y los documentos son veraces, completos y vigentes. Quien registra tiene facultades para hacerlo en nombre de la empresa.',
      {texto: 'El proveedor autoriza a A2 a verificar la información ante:', items: [
        'la SAT;', 'el Registro Mercantil;', 'los bancos;', 'las referencias comerciales;',
        'las listas de control contra el lavado de dinero y el financiamiento del terrorismo.']},
      {texto: 'El proveedor autoriza a A2 a conservar y usar la información para:', items: [
        'el registro y control de proveedores;', 'cotizaciones, órdenes de compra y pagos;',
        'las obligaciones legales, tributarias y contables;', 'las auditorías;', 'la defensa ante reclamos.'],
        nota: 'A2 la resguarda con medidas razonables y solo la comparte con asesores, auditores, bancos o autoridades cuando sea necesario o lo exija la ley.'},
      'A2 paga solo a cuentas registradas y verificadas. A2 no responde por los datos bancarios incorrectos que proporcione el proveedor. Todo cambio de cuenta debe ser notificado a A2 y requiere una nueva verificación.',
      'El proveedor se compromete a mantener actualizados sus datos y a notificar cualquier cambio en su representación legal, en sus documentos o en sus cuentas.',
      'Si A2 detecta información falsa, incompleta o inconsistente, puede rechazar, suspender o cancelar el registro y retener los pagos pendientes de verificación, sin perjuicio de las acciones legales.',
      'Aprobar el registro no obliga a A2 a contratar.'
    ]
  }
};

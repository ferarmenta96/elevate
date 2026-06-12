// ═══════════════════════════════════════════════════════════════════════
//  TITAN IT SOLUTIONS — Google Apps Script Backend
//  Sheets: Solicitudes | Materiales | Movimientos
//  Desplegar: Implementar > Nueva implementación > Aplicación web
//  Ejecutar como: Yo  |  Acceso: Cualquiera (incluso anónimo)
//
//  Después de desplegar, copia la URL del Web App y pégala en la
//  variable GAS_URL de: orden.html, receiver.html, crm.html,
//  sender.html y mrp.html (reemplaza 'PASTE_YOUR_GAS_URL_HERE').
// ═══════════════════════════════════════════════════════════════════════

var SHEET = {
  solicitudes: 'Solicitudes',
  materiales:  'Materiales',
  movimientos: 'Movimientos'
};

var ADMIN_KEY = 'horus2026';   // Cambia esto a algo seguro (y en crm/sender/mrp.html)

var HEADERS = {
  'Solicitudes': ['ID','Cliente','Empresa','Telefono','Email','Servicios','Prioridad','Descripcion','Direccion','Timestamp','Estado','Notas'],
  'Materiales':  ['ID','Nombre','Unidad','Stock','Minimo'],
  'Movimientos': ['ID','Tipo','Descripcion','Detalle','Timestamp']
};

// ── Respuesta JSON / JSONP ────────────────────────────────────────
function resp(data, cb) {
  var json = JSON.stringify(data);
  if (cb && cb !== '') {
    return ContentService.createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Rutas ─────────────────────────────────────────────────────────
function doGet(e) {
  var p  = (e && e.parameter) ? e.parameter : {};
  var cb = p.callback || '';
  try { return resp(dispatch(p), cb); }
  catch (err) { return resp({ ok: false, error: err.message }, cb); }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    return resp(dispatch(body), '');
  } catch (err) { return resp({ ok: false, error: err.message }, ''); }
}

function dispatch(p) {
  switch (p.action || 'ping') {
    case 'ping':              return { ok: true, msg: 'Horus IT Solutions activo' };
    case 'createSolicitud':   return createSolicitud(p);
    case 'getSolicitud':      return getSolicitud(p.id);
    case 'listarSolicitudes': return admin(p, listarSolicitudes, [p.estado]);
    case 'updateEstado':      return admin(p, updateEstado,      [p.id, p.estado]);
    case 'getMateriales':     return admin(p, getMateriales,     []);
    case 'addMaterial':       return admin(p, addMaterial,       [p]);
    case 'updateStock':       return admin(p, updateStock,       [p.id, p.cantidad, p.tipo, p.nota]);
    case 'getMovimientos':    return admin(p, getMovimientos,    []);
    case 'getDashboard':      return admin(p, getDashboard,      []);
    default: return { ok: false, error: 'Accion no reconocida: ' + p.action };
  }
}

function admin(p, fn, args) {
  if ((p.adminKey || p.admin_key) !== ADMIN_KEY)
    return { ok: false, error: 'No autorizado' };
  return fn.apply(null, args);
}

// ── Sheet helper ──────────────────────────────────────────────────
function getSheet(name) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var h = HEADERS[name];
    if (h) {
      sheet.appendRow(h);
      sheet.getRange(1, 1, 1, h.length)
        .setBackground('#071A3D').setFontColor('#F5B400').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function limpiar(val) {
  return String(val || '').replace(/[\r\n\t]+/g, ' ').trim();
}

// ═══════════════════════════════════════════════════════════════════
//  SOLICITUDES
// ═══════════════════════════════════════════════════════════════════
function createSolicitud(p) {
  if (!p.cliente)     return { ok: false, error: 'Falta nombre del cliente' };
  if (!p.servicios)   return { ok: false, error: 'Faltan servicios' };
  if (!p.descripcion) return { ok: false, error: 'Falta descripción del trabajo' };

  var sheet = getSheet(SHEET.solicitudes);
  var id    = 'TI-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();

  sheet.appendRow([
    id,
    limpiar(p.cliente),
    limpiar(p.empresa || ''),
    limpiar(p.telefono || ''),
    limpiar(p.email || ''),
    limpiar(p.servicios),
    limpiar(p.prioridad || 'standard'),
    limpiar(p.descripcion),
    limpiar(p.direccion || ''),
    new Date().toISOString(),
    'recibida',
    limpiar(p.notas || '')
  ]);

  // Email de notificación (opcional)
  try {
    var email = PropertiesService.getScriptProperties().getProperty('NOTIF_EMAIL') || '';
    if (email) sendEmail(p, id, email);
  } catch (e) { Logger.log('Email error: ' + e.message); }

  return { ok: true, id: id };
}

function rowToSolicitud(r, h) {
  return {
    id:          r[h.indexOf('ID')],
    cliente:     r[h.indexOf('Cliente')],
    empresa:     r[h.indexOf('Empresa')],
    telefono:    r[h.indexOf('Telefono')],
    email:       r[h.indexOf('Email')],
    servicios:   r[h.indexOf('Servicios')],
    prioridad:   r[h.indexOf('Prioridad')] || 'standard',
    descripcion: r[h.indexOf('Descripcion')],
    direccion:   r[h.indexOf('Direccion')],
    timestamp:   r[h.indexOf('Timestamp')],
    estado:      r[h.indexOf('Estado')] || 'recibida',
    notas:       r[h.indexOf('Notas')]
  };
}

function getSolicitud(id) {
  if (!id) return { ok: false, error: 'ID requerido' };
  var sheet = getSheet(SHEET.solicitudes);
  var data  = sheet.getDataRange().getValues();
  var h = data[0];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][h.indexOf('ID')]) !== String(id)) continue;
    var o = rowToSolicitud(data[i], h);
    o.ok = true;
    return o;
  }
  return { ok: false, error: 'Solicitud no encontrada' };
}

function listarSolicitudes(estado) {
  var sheet = getSheet(SHEET.solicitudes);
  if (sheet.getLastRow() <= 1) return { ok: true, solicitudes: [] };
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][h.indexOf('ID')]) continue;
    var o = rowToSolicitud(data[i], h);
    if (estado && o.estado !== estado) continue;
    out.push(o);
  }
  out.reverse();
  return { ok: true, solicitudes: out };
}

function updateEstado(id, estado) {
  if (!id || !estado) return { ok: false, error: 'Faltan parametros' };
  var sheet = getSheet(SHEET.solicitudes);
  var data  = sheet.getDataRange().getValues();
  var h     = data[0];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][h.indexOf('ID')]) !== String(id)) continue;
    sheet.getRange(i + 1, h.indexOf('Estado') + 1).setValue(estado);
    return { ok: true };
  }
  return { ok: false, error: 'Solicitud no encontrada' };
}

// ═══════════════════════════════════════════════════════════════════
//  MATERIALES
// ═══════════════════════════════════════════════════════════════════
function getMateriales() {
  var sheet = getSheet(SHEET.materiales);
  if (sheet.getLastRow() <= 1) return { ok: true, materiales: [] };
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][h.indexOf('ID')]) continue;
    out.push({
      id:     String(data[i][h.indexOf('ID')]),
      nombre: data[i][h.indexOf('Nombre')],
      unidad: data[i][h.indexOf('Unidad')],
      stock:  Number(data[i][h.indexOf('Stock')])  || 0,
      minimo: Number(data[i][h.indexOf('Minimo')]) || 10
    });
  }
  return { ok: true, materiales: out };
}

function addMaterial(p) {
  if (!p.nombre || !p.unidad) return { ok: false, error: 'Faltan nombre o unidad' };
  var sheet = getSheet(SHEET.materiales);
  var id = 'MAT-' + Date.now();
  sheet.appendRow([id, limpiar(p.nombre), limpiar(p.unidad), Number(p.stock) || 0, Number(p.minimo) || 10]);
  logMovimiento('entrada', 'Alta de material: ' + p.nombre, (Number(p.stock) || 0) + ' ' + p.unidad);
  return { ok: true, id: id };
}

function updateStock(id, cantidad, tipo, nota) {
  var sheet = getSheet(SHEET.materiales);
  var data  = sheet.getDataRange().getValues();
  var h = data[0];
  var idxID    = h.indexOf('ID');
  var idxStock = h.indexOf('Stock');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxID]) !== String(id)) continue;
    var current  = Number(data[i][idxStock]) || 0;
    var delta    = Number(cantidad) || 0;
    var newStock = tipo === 'entrada' ? current + delta : current - delta;
    sheet.getRange(i + 1, idxStock + 1).setValue(newStock);
    logMovimiento(tipo, nota || 'Ajuste manual: ' + data[i][h.indexOf('Nombre')],
      (tipo === 'entrada' ? '+' : '-') + delta + ' ' + data[i][h.indexOf('Unidad')]);
    return { ok: true, nuevoStock: newStock };
  }
  return { ok: false, error: 'Material no encontrado' };
}

// ═══════════════════════════════════════════════════════════════════
//  MOVIMIENTOS
// ═══════════════════════════════════════════════════════════════════
function logMovimiento(tipo, desc, detalle) {
  getSheet(SHEET.movimientos).appendRow([
    'MOV-' + Date.now(), tipo, desc, detalle || '', new Date().toISOString()
  ]);
}

function getMovimientos() {
  var sheet = getSheet(SHEET.movimientos);
  if (sheet.getLastRow() <= 1) return { ok: true, movimientos: [] };
  var data = sheet.getDataRange().getValues();
  var h    = data[0];
  var out  = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    out.push({
      id:        data[i][h.indexOf('ID')],
      tipo:      data[i][h.indexOf('Tipo')],
      desc:      data[i][h.indexOf('Descripcion')],
      detalle:   data[i][h.indexOf('Detalle')],
      timestamp: data[i][h.indexOf('Timestamp')]
    });
  }
  out.reverse();
  return { ok: true, movimientos: out };
}

// ═══════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function getDashboard() {
  var sols = listarSolicitudes();
  var mats = getMateriales();

  var total      = sols.solicitudes.length;
  var recibidas  = sols.solicitudes.filter(function(o) { return o.estado === 'recibida'; }).length;
  var enProceso  = sols.solicitudes.filter(function(o) { return o.estado === 'en_proceso'; }).length;
  var completadas= sols.solicitudes.filter(function(o) { return o.estado === 'completada'; }).length;
  var stockBajo  = mats.materiales.filter(function(m) { return m.stock < m.minimo; });

  return {
    ok: true,
    totalSolicitudes: total,
    recibidas:   recibidas,
    enProceso:   enProceso,
    completadas: completadas,
    stockBajo:   stockBajo,
    materiales:  mats.materiales
  };
}

// ═══════════════════════════════════════════════════════════════════
//  EMAIL
// ═══════════════════════════════════════════════════════════════════
function sendEmail(datos, id, toEmail) {
  var subject = '🌐 Nueva solicitud Horus — ' + (datos.cliente || 'Cliente') +
    (datos.prioridad === 'emergency' ? ' 🚨 EMERGENCIA' : '');
  var body = [
    '==============================================',
    '   NUEVA SOLICITUD — TITAN IT SOLUTIONS',
    '==============================================',
    '',
    'ID:           ' + id,
    'Cliente:      ' + (datos.cliente     || '—'),
    'Empresa:      ' + (datos.empresa     || '—'),
    'Teléfono:     ' + (datos.telefono    || '—'),
    'Email:        ' + (datos.email       || '—'),
    'Servicios:    ' + (datos.servicios   || '—'),
    'Prioridad:    ' + (datos.prioridad === 'emergency' ? '🚨 EMERGENCIA 24/7' : 'Estándar'),
    'Descripción:  ' + (datos.descripcion || '—'),
    'Ubicación:    ' + (datos.direccion   || '—'),
    '',
    '----------------------------------------------',
    'Revisar el CRM en: TU_URL_AQUI/crm.html',
    '==============================================',
    '',
    '— Notificación automática · Horus IT Solutions'
  ].join('\n');
  GmailApp.sendEmail(toEmail, subject, body);
}

// ═══════════════════════════════════════════════════════════════════
//  SETUP COMPLETO ← EJECUTA ESTA FUNCIÓN UNA SOLA VEZ
//  Crea las 3 hojas con encabezados y materiales iniciales.
//  Cómo usarla: en el editor de Apps Script selecciona "SETUP"
//  en el menú de funciones y presiona ▶ Ejecutar
// ═══════════════════════════════════════════════════════════════════
function SETUP() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var log = [];

  var hojaDefault = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hojaDefault && ss.getSheets().length > 1) {
    ss.deleteSheet(hojaDefault);
    log.push('✓ Hoja vacía eliminada');
  }

  [SHEET.solicitudes, SHEET.materiales, SHEET.movimientos].forEach(function(nombre) {
    var sheet = ss.getSheetByName(nombre);
    if (!sheet) {
      sheet = ss.insertSheet(nombre);
      var h = HEADERS[nombre];
      if (h) {
        sheet.appendRow(h);
        sheet.getRange(1, 1, 1, h.length)
          .setBackground('#071A3D').setFontColor('#F5B400')
          .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
        sheet.setFrozenRows(1);
        sheet.setColumnWidth(1, 170);
        for (var c = 2; c <= h.length; c++) sheet.setColumnWidth(c, 150);
      }
      log.push('✓ Hoja creada: ' + nombre);
    } else {
      log.push('⚠ Ya existe (no modificada): ' + nombre);
    }
  });

  // Materiales iniciales
  var sheetMat = ss.getSheetByName(SHEET.materiales);
  if (sheetMat.getLastRow() <= 1) {
    var materiales = [
      // [ID, Nombre, Unidad, Stock, Minimo]
      ['MAT-1', 'Cable Cat6 UTP (caja 305m)',   'cajas',     6,  3],
      ['MAT-2', 'Conectores RJ45 Cat6',         'bolsas',   10,  5],
      ['MAT-3', 'Jacks Keystone Cat6',          'piezas',   80, 40],
      ['MAT-4', 'Patch cords Cat6 (3 ft)',      'piezas',   50, 25],
      ['MAT-5', 'Patch panel 24 puertos',       'piezas',    4,  2],
      ['MAT-6', 'Canaleta 20x12mm (tramo 2m)',  'piezas',   30, 15],
      ['MAT-7', 'Fibra óptica OM4 (rollo)',     'rollos',    2,  1],
      ['MAT-8', 'Cinchos y velcro',             'paquetes', 12,  6]
    ];
    materiales.forEach(function(row) { sheetMat.appendRow(row); });
    log.push('✓ ' + materiales.length + ' materiales agregados');
  } else {
    log.push('⚠ Materiales ya tenían datos — no se tocaron');
  }

  if (ss.getName() === 'Sin título' || ss.getName() === 'Untitled') {
    ss.rename('Horus IT Solutions DB');
    log.push('✓ Spreadsheet renombrado: Horus IT Solutions DB');
  }

  var mensaje = '🌐 SETUP COMPLETADO\n\n' + log.join('\n');
  Logger.log(mensaje);
  SpreadsheetApp.getUi().alert('✅ Setup Horus IT Solutions', mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
  return mensaje;
}

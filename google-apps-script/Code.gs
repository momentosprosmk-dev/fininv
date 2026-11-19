/**
 * 1. Pega este código en tu Google Sheet: Extensiones > Apps Script.
 * 2. Selecciona la función "inicializarHojasYCatalogos" arriba y haz clic en "Ejecutar"
 *    (creará las pestañas que falten y encabezados sin borrar tus datos actuales).
 * 3. Luego ve a: Implementar > Nueva implementación (o Administrar implementaciones > Editar > Nueva versión)
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo (tu Gmail)
 *    - Quién tiene acceso: Cualquier usuario
 * 4. Copia la URL generada (/exec) y pégala en la Web App.
 */

var SHEET_HEADERS = {
  t_user: ['Usuario', 'Contrasena_Hash', 'Correo', 'Creado_En'],
  Cuentas: ['ID', 'Nombre', 'Tipo', 'Descripcion', 'Saldo_Inicial_COP', 'Cupo_COP'],
  Tipos_Egresos: ['ID', 'Nombre', 'Descripcion', 'Es_Inversion_ARQ'],
  Tipos_Ingresos: ['ID', 'Nombre', 'Descripcion'],
  Tipos_Traspasos: ['ID', 'Nombre', 'Descripcion'],
  Movimientos: [
    'ID',
    'Fecha',
    'Mes_Contable',
    'Tipo',
    'Cuenta_Origen',
    'Cuenta_Destino',
    'Categoria',
    'Descripcion',
    'Monto_COP',
    'Creado_En',
  ],
  Obligaciones_Fijas: ['ID', 'Nombre', 'Categoria', 'Monto_Estimado_COP', 'Tipo_Cruce'],
  Cierres_Mensuales: [
    'Mes',
    'Fecha_Cierre',
    'Total_Ingresos',
    'Total_Egresos_Consumo',
    'Total_Inversion_ARQ',
    'Saldo_Debito',
    'Saldo_Nequi',
    'Saldo_Efectivo',
    'Deuda_TC',
    'Liquidez_Total',
    'Sobrante_o_Faltante_TC',
    'Notas',
  ],
  Cuentas_Inversion: ['ID', 'Nombre', 'Modo', 'Moneda', 'Saldo_Inicial', 'Meta', 'Notas'],
  Subinversiones: ['ID', 'Cuenta_Inversion', 'Nombre', 'Saldo_Inicial', 'Notas'],
  Movimientos_Inversion: [
    'ID',
    'Fecha',
    'Tipo',
    'Cuenta_Inversion',
    'Subinversion',
    'Cuenta_Normal',
    'Descripcion',
    'Monto',
    'Comision',
    'Aplicacion_Comision',
    'Tasa_Cambio',
    'Monto_COP',
    'Movimiento_Financiero_ID',
    'Creado_En',
  ],
  Prestamos: [
    'ID',
    'Deudor',
    'Cuenta_Origen',
    'Capital_COP',
    'Tasa_Interes',
    'Modo_Interes',
    'Total_Cobrar_COP',
    'Cuotas',
    'Frecuencia',
    'Fecha_Inicio',
    'Notas',
    'Movimiento_Financiero_ID',
    'Creado_En',
  ],
  Pagos_Prestamos: [
    'ID',
    'Prestamo_ID',
    'Fecha',
    'Cuenta_Destino',
    'Monto_COP',
    'Notas',
    'Movimiento_Financiero_ID',
    'Creado_En',
  ],
};

var INITIAL_CATALOG_DATA = {
  Cuentas: [
    ['cta-1', 'Tarjeta de Débito', 'liquidez', 'Cuenta bancaria principal', 0, ''],
    ['cta-2', 'Nequi', 'liquidez', 'Billetera digital', 0, ''],
    ['cta-3', 'Efectivo', 'liquidez', 'Dinero en mano', 0, ''],
    ['cta-4', 'Tarjeta de Crédito', 'deuda', 'TC Banco', 0, 2400000],
  ],
  Tipos_Egresos: [
    ['egr-1', 'Arriendo', 'Pago mensual apartamento', 'NO'],
    ['egr-2', 'Alimentación', 'Mercado y comidas', 'NO'],
    ['egr-3', 'Transporte', 'Pasajes, Uber, gasolina', 'NO'],
    ['egr-4', 'Auxilio para mamá', 'Apoyo mensual', 'NO'],
    ['egr-5', 'Corte de cabello', 'Barbería / peluquería', 'NO'],
    ['egr-6', 'Gustos y entretenimiento', 'Salidas, cine, compras', 'NO'],
    ['egr-7', 'Aporte a Inversión', 'Envío a fondo o bolsa de inversión', 'SI'],
  ],
  Tipos_Ingresos: [
    ['ing-1', 'Salario / Nómina', 'Ingreso principal'],
    ['ing-2', 'Freelance / Ventas', 'Trabajos extra'],
    ['ing-3', 'Retiro de Inversión', 'Dinero retirado de fondo o inversión'],
  ],
  Tipos_Traspasos: [
    ['tra-1', 'Pago TC', 'Abono o pago total tarjeta'],
    ['tra-2', 'Recarga Billetera', 'Paso a Nequi u otra cuenta'],
    ['tra-3', 'Retiro a Efectivo', 'Cajero / corresponsal'],
  ],
  Obligaciones_Fijas: [
    ['ob-1', 'Arriendo', 'Arriendo', 0, 'Egreso'],
    ['ob-2', 'Auxilio para mamá', 'Auxilio para mamá', 0, 'Egreso'],
    ['ob-3', 'Pago Tarjeta de Crédito', 'Pago TC', 0, 'PagoTC'],
  ],
};

function inicializarHojasYCatalogos() {
  var ss = ensureSheets_();

  Object.keys(INITIAL_CATALOG_DATA).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() <= 1) {
      var rows = INITIAL_CATALOG_DATA[name];
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
    }
  });

  ['Hoja 1', 'Sheet1'].forEach(function (defaultName) {
    var defaultSheet = ss.getSheetByName(defaultName);
    if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
  });
}

function ensureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      var headers = SHEET_HEADERS[name];
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#e2e8f0');
      sheet.setFrozenRows(1);
    }
  });
  return ss;
}

function readSheetRows_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getDataRange().getValues();
  return values.slice(1);
}

function writeSheetRows_(ss, name, rows) {
  var sheet = ss.getSheetByName(name);
  sheet.clearContents();
  var allRows = [SHEET_HEADERS[name]].concat(rows);
  sheet.getRange(1, 1, allRows.length, SHEET_HEADERS[name].length).setValues(allRows);
  var headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS[name].length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#e2e8f0');
}

function getUsersRows_(ss) {
  var rows = readSheetRows_(ss, 't_user');
  if (rows.length > 0) return rows;
  return readSheetRows_(ss, 'users');
}

function validateUser_(ss, auth) {
  var tRows = readSheetRows_(ss, 't_user');
  var userSheetName = tRows.length > 0 ? 't_user' : 'users';
  var rows = tRows.length > 0 ? tRows : readSheetRows_(ss, 'users');
  if (rows.length === 0) return false;
  if (!auth) return false;
  if (auth.username && auth.passwordHash) {
    var u = String(auth.username).trim().toLowerCase();
    var p = String(auth.passwordHash).trim();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (String(r[0] || '').trim().toLowerCase() !== u) continue;
      var storedPass = String(r[1] || '').trim();
      if (storedPass === p) return true;
      if (auth.rawPassword && storedPass === String(auth.rawPassword).trim()) {
        // Migra automáticamente la clave en texto plano a su hash SHA-256 para que los push/pull funcionen
        var uSheet = ss.getSheetByName(userSheetName);
        if (uSheet) uSheet.getRange(i + 2, 2).setValue(p);
        return true;
      }
    }
    return false;
  }
  if (auth.email) {
    var em = String(auth.email).trim().toLowerCase();
    if (!em) return false;
    return rows.some(function (r) {
      var storedEmail = String(r[2] || '').trim().toLowerCase();
      return storedEmail && storedEmail === em;
    });
  }
  return false;
}

function listUsersSafe_(ss) {
  var rows = getUsersRows_(ss);
  return rows.map(function (r, idx) {
    return {
      rowIndex: idx + 2,
      username: String(r[0] || '').trim(),
      email: String(r[2] || '').trim(),
      createdAt: String(r[3] || ''),
    };
  });
}

function readAllPayload_(ss) {
  return {
    ok: true,
    authenticated: true,
    spreadsheetUrl: ss.getUrl(),
    cuentas: readSheetRows_(ss, 'Cuentas'),
    tiposEgresos: readSheetRows_(ss, 'Tipos_Egresos'),
    tiposIngresos: readSheetRows_(ss, 'Tipos_Ingresos'),
    tiposTraspasos: readSheetRows_(ss, 'Tipos_Traspasos'),
    movimientos: readSheetRows_(ss, 'Movimientos'),
    obligaciones: readSheetRows_(ss, 'Obligaciones_Fijas'),
    cierres: readSheetRows_(ss, 'Cierres_Mensuales'),
    cuentasInversion: readSheetRows_(ss, 'Cuentas_Inversion'),
    subinversiones: readSheetRows_(ss, 'Subinversiones'),
    movimientosInversion: readSheetRows_(ss, 'Movimientos_Inversion'),
    prestamos: readSheetRows_(ss, 'Prestamos'),
    pagosPrestamos: readSheetRows_(ss, 'Pagos_Prestamos'),
  };
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet() {
  var ss = ensureSheets_();
  var users = getUsersRows_(ss);
  if (users.length > 0) {
    return jsonOut_({
      ok: false,
      requiresAuth: true,
      error: 'Acceso protegido por contraseña. Debes autenticarte con tu usuario y contraseña.',
    });
  }
  return jsonOut_(readAllPayload_(ss));
}

function doPost(e) {
  var ss = ensureSheets_();
  var body = JSON.parse(e.postData.contents);
  var action = body.action || 'push';

  if (action === 'auth_register') {
    var regAuth = body.auth || {};
    var regUser = String(regAuth.username || '').trim();
    var regHash = String(regAuth.passwordHash || '').trim();
    var regEmail = String(regAuth.email || '').trim();
    if (!regUser || !regHash) {
      return jsonOut_({ ok: false, error: 'Debes indicar usuario y contraseña.' });
    }
    var existingUsers = getUsersRows_(ss);
    var alreadyExists = existingUsers.some(function (r) {
      return String(r[0] || '').trim().toLowerCase() === regUser.toLowerCase();
    });
    if (alreadyExists) {
      return jsonOut_({ ok: false, error: 'Ese usuario ya existe. Usa Iniciar sesión.' });
    }
    var userSheet = ss.getSheetByName('t_user');
    userSheet.appendRow([regUser, regHash, regEmail, new Date().toISOString()]);
  } else if (action === 'auth_update') {
    var updNew = body.newAuth || {};
    var nextUser = String(updNew.username || '').trim();
    var nextHash = String(updNew.passwordHash || '').trim();
    if (!nextUser && !nextHash) {
      return jsonOut_({ ok: false, error: 'Indica el nuevo usuario o la nueva contraseña.' });
    }
    var uSheet = ss.getSheetByName('t_user');
    var lastRow = uSheet.getLastRow();
    if (lastRow <= 1) {
      uSheet.appendRow([nextUser || 'admin', nextHash, String(updNew.email || ''), new Date().toISOString()]);
    } else {
      var curVals = uSheet.getRange(2, 1, 1, 4).getValues()[0];
      uSheet.getRange(2, 1, 1, 4).setValues([[
        nextUser || curVals[0],
        nextHash || curVals[1],
        updNew.email || curVals[2] || '',
        new Date().toISOString(),
      ]]);
    }
    return jsonOut_({ ok: true, spreadsheetUrl: ss.getUrl() });
  } else if (action === 'auth_login') {
    if (!validateUser_(ss, body.auth)) {
      var isEmailLogin = body.auth && body.auth.email && !body.auth.username;
      return jsonOut_({
        ok: false,
        error: isEmailLogin ? 'El correo ingresado no tiene permisos de acceso.' : 'Usuario o contraseña incorrectos.',
      });
    }
    return jsonOut_(readAllPayload_(ss));
  } else if (action === 'users_list') {
    var hasUsersList = getUsersRows_(ss).length > 0;
    if (hasUsersList && !validateUser_(ss, body.auth)) {
      return jsonOut_({ ok: false, error: 'No autorizado para gestionar usuarios.' });
    }
    return jsonOut_({ ok: true, users: listUsersSafe_(ss) });
  } else if (action === 'users_add') {
    var hasUsersAdd = getUsersRows_(ss).length > 0;
    if (hasUsersAdd && !validateUser_(ss, body.auth)) {
      return jsonOut_({ ok: false, error: 'No autorizado para agregar usuarios.' });
    }
    var nu = body.newUser || {};
    var addU = String(nu.username || '').trim();
    var addHash = String(nu.passwordHash || '').trim();
    var addEmail = String(nu.email || '').trim();
    if (!addU || !addHash) {
      return jsonOut_({ ok: false, error: 'Debes ingresar usuario y contraseña.' });
    }
    var curRowsAdd = getUsersRows_(ss);
    var dupU = curRowsAdd.some(function (r) { return String(r[0] || '').trim().toLowerCase() === addU.toLowerCase(); });
    if (dupU) return jsonOut_({ ok: false, error: 'Ya existe un usuario con ese nombre.' });
    if (addEmail) {
      var dupE = curRowsAdd.some(function (r) { return String(r[2] || '').trim().toLowerCase() === addEmail.toLowerCase(); });
      if (dupE) return jsonOut_({ ok: false, error: 'Ya existe un usuario con ese correo.' });
    }
    ss.getSheetByName('t_user').appendRow([addU, addHash, addEmail, new Date().toISOString()]);
    return jsonOut_({ ok: true, users: listUsersSafe_(ss) });
  } else if (action === 'users_update') {
    var hasUsersUpd = getUsersRows_(ss).length > 0;
    if (hasUsersUpd && !validateUser_(ss, body.auth)) {
      return jsonOut_({ ok: false, error: 'No autorizado para editar usuarios.' });
    }
    var rowIdx = Number(body.rowIndex) || 0;
    var eu = body.newUser || {};
    var updSheet = ss.getSheetByName('t_user');
    if (!updSheet || rowIdx < 2 || rowIdx > updSheet.getLastRow()) {
      return jsonOut_({ ok: false, error: 'Usuario no encontrado.' });
    }
    var curRow = updSheet.getRange(rowIdx, 1, 1, 4).getValues()[0];
    var updName = String(eu.username || '').trim() || String(curRow[0] || '').trim();
    var updHash = String(eu.passwordHash || '').trim() || String(curRow[1] || '').trim();
    var updEmail = eu.email !== undefined ? String(eu.email || '').trim() : String(curRow[2] || '').trim();
    var allRowsUpd = getUsersRows_(ss);
    var dupOther = allRowsUpd.some(function (r, idx) {
      return (idx + 2) !== rowIdx && String(r[0] || '').trim().toLowerCase() === updName.toLowerCase();
    });
    if (dupOther) return jsonOut_({ ok: false, error: 'Ya existe otro usuario con ese nombre.' });
    updSheet.getRange(rowIdx, 1, 1, 4).setValues([[updName, updHash, updEmail, curRow[3] || new Date().toISOString()]]);
    return jsonOut_({ ok: true, users: listUsersSafe_(ss) });
  } else if (action === 'users_delete') {
    var hasUsersDel = getUsersRows_(ss).length > 0;
    if (hasUsersDel && !validateUser_(ss, body.auth)) {
      return jsonOut_({ ok: false, error: 'No autorizado para eliminar usuarios.' });
    }
    var delIdx = Number(body.rowIndex) || 0;
    var delSheet = ss.getSheetByName('t_user');
    if (!delSheet || delIdx < 2 || delIdx > delSheet.getLastRow()) {
      return jsonOut_({ ok: false, error: 'Usuario no encontrado.' });
    }
    delSheet.deleteRow(delIdx);
    return jsonOut_({ ok: true, users: listUsersSafe_(ss) });
  } else if (action === 'pull') {
    var hasUsers = getUsersRows_(ss).length > 0;
    if (hasUsers && !validateUser_(ss, body.auth)) {
      return jsonOut_({ ok: false, error: 'Usuario o contraseña incorrectos.' });
    }
    return jsonOut_(readAllPayload_(ss));
  } else {
    var hasUsersPush = getUsersRows_(ss).length > 0;
    if (hasUsersPush && !validateUser_(ss, body.auth)) {
      return jsonOut_({ ok: false, error: 'No autorizado. Verifica tu usuario y contraseña.' });
    }
  }

  if (body.cuentas) writeSheetRows_(ss, 'Cuentas', body.cuentas);
  if (body.tiposEgresos) writeSheetRows_(ss, 'Tipos_Egresos', body.tiposEgresos);
  if (body.tiposIngresos) writeSheetRows_(ss, 'Tipos_Ingresos', body.tiposIngresos);
  if (body.tiposTraspasos) writeSheetRows_(ss, 'Tipos_Traspasos', body.tiposTraspasos);
  if (body.movimientos) writeSheetRows_(ss, 'Movimientos', body.movimientos);
  if (body.obligaciones) writeSheetRows_(ss, 'Obligaciones_Fijas', body.obligaciones);
  if (body.cierres) writeSheetRows_(ss, 'Cierres_Mensuales', body.cierres);
  if (body.cuentasInversion) writeSheetRows_(ss, 'Cuentas_Inversion', body.cuentasInversion);
  if (body.subinversiones) writeSheetRows_(ss, 'Subinversiones', body.subinversiones);
  if (body.movimientosInversion) writeSheetRows_(ss, 'Movimientos_Inversion', body.movimientosInversion);
  if (body.prestamos) writeSheetRows_(ss, 'Prestamos', body.prestamos);
  if (body.pagosPrestamos) writeSheetRows_(ss, 'Pagos_Prestamos', body.pagosPrestamos);

  return jsonOut_({ ok: true, spreadsheetUrl: ss.getUrl() });
}

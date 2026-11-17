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

function doGet() {
  var ss = ensureSheets_();
  var payload = {
    ok: true,
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
  };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doPost(e) {
  var ss = ensureSheets_();
  var body = JSON.parse(e.postData.contents);

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

  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, spreadsheetUrl: ss.getUrl() })
  ).setMimeType(ContentService.MimeType.JSON);
}

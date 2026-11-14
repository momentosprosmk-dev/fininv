(function () {
  var SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
  var DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
  var SPREADSHEET_TITLE = 'Contabilidad Personal - COP';
  var GOOGLE_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

  var SHEET_HEADERS = {
    Cuentas: ['ID', 'Nombre', 'Tipo', 'Descripcion', 'Saldo_Inicial_COP', 'Cupo_COP'],
    Tipos_Egresos: ['ID', 'Nombre', 'Descripcion', 'Es_Inversion_ARQ'],
    Tipos_Ingresos: ['ID', 'Nombre', 'Descripcion'],
    Tipos_Traspasos: ['ID', 'Nombre', 'Descripcion'],
    Movimientos: ['ID', 'Fecha', 'Mes_Contable', 'Tipo', 'Cuenta_Origen', 'Cuenta_Destino', 'Categoria', 'Descripcion', 'Monto_COP', 'Creado_En'],
    Obligaciones_Fijas: ['ID', 'Nombre', 'Categoria', 'Monto_Estimado_COP', 'Tipo_Cruce'],
    Cierres_Mensuales: ['Mes', 'Fecha_Cierre', 'Total_Ingresos', 'Total_Egresos_Consumo', 'Total_Inversion_ARQ', 'Saldo_Debito', 'Saldo_Nequi', 'Saldo_Efectivo', 'Deuda_TC', 'Liquidez_Total', 'Sobrante_o_Faltante_TC', 'Notas'],
  };

  async function apiFetch(url, token, options) {
    var opts = options || {};
    var headers = Object.assign(
      { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      opts.headers || {}
    );
    var res = await fetch(url, Object.assign({}, opts, { headers: headers }));
    if (!res.ok) {
      var text = await res.text();
      throw new Error('Google API error (' + res.status + '): ' + text);
    }
    return res.json();
  }

  function parseSheetNumber(cell) {
    if (typeof cell === 'number') return Number.isFinite(cell) ? cell : 0;
    var raw = String(cell == null ? '' : cell).trim().replace(/[^0-9.,-]/g, '');
    if (!raw) return 0;

    var lastComma = raw.lastIndexOf(',');
    var lastDot = raw.lastIndexOf('.');
    var normalized = raw;

    if (lastComma !== -1 && lastDot !== -1) {
      normalized = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    } else if (lastComma !== -1) {
      var commaCount = (raw.match(/,/g) || []).length;
      var decimals = raw.length - lastComma - 1;
      normalized = commaCount === 1 && decimals <= 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
    } else if (lastDot !== -1) {
      var dotCount = (raw.match(/\./g) || []).length;
      if (dotCount > 1) normalized = raw.replace(/\./g, '');
    }

    var parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function serializeAppData(data) {
    var cats = data.categories || window.AppStorage.DEFAULT_CATEGORIES;
    return {
      cuentas: (data.accounts || []).map(function (a, idx) {
        return [a.id || 'cta-' + (idx + 1), a.name, a.kind, a.description || '', a.initialBalance, a.creditLimit != null ? a.creditLimit : ''];
      }),
      tiposEgresos: cats.filter(function (c) { return c.type === 'Egreso'; }).map(function (c) {
        return [c.id, c.name, c.description || '', c.isArq ? 'SI' : 'NO'];
      }),
      tiposIngresos: cats.filter(function (c) { return c.type === 'Ingreso'; }).map(function (c) {
        return [c.id, c.name, c.description || ''];
      }),
      tiposTraspasos: cats.filter(function (c) { return c.type === 'Traspaso'; }).map(function (c) {
        return [c.id, c.name, c.description || ''];
      }),
      movimientos: (data.movements || []).map(function (m) {
        return [m.id, m.date, m.month, m.type, m.fromAccount, m.toAccount, m.category, m.description, m.amount, m.createdAt];
      }),
      obligaciones: (data.obligations || []).map(function (o) {
        return [o.id, o.name, o.category, o.estimatedAmount, o.matchType];
      }),
      cierres: (data.monthlyCloses || []).map(function (c) {
        return [c.month, c.closedAt, c.totalIncome, c.totalConsumptionExpense, c.totalArqInvestment, c.debitBalance, c.nequiBalance, c.cashBalance, c.ccDebt, c.liquidityTotal, c.ccSurplusOrDeficit, c.notes];
      }),
    };
  }

  function parseCategorySheet(rows, type, prefix) {
    return (rows || []).filter(function (r) { return r[1] || r[0]; }).map(function (r, idx) {
      return {
        id: String(r[0] || prefix + '-' + (idx + 1)),
        name: String(r[1] || r[0]),
        description: String(r[2] || ''),
        type: type,
        isArq: type === 'Egreso' && String(r[3] || '').toUpperCase() === 'SI',
      };
    });
  }

  function parseRawTables(accRaw, egresosRaw, ingresosRaw, traspasosRaw, movRaw, obRaw, closeRaw) {
    var movements = (movRaw || []).filter(function (r) { return r[0] && r[1]; }).map(function (r) {
      var dateStr = String(r[1]).slice(0, 10);
      var monthStr = r[2] ? String(r[2]).slice(0, 7) : dateStr.slice(0, 7);
      return {
        id: String(r[0]),
        date: dateStr,
        month: monthStr,
        type: String(r[3]) || 'Egreso',
        fromAccount: String(r[4]) || 'Tarjeta de Débito',
        toAccount: String(r[5]) || 'Externo',
        category: String(r[6] || 'Otros'),
        description: String(r[7] || ''),
        amount: parseSheetNumber(r[8]),
        createdAt: String(r[9] || new Date().toISOString()),
      };
    });

    var accounts = (accRaw || []).filter(function (r) { return r[1] || r[0]; }).map(function (r, idx) {
      var name = String(r[1] || r[0]);
      var rawKind = String(r[2] || '').toLowerCase();
      var kind = rawKind.indexOf('deuda') !== -1 || rawKind.indexOf('crédito') !== -1 || rawKind.indexOf('credito') !== -1 ? 'deuda' : 'liquidez';
      var parsedLimit = parseSheetNumber(r[5]);
      var item = {
        id: String(r[0] || 'cta-' + (idx + 1)),
        name: name,
        kind: kind,
        description: String(r[3] || ''),
        initialBalance: parseSheetNumber(r[4]),
      };
      if (kind === 'deuda') item.creditLimit = parsedLimit > 0 ? parsedLimit : 2400000;
      return item;
    });

    var parsedCategories = [].concat(
      parseCategorySheet(egresosRaw, 'Egreso', 'cat-e'),
      parseCategorySheet(ingresosRaw, 'Ingreso', 'cat-i'),
      parseCategorySheet(traspasosRaw, 'Traspaso', 'cat-t')
    );

    var categories = parsedCategories.length > 0 ? parsedCategories : window.AppStorage.DEFAULT_CATEGORIES.slice();

    var obligations = (obRaw || []).filter(function (r) { return r[0] && r[1]; }).map(function (r) {
      return {
        id: String(r[0]),
        name: String(r[1]),
        category: String(r[2] || r[1]),
        estimatedAmount: parseSheetNumber(r[3]),
        matchType: String(r[4]) === 'PagoTC' ? 'PagoTC' : 'Egreso',
      };
    });

    var monthlyCloses = (closeRaw || []).filter(function (r) { return r[0]; }).map(function (r) {
      return {
        month: String(r[0]).slice(0, 7),
        closedAt: String(r[1] || ''),
        totalIncome: Number(r[2]) || 0,
        totalConsumptionExpense: Number(r[3]) || 0,
        totalArqInvestment: Number(r[4]) || 0,
        debitBalance: Number(r[5]) || 0,
        nequiBalance: Number(r[6]) || 0,
        cashBalance: Number(r[7]) || 0,
        ccDebt: Number(r[8]) || 0,
        liquidityTotal: Number(r[9]) || 0,
        ccSurplusOrDeficit: Number(r[10]) || 0,
        notes: String(r[11] || ''),
      };
    });

    return { accounts: accounts, categories: categories, movements: movements, obligations: obligations, monthlyCloses: monthlyCloses };
  }

  async function findOrCreateSpreadsheet(token, preferredId) {
    if (preferredId) {
      try {
        await apiFetch(SHEETS_API + '/' + preferredId + '?fields=spreadsheetId', token);
        return { spreadsheetId: preferredId, isNew: false };
      } catch (e) { /* buscar o crear */ }
    }

    var q = encodeURIComponent("name='" + SPREADSHEET_TITLE + "' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    var search = await apiFetch(DRIVE_API + '?q=' + q + '&fields=files(id,name)', token);
    if (search.files && search.files.length > 0) {
      return { spreadsheetId: search.files[0].id, isNew: false };
    }

    var created = await apiFetch(SHEETS_API, token, {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: SPREADSHEET_TITLE, locale: 'es_CO' },
        sheets: Object.keys(SHEET_HEADERS).map(function (title) { return { properties: { title: title } }; }),
      }),
    });
    return { spreadsheetId: created.spreadsheetId, isNew: true };
  }

  async function writeAllToSpreadsheet(token, spreadsheetId, data) {
    var rangesToClear = Object.keys(SHEET_HEADERS).map(function (name) { return name + '!A1:Z5000'; });
    await apiFetch(SHEETS_API + '/' + spreadsheetId + '/values:batchClear', token, {
      method: 'POST',
      body: JSON.stringify({ ranges: rangesToClear }),
    });
    var serialized = serializeAppData(data);
    await apiFetch(SHEETS_API + '/' + spreadsheetId + '/values:batchUpdate', token, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'Cuentas!A1', values: [SHEET_HEADERS.Cuentas].concat(serialized.cuentas) },
          { range: 'Tipos_Egresos!A1', values: [SHEET_HEADERS.Tipos_Egresos].concat(serialized.tiposEgresos) },
          { range: 'Tipos_Ingresos!A1', values: [SHEET_HEADERS.Tipos_Ingresos].concat(serialized.tiposIngresos) },
          { range: 'Tipos_Traspasos!A1', values: [SHEET_HEADERS.Tipos_Traspasos].concat(serialized.tiposTraspasos) },
          { range: 'Movimientos!A1', values: [SHEET_HEADERS.Movimientos].concat(serialized.movimientos) },
          { range: 'Obligaciones_Fijas!A1', values: [SHEET_HEADERS.Obligaciones_Fijas].concat(serialized.obligaciones) },
          { range: 'Cierres_Mensuales!A1', values: [SHEET_HEADERS.Cierres_Mensuales].concat(serialized.cierres) },
        ],
      }),
    });
  }

  async function readAllFromSpreadsheet(token, spreadsheetId) {
    var ranges = [
      'Cuentas!A2:F100',
      'Tipos_Egresos!A2:D500',
      'Tipos_Ingresos!A2:C500',
      'Tipos_Traspasos!A2:C500',
      'Movimientos!A2:J5000',
      'Obligaciones_Fijas!A2:E200',
      'Cierres_Mensuales!A2:L500',
    ].map(function (r) { return 'ranges=' + encodeURIComponent(r); }).join('&');

    var res = await apiFetch(SHEETS_API + '/' + spreadsheetId + '/values:batchGet?' + ranges, token);
    var vrs = res.valueRanges.map(function (vr) { return vr.values || []; });
    return parseRawTables(vrs[0], vrs[1], vrs[2], vrs[3], vrs[4], vrs[5], vrs[6]);
  }

  async function readFromAppsScript(scriptUrl) {
    var res = await fetch(scriptUrl, { method: 'GET' });
    if (!res.ok) throw new Error('Error al leer Apps Script (' + res.status + ')');
    var json = await res.json();
    return {
      spreadsheetUrl: json.spreadsheetUrl,
      data: parseRawTables(
        json.cuentas || [],
        json.tiposEgresos || [],
        json.tiposIngresos || [],
        json.tiposTraspasos || [],
        json.movimientos || [],
        json.obligaciones || [],
        json.cierres || []
      ),
    };
  }

  async function writeToAppsScript(scriptUrl, data) {
    var serialized = serializeAppData(data);
    var res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(serialized),
    });
    if (!res.ok) throw new Error('Error al guardar en Apps Script (' + res.status + ')');
    var json = await res.json();
    return { spreadsheetUrl: json.spreadsheetUrl };
  }

  window.GoogleSheetsService = {
    GOOGLE_SCOPES: GOOGLE_SCOPES,
    findOrCreateSpreadsheet: findOrCreateSpreadsheet,
    writeAllToSpreadsheet: writeAllToSpreadsheet,
    readAllFromSpreadsheet: readAllFromSpreadsheet,
    readFromAppsScript: readFromAppsScript,
    writeToAppsScript: writeToAppsScript,
  };
})();

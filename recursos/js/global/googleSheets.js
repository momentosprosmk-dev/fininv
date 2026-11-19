(function () {
  function sha256Hex(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    var hash = (sha256Hex.h = sha256Hex.h || []);
    var k = (sha256Hex.k = sha256Hex.k || []);
    var primeCounter = k[lengthProperty];
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;
    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, (j += 16));
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  function hashPassword(pwd) {
    var utf8 = unescape(encodeURIComponent(String(pwd || '')));
    return sha256Hex(utf8);
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
        var cleanDesc = String(a.description || '')
          .replace(/\s*\[icon:[a-z]+\]/g, '')
          .replace(/\s*\[credito:[^\]]+\]/g, '')
          .replace(/\s*\[corte:\d+\]/g, '')
          .trim();
        var parts = [];
        if (cleanDesc) parts.push(cleanDesc);
        if (a.icon && a.icon !== 'auto') parts.push('[icon:' + a.icon + ']');
        if (a.kind === 'credito') {
          parts.push('[credito:' + (Number(a.totalMonths) || 12) + ':' + (Number(a.monthlyInstallment) || 0) + ':' + (a.inMora ? 1 : 0) + ':' + (Number(a.dueDay) || 0) + ':' + (a.startMonth || '') + ']');
        }
        if (idx === 0 && window.AppFormat && window.AppFormat.getMonthCloseDay) {
          var closeDay = window.AppFormat.getMonthCloseDay();
          if (closeDay > 0) parts.push('[corte:' + closeDay + ']');
        }
        return [a.id || 'cta-' + (idx + 1), a.name, a.kind, parts.join(' '), a.initialBalance, a.creditLimit != null ? a.creditLimit : ''];
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
        var desc = String(m.description || '').replace(/\s*\[cuotaReq:[^\]]+\]/g, '').trim();
        if (Number(m.creditRequiredAmount) > 0) {
          desc = (desc ? desc + ' ' : '') + '[cuotaReq:' + Number(m.creditRequiredAmount) + ']';
        }
        return [m.id, m.date, m.month, m.type, m.fromAccount, m.toAccount, m.category, desc, m.amount, m.createdAt];
      }),
      obligaciones: (data.obligations || []).map(function (o) {
        return [o.id, o.name, o.category, o.estimatedAmount, o.matchType];
      }),
      cierres: (data.monthlyCloses || []).map(function (c) {
        return [c.month, c.closedAt, c.totalIncome, c.totalConsumptionExpense, c.totalArqInvestment, c.debitBalance, c.nequiBalance, c.cashBalance, c.ccDebt, c.liquidityTotal, c.ccSurplusOrDeficit, c.notes];
      }),
      cuentasInversion: (data.investmentAccounts || []).map(function (a, idx) {
        return [a.id || 'inv-' + (idx + 1), a.name, a.mode || 'simple', a.currency || 'COP', a.initialBalance || 0, a.goal || 0, a.notes || ''];
      }),
      subinversiones: (data.subInvestments || []).map(function (s, idx) {
        return [s.id || 'sub-' + (idx + 1), s.fundName, s.name, s.initialBalance || 0, s.notes || ''];
      }),
      movimientosInversion: (data.investmentMovements || []).map(function (m) {
        return [m.id, m.date, m.type, m.fundName, m.subName || '', m.normalAccount || '', m.description || '', m.amount || 0, m.commission || 0, m.commissionApply || 'moved', m.exchangeRate || 1, m.amountCOP || 0, m.linkedMovementId || '', m.createdAt || ''];
      }),
      prestamos: (data.loans || []).map(function (l) {
        return [l.id, l.borrower || '', l.fromAccount || '', l.principal || 0, l.interestRate || 0, l.interestMode || 'none', l.totalDue || 0, l.installments || 1, l.frequency || 'mensual', l.startDate || '', l.notes || '', l.linkedMovementId || '', l.createdAt || ''];
      }),
      pagosPrestamos: (data.loanPayments || []).map(function (p) {
        return [p.id, p.loanId || '', p.date || '', p.toAccount || '', p.amount || 0, p.notes || '', p.linkedMovementId || '', p.createdAt || ''];
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

  function parseRawTables(accRaw, egresosRaw, ingresosRaw, traspasosRaw, movRaw, obRaw, closeRaw, invAccRaw, subInvRaw, invMovRaw, loansRaw, loanPayRaw) {
    var movements = (movRaw || []).filter(function (r) { return r[0] && r[1]; }).map(function (r) {
      var dateStr = String(r[1]).slice(0, 10);
      var monthStr = r[2] ? String(r[2]).slice(0, 7) : dateStr.slice(0, 7);
      var rawMovDesc = String(r[7] || '');
      var cuotaReqMatch = rawMovDesc.match(/\[cuotaReq:([\d.]+)\]/);
      var cleanMovDesc = rawMovDesc.replace(/\s*\[cuotaReq:[^\]]+\]/g, '').trim();
      var movItem = {
        id: String(r[0]),
        date: dateStr,
        month: monthStr,
        type: String(r[3]) || 'Egreso',
        fromAccount: String(r[4]) || 'Tarjeta de Débito',
        toAccount: String(r[5]) || 'Externo',
        category: String(r[6] || 'Otros'),
        description: cleanMovDesc,
        amount: parseSheetNumber(r[8]),
        createdAt: String(r[9] || new Date().toISOString()),
      };
      if (cuotaReqMatch) movItem.creditRequiredAmount = Number(cuotaReqMatch[1]) || 0;
      return movItem;
    });

    var accounts = (accRaw || []).filter(function (r) { return r[1] || r[0]; }).map(function (r, idx) {
      var name = String(r[1] || r[0]);
      var rawKind = String(r[2] || '').toLowerCase().trim();
      var rawDesc = String(r[3] || '');
      var creditoMatch = rawDesc.match(/\[credito:(\d+):([\d.]+):([01])(?::(\d+))?(?::(\d{4}-\d{2})?)?\]/);
      var kind = 'liquidez';
      if (rawKind === 'credito' || creditoMatch) {
        kind = 'credito';
      } else if (rawKind.indexOf('deuda') !== -1 || rawKind.indexOf('crédito') !== -1 || rawKind.indexOf('credito') !== -1) {
        kind = 'deuda';
      }
      var parsedLimit = parseSheetNumber(r[5]);
      var iconMatch = rawDesc.match(/\[icon:([a-z]+)\]/);
      var parsedIcon = iconMatch ? iconMatch[1] : 'auto';
      var corteMatch = rawDesc.match(/\[corte:(\d+)\]/);
      if (corteMatch && window.AppFormat && window.AppFormat.setMonthCloseDay) {
        window.AppFormat.setMonthCloseDay(Number(corteMatch[1]));
      }
      var cleanDesc = rawDesc
        .replace(/\s*\[icon:[a-z]+\]/g, '')
        .replace(/\s*\[credito:[^\]]+\]/g, '')
        .replace(/\s*\[corte:\d+\]/g, '')
        .trim();
      var item = {
        id: String(r[0] || 'cta-' + (idx + 1)),
        name: name,
        kind: kind,
        icon: parsedIcon,
        description: cleanDesc,
        initialBalance: parseSheetNumber(r[4]),
      };
      if (kind === 'deuda') item.creditLimit = parsedLimit > 0 ? parsedLimit : 2400000;
      if (kind === 'credito') {
        item.totalMonths = creditoMatch ? Number(creditoMatch[1]) || 12 : 12;
        item.monthlyInstallment = creditoMatch ? Number(creditoMatch[2]) || 0 : 0;
        item.inMora = creditoMatch ? creditoMatch[3] === '1' : false;
        item.dueDay = creditoMatch && creditoMatch[4] ? Number(creditoMatch[4]) || 0 : 0;
        if (creditoMatch && creditoMatch[5]) item.startMonth = creditoMatch[5];
      }
      return item;
    });

    var parsedCategories = [].concat(
      parseCategorySheet(egresosRaw, 'Egreso', 'cat-e'),
      parseCategorySheet(ingresosRaw, 'Ingreso', 'cat-i'),
      parseCategorySheet(traspasosRaw, 'Traspaso', 'cat-t')
    );

    var categories = parsedCategories.length > 0 ? parsedCategories : window.AppStorage.DEFAULT_CATEGORIES.slice();

    var obligations = (obRaw || []).filter(function (r) { return r[1] || r[0]; }).map(function (r, idx) {
      var name = String(r[1] || r[0]).trim();
      var id = r[0] ? String(r[0]).trim() : 'ob-sheet-' + (idx + 1);
      var rawMatch = String(r[4] || '').trim().toLowerCase();
      return {
        id: id,
        name: name,
        category: String(r[2] || name).trim(),
        estimatedAmount: parseSheetNumber(r[3]),
        matchType: rawMatch === 'pagotc' ? 'PagoTC' : 'Egreso',
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

    var investmentAccounts = (invAccRaw || []).filter(function (r) { return r[1] || r[0]; }).map(function (r, idx) {
      var rawMode = String(r[2] || 'simple').toLowerCase();
      return {
        id: String(r[0] || 'inv-' + (idx + 1)),
        name: String(r[1] || r[0]),
        mode: rawMode === 'fragmentado' ? 'fragmentado' : 'simple',
        currency: String(r[3] || 'COP').toUpperCase(),
        initialBalance: parseSheetNumber(r[4]),
        goal: parseSheetNumber(r[5]),
        notes: String(r[6] || ''),
      };
    });

    var subInvestments = (subInvRaw || []).filter(function (r) { return r[1] && r[2]; }).map(function (r, idx) {
      return {
        id: String(r[0] || 'sub-' + (idx + 1)),
        fundName: String(r[1]),
        name: String(r[2]),
        initialBalance: parseSheetNumber(r[3]),
        notes: String(r[4] || ''),
      };
    });

    var investmentMovements = (invMovRaw || []).filter(function (r) { return r[0] && r[1]; }).map(function (r) {
      return {
        id: String(r[0]),
        date: String(r[1]).slice(0, 10),
        type: String(r[2] || 'Aporte'),
        fundName: String(r[3] || ''),
        subName: String(r[4] || ''),
        normalAccount: String(r[5] || ''),
        description: String(r[6] || ''),
        amount: parseSheetNumber(r[7]),
        commission: parseSheetNumber(r[8]),
        commissionApply: String(r[9]) === 'fund' ? 'fund' : 'moved',
        exchangeRate: parseSheetNumber(r[10]) || 1,
        amountCOP: parseSheetNumber(r[11]),
        linkedMovementId: String(r[12] || ''),
        createdAt: String(r[13] || new Date().toISOString()),
      };
    });

    var loans = (loansRaw || []).filter(function (r) { return r[0] && r[1]; }).map(function (r) {
      return {
        id: String(r[0]),
        borrower: String(r[1] || ''),
        fromAccount: String(r[2] || ''),
        principal: parseSheetNumber(r[3]),
        interestRate: parseSheetNumber(r[4]),
        interestMode: String(r[5] || 'none'),
        totalDue: parseSheetNumber(r[6]),
        installments: Math.max(1, parseSheetNumber(r[7]) || 1),
        frequency: String(r[8] || 'mensual'),
        startDate: String(r[9] || '').slice(0, 10),
        notes: String(r[10] || ''),
        linkedMovementId: String(r[11] || ''),
        createdAt: String(r[12] || new Date().toISOString()),
      };
    });

    var loanPayments = (loanPayRaw || []).filter(function (r) { return r[0] && r[1]; }).map(function (r) {
      return {
        id: String(r[0]),
        loanId: String(r[1] || ''),
        date: String(r[2] || '').slice(0, 10),
        toAccount: String(r[3] || ''),
        amount: parseSheetNumber(r[4]),
        notes: String(r[5] || ''),
        linkedMovementId: String(r[6] || ''),
        createdAt: String(r[7] || new Date().toISOString()),
      };
    });

    return {
      accounts: accounts,
      categories: categories,
      movements: movements,
      obligations: obligations,
      monthlyCloses: monthlyCloses,
      investmentAccounts: investmentAccounts,
      subInvestments: subInvestments,
      investmentMovements: investmentMovements,
      loans: loans,
      loanPayments: loanPayments,
    };
  }

  function parseAppsScriptResponse(json) {
    if (!json || json.ok === false) {
      throw new Error((json && json.error) || 'No se pudo autenticar o leer el Google Sheet.');
    }
    return {
      spreadsheetUrl: json.spreadsheetUrl,
      data: parseRawTables(
        json.cuentas || [],
        json.tiposEgresos || [],
        json.tiposIngresos || [],
        json.tiposTraspasos || [],
        json.movimientos || [],
        json.obligaciones || [],
        json.cierres || [],
        json.cuentasInversion || [],
        json.subinversiones || [],
        json.movimientosInversion || [],
        json.prestamos || [],
        json.pagosPrestamos || []
      ),
    };
  }

  async function readFromAppsScript(scriptUrl, auth) {
    if (auth && ((auth.username && auth.passwordHash) || auth.email)) {
      var postRes = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'pull', auth: auth }),
      });
      if (!postRes.ok) throw new Error('Error al leer Apps Script (' + postRes.status + ')');
      return parseAppsScriptResponse(await postRes.json());
    }
    var res = await fetch(scriptUrl, { method: 'GET' });
    if (!res.ok) throw new Error('Error al leer Apps Script (' + res.status + ')');
    return parseAppsScriptResponse(await res.json());
  }

  async function registerAppsScriptUser(scriptUrl, auth, data) {
    var serialized = serializeAppData(data);
    var body = Object.assign({ action: 'auth_register', auth: auth }, serialized);
    var res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Error al registrar usuario en Apps Script (' + res.status + ')');
    var json = await res.json();
    if (!json || json.ok === false) {
      throw new Error((json && json.error) || 'No se pudo registrar el usuario.');
    }
    return { spreadsheetUrl: json.spreadsheetUrl };
  }

  async function loginAppsScriptUser(scriptUrl, auth) {
    var res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'auth_login', auth: auth }),
    });
    if (!res.ok) throw new Error('Error al iniciar sesión en Apps Script (' + res.status + ')');
    var json = await res.json();
    if (!json || json.ok === false) {
      throw new Error((json && json.error) || 'Usuario o contraseña incorrectos.');
    }
    if (!json.authenticated) {
      throw new Error('Tu Google Sheet tiene una versión anterior de Code.gs sin validación de usuario. Actualiza Code.gs en Extensiones > Apps Script > Implementar > Nueva versión.');
    }
    return parseAppsScriptResponse(json);
  }

  async function updateAppsScriptUser(scriptUrl, currentAuth, newAuth) {
    var res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'auth_update', auth: currentAuth || null, newAuth: newAuth }),
    });
    if (!res.ok) throw new Error('Error al actualizar credenciales en Apps Script (' + res.status + ')');
    var json = await res.json();
    if (!json || json.ok === false) {
      throw new Error((json && json.error) || 'No se pudieron actualizar las credenciales.');
    }
    return json;
  }

  async function writeToAppsScript(scriptUrl, data, auth) {
    var serialized = serializeAppData(data);
    var payload = Object.assign({ action: 'push', auth: auth || null }, serialized);
    var res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Error al guardar en Apps Script (' + res.status + ')');
    var json = await res.json();
    if (!json || json.ok === false) {
      throw new Error((json && json.error) || 'No autorizado para guardar en el Google Sheet.');
    }
    return { spreadsheetUrl: json.spreadsheetUrl };
  }

  async function manageAppsScriptUsers(scriptUrl, action, auth, extra) {
    var payload = Object.assign({ action: action, auth: auth || null }, extra || {});
    var res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Error al gestionar usuarios (' + res.status + ')');
    var json = await res.json();
    if (!json || json.ok === false) {
      throw new Error((json && json.error) || 'No se pudo completar la operación.');
    }
    return json;
  }

  window.GoogleSheetsService = {
    hashPassword: hashPassword,
    readFromAppsScript: readFromAppsScript,
    registerAppsScriptUser: registerAppsScriptUser,
    loginAppsScriptUser: loginAppsScriptUser,
    updateAppsScriptUser: updateAppsScriptUser,
    writeToAppsScript: writeToAppsScript,
    manageAppsScriptUsers: manageAppsScriptUsers,
  };
})();

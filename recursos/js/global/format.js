(function () {
  var BASE_CURRENCY_STORAGE_KEY = 'fininv_base_currency';
  var CUSTOM_CURRENCIES_STORAGE_KEY = 'fininv_custom_currencies';
  var MONTH_CLOSE_DAY_STORAGE_KEY = 'fininv_month_close_day';

  var CURRENCY_CATALOG = {
    COP: { code: 'COP', label: 'Peso colombiano (COP)', symbol: '$', locale: 'es-CO', decimals: 0 },
    USD: { code: 'USD', label: 'Dólar estadounidense (USD)', symbol: 'US$', locale: 'en-US', decimals: 2 },
    EUR: { code: 'EUR', label: 'Euro (EUR)', symbol: '€', locale: 'es-ES', decimals: 2 },
    MXN: { code: 'MXN', label: 'Peso mexicano (MXN)', symbol: 'MX$', locale: 'es-MX', decimals: 2 },
    CLP: { code: 'CLP', label: 'Peso chileno (CLP)', symbol: 'CL$', locale: 'es-CL', decimals: 0 },
    PEN: { code: 'PEN', label: 'Sol peruano (PEN)', symbol: 'S/', locale: 'es-PE', decimals: 2 },
    ARS: { code: 'ARS', label: 'Peso argentino (ARS)', symbol: 'AR$', locale: 'es-AR', decimals: 2 },
    BRL: { code: 'BRL', label: 'Real brasileño (BRL)', symbol: 'R$', locale: 'pt-BR', decimals: 2 },
    GBP: { code: 'GBP', label: 'Libra esterlina (GBP)', symbol: '£', locale: 'en-GB', decimals: 2 },
  };

  // Cargar automáticamente todas las divisas ISO 4217 soportadas por el navegador
  (function buildFullIsoCatalog() {
    if (typeof Intl === 'undefined' || typeof Intl.supportedValuesOf !== 'function') return;
    try {
      var displayNames = typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames(['es'], { type: 'currency' })
        : null;
      var codes = Intl.supportedValuesOf('currency');
      codes.forEach(function (code) {
        if (CURRENCY_CATALOG[code]) return;
        var decimals = 2;
        try {
          decimals = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
        } catch (e) { /* default 2 */ }
        var rawName = displayNames ? (displayNames.of(code) || code) : code;
        var niceName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        CURRENCY_CATALOG[code] = {
          code: code,
          label: niceName + ' (' + code + ')',
          symbol: code + ' ',
          locale: decimals === 0 ? 'es-CO' : 'en-US',
          decimals: decimals,
        };
      });
    } catch (e) { /* fallback al catálogo base */ }
  })();

  var formattersCache = {};

  function loadCustomCurrencies() {
    try {
      var raw = localStorage.getItem(CUSTOM_CURRENCIES_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function getAllCurrenciesMap() {
    return Object.assign({}, CURRENCY_CATALOG, loadCustomCurrencies());
  }

  function addCustomCurrency(code, label, decimals) {
    var upper = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(upper)) {
      throw new Error('Ingresa un código ISO válido de 3 letras (ej. CAD, BOB, UYU).');
    }
    // Validar que Intl.NumberFormat reconozca el código ISO
    try {
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: upper }).format(1);
    } catch (e) {
      throw new Error('Código de divisa no reconocido (' + upper + '). Usa un código ISO 4217 válido.');
    }
    var dec = Number(decimals) === 0 ? 0 : 2;
    var cleanLabel = String(label || '').trim();
    var entry = {
      code: upper,
      label: cleanLabel ? (cleanLabel + ' (' + upper + ')') : upper,
      symbol: upper + ' ',
      locale: dec === 0 ? 'es-CO' : 'en-US',
      decimals: dec,
    };
    var custom = loadCustomCurrencies();
    custom[upper] = entry;
    try {
      localStorage.setItem(CUSTOM_CURRENCIES_STORAGE_KEY, JSON.stringify(custom));
    } catch (e) { /* ignore */ }
    delete formattersCache[upper];
    return entry;
  }

  function getBaseCurrency() {
    try {
      var saved = String(localStorage.getItem(BASE_CURRENCY_STORAGE_KEY) || 'COP').toUpperCase();
      var all = getAllCurrenciesMap();
      return all[saved] ? saved : 'COP';
    } catch (e) {
      return 'COP';
    }
  }

  function setBaseCurrency(code) {
    var upper = String(code || 'COP').toUpperCase();
    var all = getAllCurrenciesMap();
    var valid = all[upper] ? upper : 'COP';
    try {
      localStorage.setItem(BASE_CURRENCY_STORAGE_KEY, valid);
    } catch (e) { /* ignore */ }
    return valid;
  }

  function getCurrencyMeta(code) {
    var all = getAllCurrenciesMap();
    return all[code] || all[getBaseCurrency()] || CURRENCY_CATALOG.COP;
  }

  function getSupportedCurrencies() {
    var all = getAllCurrenciesMap();
    return Object.keys(all).map(function (k) { return all[k]; });
  }

  function formatCurrency(value, currencyCode) {
    var base = getBaseCurrency();
    var meta = getCurrencyMeta(currencyCode || base);
    if (!formattersCache[meta.code]) {
      formattersCache[meta.code] = new Intl.NumberFormat(meta.locale, {
        style: 'currency',
        currency: meta.code,
        minimumFractionDigits: meta.decimals === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });
    }
    var formatted = formattersCache[meta.code].format(Number(value) || 0);
    return meta.code === base ? formatted : meta.code + ' ' + formatted;
  }

  function maskCurrency(value, currencyCode, hideValues) {
    var base = getBaseCurrency();
    if (hideValues) {
      var meta = getCurrencyMeta(currencyCode || base);
      return meta.symbol + ' ••••••';
    }
    return formatCurrency(value, currencyCode);
  }

  function formatCOP(value) {
    return formatCurrency(value, getBaseCurrency());
  }

  function maskCOP(value, hideValues) {
    return maskCurrency(value, getBaseCurrency(), hideValues);
  }

  function formatMonthLabel(monthKey) {
    var parts = String(monthKey || '').split('-');
    var year = Number(parts[0]);
    var monthIndex = Number(parts[1]) - 1;
    if (!year || monthIndex < 0 || monthIndex > 11) return monthKey;
    var date = new Date(year, monthIndex, 1);
    var label = new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function getMonthCloseDay() {
    var raw = Number(localStorage.getItem(MONTH_CLOSE_DAY_STORAGE_KEY) || 0);
    if (!Number.isFinite(raw) || raw <= 0 || raw >= 31) return 0;
    return Math.floor(raw);
  }

  function setMonthCloseDay(day) {
    var n = Math.floor(Number(day) || 0);
    if (n <= 0 || n >= 31) n = 0;
    localStorage.setItem(MONTH_CLOSE_DAY_STORAGE_KEY, String(n));
    return n;
  }

  function getAccountingMonthForDate(dateStr, closeDayOverride) {
    var s = String(dateStr || '').trim();
    if (s.length < 7) return s;
    var closeDay = closeDayOverride != null ? Number(closeDayOverride) : getMonthCloseDay();
    if (!closeDay || closeDay <= 0 || closeDay >= 31) return s.slice(0, 7);
    var parts = s.slice(0, 10).split('-').map(Number);
    var y = parts[0], m = parts[1], d = parts[2];
    if (!y || !m || !d) return s.slice(0, 7);
    var daysInM = new Date(y, m, 0).getDate();
    var effClose = Math.min(closeDay, daysInM);
    if (d >= effClose) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return y + '-' + String(m).padStart(2, '0');
  }

  function getAccountingPeriodRange(monthKey, closeDayOverride) {
    var parts = String(monthKey || '').split('-').map(Number);
    var y = parts[0], m = parts[1];
    if (!y || !m) return { startISO: '', endISO: '', label: '' };
    var closeDay = closeDayOverride != null ? Number(closeDayOverride) : getMonthCloseDay();
    var daysInM = new Date(y, m, 0).getDate();
    var startDate, endDate;
    if (!closeDay || closeDay <= 0 || closeDay >= 31) {
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m - 1, daysInM);
    } else {
      var py = m === 1 ? y - 1 : y;
      var pm = m === 1 ? 12 : m - 1;
      var prevDays = new Date(py, pm, 0).getDate();
      var prevClose = Math.min(closeDay, prevDays);
      var effClose = Math.min(closeDay, daysInM);
      startDate = new Date(py, pm - 1, prevClose);
      endDate = new Date(y, m - 1, effClose - 1);
    }
    var toISO = function (dt) {
      return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    };
    var shortFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      startISO: toISO(startDate),
      endISO: toISO(endDate),
      label: shortFmt.format(startDate) + ' al ' + shortFmt.format(endDate),
    };
  }

  function getCurrentMonthKey() {
    return getAccountingMonthForDate(getTodayISO());
  }

  function getTodayISO() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function parseDecimalInput(raw) {
    var normalized = String(raw || '').replace(',', '.').replace(/[^0-9.]/g, '');
    var n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  window.AppFormat = {
    CURRENCY_CATALOG: CURRENCY_CATALOG,
    getBaseCurrency: getBaseCurrency,
    setBaseCurrency: setBaseCurrency,
    addCustomCurrency: addCustomCurrency,
    getCurrencyMeta: getCurrencyMeta,
    getSupportedCurrencies: getSupportedCurrencies,
    formatCurrency: formatCurrency,
    maskCurrency: maskCurrency,
    formatCOP: formatCOP,
    maskCOP: maskCOP,
    formatMonthLabel: formatMonthLabel,
    getMonthCloseDay: getMonthCloseDay,
    setMonthCloseDay: setMonthCloseDay,
    getAccountingMonthForDate: getAccountingMonthForDate,
    getAccountingPeriodRange: getAccountingPeriodRange,
    getCurrentMonthKey: getCurrentMonthKey,
    getTodayISO: getTodayISO,
    parseDecimalInput: parseDecimalInput,
  };
})();

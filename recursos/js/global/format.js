(function () {
  var BASE_CURRENCY_STORAGE_KEY = 'fininv_base_currency';
  var CUSTOM_CURRENCIES_STORAGE_KEY = 'fininv_custom_currencies';

  var CURRENCY_CATALOG = {
    COP: { code: 'COP', label: 'Peso Colombiano (COP)', symbol: '$', locale: 'es-CO', decimals: 0 },
    USD: { code: 'USD', label: 'Dólar EEUU (USD)', symbol: 'US$', locale: 'en-US', decimals: 2 },
    EUR: { code: 'EUR', label: 'Euro (EUR)', symbol: '€', locale: 'es-ES', decimals: 2 },
    MXN: { code: 'MXN', label: 'Peso Mexicano (MXN)', symbol: 'MX$', locale: 'es-MX', decimals: 2 },
    CLP: { code: 'CLP', label: 'Peso Chileno (CLP)', symbol: 'CL$', locale: 'es-CL', decimals: 0 },
    PEN: { code: 'PEN', label: 'Sol Peruano (PEN)', symbol: 'S/', locale: 'es-PE', decimals: 2 },
    ARS: { code: 'ARS', label: 'Peso Argentino (ARS)', symbol: 'AR$', locale: 'es-AR', decimals: 2 },
    BRL: { code: 'BRL', label: 'Real Brasileño (BRL)', symbol: 'R$', locale: 'pt-BR', decimals: 2 },
    GBP: { code: 'GBP', label: 'Libra Esterlina (GBP)', symbol: '£', locale: 'en-GB', decimals: 2 },
  };

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

  function getCurrentMonthKey() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
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
    getCurrentMonthKey: getCurrentMonthKey,
    getTodayISO: getTodayISO,
    parseDecimalInput: parseDecimalInput,
  };
})();

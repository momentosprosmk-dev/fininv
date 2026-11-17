(function () {
  var CURRENCY_CATALOG = {
    COP: { code: 'COP', label: 'Peso Colombiano (COP)', symbol: '$', locale: 'es-CO', decimals: 0 },
    USD: { code: 'USD', label: 'Dólar EEUU (USD)', symbol: 'US$', locale: 'en-US', decimals: 2 },
  };

  var formattersCache = {};

  function getCurrencyMeta(code) {
    return CURRENCY_CATALOG[code] || CURRENCY_CATALOG.COP;
  }

  function getSupportedCurrencies() {
    return Object.keys(CURRENCY_CATALOG).map(function (k) { return CURRENCY_CATALOG[k]; });
  }

  function formatCurrency(value, currencyCode) {
    var meta = getCurrencyMeta(currencyCode || 'COP');
    if (!formattersCache[meta.code]) {
      formattersCache[meta.code] = new Intl.NumberFormat(meta.locale, {
        style: 'currency',
        currency: meta.code,
        minimumFractionDigits: meta.decimals === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });
    }
    var formatted = formattersCache[meta.code].format(Number(value) || 0);
    return meta.code === 'COP' ? formatted : meta.code + ' ' + formatted;
  }

  function maskCurrency(value, currencyCode, hideValues) {
    if (hideValues) {
      var meta = getCurrencyMeta(currencyCode || 'COP');
      return meta.symbol + ' ••••••';
    }
    return formatCurrency(value, currencyCode);
  }

  var copFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  function formatCOP(value) {
    return copFormatter.format(Number(value) || 0);
  }

  function maskCOP(value, hideValues) {
    if (hideValues) return '$ ••••••';
    return formatCOP(value);
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

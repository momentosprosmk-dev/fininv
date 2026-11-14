(function () {
  var copFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  function formatCOP(value) {
    return copFormatter.format(Number(value) || 0);
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
    formatCOP: formatCOP,
    formatMonthLabel: formatMonthLabel,
    getCurrentMonthKey: getCurrentMonthKey,
    getTodayISO: getTodayISO,
    parseDecimalInput: parseDecimalInput,
  };
})();

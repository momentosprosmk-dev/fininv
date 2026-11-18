// enlaces.js | Enlaces y fecha de actualización en tyc.html

document.addEventListener("DOMContentLoaded", function () {
  var fechaEl = document.getElementById("fecha-tyc");
  if (fechaEl && window.tyc_fecha) {
    fechaEl.innerHTML = "<strong>Última actualización:</strong> " + window.tyc_fecha;
  }

  var urlEl = document.getElementById("urlsmk");
  if (urlEl && window.urlsmk) {
    urlEl.href = window.urlsmk;
  }

  var wasEl = document.getElementById("wasmk");
  if (wasEl && window.wasmk) {
    wasEl.href = window.wasmk;
  }
});

// control.js | Control de aceptación en /tyc/

document.addEventListener("DOMContentLoaded", function () {
  var btnAceptar = document.getElementById("btn-aceptar");
  var btnRechazar = document.getElementById("btn-rechazar");

  if (btnAceptar) {
    btnAceptar.addEventListener("click", function () {
      localStorage.setItem("tyc", window.tyc_fecha || "1");
      window.location.href = "/";
    });
  }

  if (btnRechazar) {
    btnRechazar.addEventListener("click", function () {
      localStorage.setItem("tyc", "0");
      window.location.href = "/";
    });
  }
});

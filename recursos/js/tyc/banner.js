// banner.js | Gestión del banner TyC

function iniciarBannerTyC(tycFechaActual) {
  var bannerTyc = document.getElementById("banner-tyc");
  var btnAceptar = document.getElementById("btn-aceptar-tyc");
  var btnRechazar = document.getElementById("btn-rechazar-tyc");
  var linkTyc = document.getElementById("link-tyc");

  if (!bannerTyc || !btnAceptar || !linkTyc) return;

  var tycEstado = localStorage.getItem("tyc");

  if (tycEstado !== tycFechaActual) {
    bannerTyc.classList.add("visible");
    document.body.classList.add("no-scroll");
  }

  btnAceptar.addEventListener("click", function () {
    localStorage.setItem("tyc", tycFechaActual);
    bannerTyc.classList.remove("visible");
    document.body.classList.remove("no-scroll");
  });

  if (btnRechazar && window.bannerConfig && window.bannerConfig.rechazarRuta) {
    btnRechazar.addEventListener("click", function () {
      localStorage.setItem("tyc", "0");
      window.location.href = window.bannerConfig.rechazarRuta;
    });
  }

  linkTyc.addEventListener("click", function (e) {
    e.preventDefault();
    if (window.bannerConfig && window.bannerConfig.linkRuta) {
      window.location.href = window.bannerConfig.linkRuta;
    }
  });
}

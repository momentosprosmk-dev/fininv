// validador.js | Validador de TyC para FinInv

document.addEventListener("DOMContentLoaded", function () {
  var tycValue = localStorage.getItem("tyc");
  if (tycValue && typeof window.tyc_fecha !== "undefined" && tycValue === window.tyc_fecha) {
    var container = document.getElementById("tyc-container");
    if (container) container.remove();
    return;
  }
  iniciarBannerTyCLoad();
});

function iniciarBannerTyCLoad() {
  window.bannerConfig = {
    cssRuta: "/recursos/css/tyc/banner.css",
    linkRuta: "/tyc/",
    rechazarRuta: "/",
    logoRuta: "/recursos/media/global/fininv_logo.avif"
  };

  fetch("/recursos/html/tyc/banner.html")
    .then(function (res) { return res.text(); })
    .then(function (html) {
      var container = document.getElementById("tyc-container");
      if (!container) return;
      container.innerHTML = html;

      var containerLogo = document.getElementById("logo-banner");
      if (containerLogo && window.bannerConfig && window.bannerConfig.logoRuta) {
        var logoImg = document.createElement("img");
        logoImg.src = window.bannerConfig.logoRuta;
        logoImg.alt = "FinInv";
        logoImg.loading = "lazy";
        logoImg.decoding = "async";
        containerLogo.appendChild(logoImg);
      }

      if (window.cargarCSS) {
        window.cargarCSS(window.bannerConfig.cssRuta);
      }

      if (window.cargarJS) {
        window.cargarJS("/recursos/js/tyc/banner.js", function () {
          if (typeof iniciarBannerTyC === "function") {
            iniciarBannerTyC(window.tyc_fecha);
          }
        });
      }
    })
    .catch(function (err) {
      console.error("Error cargando banner TyC:", err);
    });
}

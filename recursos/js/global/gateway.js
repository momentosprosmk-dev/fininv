// Utilidades globales (estilo gateway.js de MomentosPro)
(function () {
  window.tyc_fecha = "Viernes 20 de Noviembre, 2026";
  window.urlsmk = "https://www.momentospro.com/";
  window.wasmk = "https://wa.me/573011529382?text=Hola.%20Uso%20FinInv%20y%20tengo%20dudas%20sobre%20los%20T%C3%A9rminos%20y%20Condiciones.%20%C2%BFMe%20pueden%20orientar%3F";

  window.cargarCSS = function (href, mediaQuery) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    if (mediaQuery) link.media = mediaQuery;
    document.head.appendChild(link);
  };

  window.cargarJS = function (src, onReady) {
    var existente = document.querySelector('script[src="' + src + '"]');
    if (existente) {
      if (typeof onReady === 'function') onReady();
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    if (typeof onReady === 'function') {
      script.onload = onReady;
    }
    document.body.appendChild(script);
  };

  window.escapeHTML = function (str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  window.sortAlpha = function (arr, getLabel) {
    return (arr || []).slice().sort(function (a, b) {
      var la = String(typeof getLabel === 'function' ? getLabel(a) : a || '');
      var lb = String(typeof getLabel === 'function' ? getLabel(b) : b || '');
      return la.localeCompare(lb, 'es', { sensitivity: 'base' });
    });
  };

  window.loadHTMLFragment = async function (url, targetId) {
    var container = document.getElementById(targetId);
    if (!container) return false;
    var res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo cargar ' + url);
    container.innerHTML = await res.text();
    return true;
  };
})();

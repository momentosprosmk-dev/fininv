// Utilidades globales (estilo gateway.js de MomentosPro)
(function () {
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

  window.loadHTMLFragment = async function (url, targetId) {
    var container = document.getElementById(targetId);
    if (!container) return false;
    var res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo cargar ' + url);
    container.innerHTML = await res.text();
    return true;
  };
})();

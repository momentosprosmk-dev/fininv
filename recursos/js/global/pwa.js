(function () {
  var deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIosSafari() {
    var ua = window.navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    return isIOS && isSafari;
  }

  function syncInstallButton() {
    var btn = document.getElementById('btn-install-pwa');
    if (!btn) return;

    if (isStandalone()) {
      btn.classList.add('hidden');
      return;
    }

    if (deferredPrompt || isIosSafari()) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {
        // Silencioso si el entorno no permite Service Worker (ej. file://)
      });
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    syncInstallButton();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    syncInstallButton();
  });

  function copyShareLink(url) {
    var label = document.getElementById('share-btn-label');
    function showCopied() {
      if (!label) return;
      label.textContent = '¡Enlace copiado!';
      window.setTimeout(function () {
        var current = document.getElementById('share-btn-label');
        if (current) current.textContent = 'Compartir Web';
      }, 2000);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(showCopied).catch(function () {
        fallbackCopy(url, showCopied);
      });
    } else {
      fallbackCopy(url, showCopied);
    }
  }

  function fallbackCopy(text, onDone) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (onDone) onDone();
    } catch (err) {
      // ignore
    }
    document.body.removeChild(ta);
  }

  function shareWeb() {
    var shareUrl = 'https://www.fininv.momentospro.com/';
    var shareData = {
      title: 'FinInv — Control Financiero e Inversiones',
      text: 'Organiza tus cuentas, gastos e inversiones en múltiples divisas con FinInv.',
      url: shareUrl,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        copyShareLink(shareUrl);
      });
      return;
    }

    copyShareLink(shareUrl);
  }

  document.addEventListener('click', function (e) {
    var shareBtn = e.target && e.target.closest ? e.target.closest('#btn-share-web') : null;
    if (shareBtn) {
      shareWeb();
      return;
    }

    var btn = e.target && e.target.closest ? e.target.closest('#btn-install-pwa') : null;
    if (!btn) return;

    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        syncInstallButton();
      });
      return;
    }

    if (isIosSafari()) {
      window.alert('Para instalar en iPhone/iPad: toca el botón Compartir en Safari y selecciona "Agregar a pantalla de inicio".');
    }
  });

  // El header se carga de forma asíncrona en #header-root; sincronizamos cuando se monte
  document.addEventListener('DOMContentLoaded', function () {
    var headerRoot = document.getElementById('header-root');
    if (headerRoot && typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () {
        syncInstallButton();
      });
      observer.observe(headerRoot, { childList: true, subtree: true });
    }
    syncInstallButton();
  });

  window.AppPWA = {
    syncInstallButton: syncInstallButton,
  };
})();

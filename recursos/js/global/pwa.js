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

  document.addEventListener('click', function (e) {
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

(function () {
  var cachedScriptCode = null;

  async function loadAppsScriptCode() {
    if (cachedScriptCode) return cachedScriptCode;
    var paths = ['google-apps-script/Code.gs', '../google-apps-script/Code.gs'];
    for (var i = 0; i < paths.length; i++) {
      try {
        var res = await fetch(paths[i]);
        if (res.ok) {
          cachedScriptCode = await res.text();
          return cachedScriptCode;
        }
      } catch (e) { /* try next */ }
    }
    cachedScriptCode = '// Copia el archivo google-apps-script/Code.gs de tu proyecto en Extensiones > Apps Script';
    return cachedScriptCode;
  }

  function openGoogleModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var state = {
      methodTab: 'script',
      sheetMode: null,
      draftScriptUrl: opts.scriptUrl || '',
      draftClientId: opts.clientId || '',
      copied: false,
      codeText: cachedScriptCode || 'Cargando Code.gs...',
    };

    if (!cachedScriptCode) {
      loadAppsScriptCode().then(function (txt) {
        state.codeText = txt;
        var pre = document.getElementById('gm-code-preview');
        if (pre) pre.textContent = txt;
      });
    }

    function render() {
      var esc = window.escapeHTML;
      var isConnected = opts.connectionMode !== 'none';
      var bodyHtml = '';

      if (isConnected) {
        bodyHtml =
          '<div class="alert-banner alert-emerald" style="display:flex;align-items:center;gap:0.6rem">' +
            '<i class="fa-regular fa-circle-check" style="font-size:1.1rem"></i>' +
            '<span>Conectado vía <strong>' + (opts.connectionMode === 'script' ? 'Google Apps Script (sin Google Cloud)' : 'Google OAuth API') + '</strong>.</span>' +
          '</div>' +
          (opts.sheetWebUrl
            ? '<a href="' + esc(opts.sheetWebUrl) + '" target="_blank" rel="noreferrer" class="config-item" style="margin-bottom:0.9rem;color:#e2e8f0;font-size:0.875rem"><span>Abrir mi Google Sheet en Drive</span><i class="fa-solid fa-arrow-up-right-from-square text-muted"></i></a>'
            : '') +
          (opts.syncError ? '<div class="alert-banner alert-rose">' + esc(opts.syncError) + '</div>' : '') +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.5rem;padding-top:0.5rem">' +
            '<button type="button" id="gm-disconnect" class="btn btn-secondary">Desconectar</button>' +
            '<div style="display:flex;gap:0.5rem">' +
              (opts.connectionMode === 'script'
                ? '<button type="button" id="gm-pull" class="btn btn-secondary" ' + (opts.isSyncing ? 'disabled' : '') + '><i class="fa-solid fa-rotate"></i> Traer del Sheet</button>'
                : '') +
              '<button type="button" id="gm-push" class="btn btn-emerald" ' + (opts.isSyncing ? 'disabled' : '') + '><i class="fa-solid fa-rotate"></i> ' + (opts.isSyncing ? 'Sincronizando...' : 'Guardar en Sheet') + '</button>' +
            '</div>' +
          '</div>';
      } else {
        var step1Html =
          '<div class="config-box">' +
            '<p class="field-label" style="color:#fff;margin-bottom:0.5rem">Paso 1: ¿Qué quieres hacer con tu Google Sheet?</p>' +
            '<div class="form-grid-2">' +
              '<button type="button" class="btn ' + (state.sheetMode === 'existing' ? 'btn-emerald-outline' : 'btn-secondary') + '" data-sheet-mode="existing" style="flex-direction:column;align-items:flex-start;padding:0.7rem">' +
                '<strong>Archivo existente</strong>' +
                '<span style="font-size:0.7rem;font-weight:400;opacity:0.8">Leer mis datos actuales del Sheet</span>' +
              '</button>' +
              '<button type="button" class="btn ' + (state.sheetMode === 'new' ? 'btn-emerald-outline' : 'btn-secondary') + '" data-sheet-mode="new" style="flex-direction:column;align-items:flex-start;padding:0.7rem">' +
                '<strong>Archivo nuevo</strong>' +
                '<span style="font-size:0.7rem;font-weight:400;opacity:0.8">Crear hojas limpias desde cero</span>' +
              '</button>' +
            '</div>' +
          '</div>';

        var step2Html = '';
        if (state.sheetMode) {
          var methodContent = state.methodTab === 'script'
            ? '<div class="field-group">' +
                '<div class="field-label-row">' +
                  '<span class="field-label" style="margin:0">Código para Extensiones &gt; Apps Script</span>' +
                  '<button type="button" id="gm-copy-code" class="link-btn"><i class="fa-regular fa-copy"></i> ' + (state.copied ? '¡Copiado!' : 'Copiar Code.gs') + '</button>' +
                '</div>' +
                '<pre id="gm-code-preview" class="code-preview">' + esc(state.codeText) + '</pre>' +
              '</div>' +
              '<div class="field-group">' +
                '<label class="field-label">URL de implementación (/exec)</label>' +
                '<input type="url" id="gm-script-url" class="input" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(state.draftScriptUrl) + '" />' +
              '</div>' +
              (opts.syncError ? '<div class="alert-banner alert-rose">' + esc(opts.syncError) + '</div>' : '') +
              '<div class="modal-footer">' +
                '<button type="button" id="gm-connect-script" class="btn btn-emerald" ' + (!state.draftScriptUrl.trim() || opts.isSyncing ? 'disabled' : '') + '>' + (opts.isSyncing ? 'Conectando...' : 'Conectar con Google Sheet') + '</button>' +
              '</div>'
            : '<div class="field-group">' +
                '<label class="field-label">Google OAuth Client ID</label>' +
                '<input type="text" id="gm-client-id" class="input" placeholder="123456-abc.apps.googleusercontent.com" value="' + esc(state.draftClientId) + '" />' +
              '</div>' +
              (opts.syncError ? '<div class="alert-banner alert-rose">' + esc(opts.syncError) + '</div>' : '') +
              '<div class="modal-footer">' +
                '<button type="button" id="gm-connect-oauth" class="btn btn-primary" ' + (!state.draftClientId.trim() || opts.isSyncing ? 'disabled' : '') + '>Autorizar con Google</button>' +
              '</div>';

          step2Html =
            '<div class="segmented-tabs cols-2">' +
              '<button type="button" class="seg-btn ' + (state.methodTab === 'script' ? 'active-emerald' : '') + '" data-gm-method="script">Apps Script (Recomendado)</button>' +
              '<button type="button" class="seg-btn ' + (state.methodTab === 'oauth' ? 'active-indigo' : '') + '" data-gm-method="oauth">Google Cloud OAuth</button>' +
            '</div>' +
            methodContent;
        }

        bodyHtml = step1Html + step2Html;
      }

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box">' +
            '<div class="modal-header">' +
              '<div style="display:flex;align-items:center;gap:0.65rem">' +
                '<div class="brand-icon" style="background:rgba(16,185,129,0.15);color:#34d399"><i class="fa-solid fa-table"></i></div>' +
                '<div><h2 class="modal-title">Conectar con Google Sheets</h2><p class="modal-subtitle">Sincroniza tus finanzas directo con tu hoja de cálculo en Gmail</p></div>' +
              '</div>' +
              '<button type="button" class="modal-close" id="gm-close"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            bodyHtml +
          '</div>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('gm-close').addEventListener('click', closeFn);

      if (isConnected) {
        document.getElementById('gm-disconnect').addEventListener('click', function () {
          opts.onDisconnect();
          closeFn();
        });
        var pullBtn = document.getElementById('gm-pull');
        if (pullBtn) pullBtn.addEventListener('click', function () { opts.onPullFromSheet(); });
        document.getElementById('gm-push').addEventListener('click', function () { opts.onForceSync(); });
      } else {
        root.querySelectorAll('[data-sheet-mode]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.sheetMode = btn.getAttribute('data-sheet-mode');
            render();
          });
        });

        root.querySelectorAll('[data-gm-method]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.methodTab = btn.getAttribute('data-gm-method');
            render();
          });
        });

        var copyBtn = document.getElementById('gm-copy-code');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(state.codeText).then(function () {
                state.copied = true;
                render();
              });
            }
          });
        }

        var urlInp = document.getElementById('gm-script-url');
        if (urlInp) {
          urlInp.addEventListener('input', function (e) {
            state.draftScriptUrl = e.target.value;
            var btn = document.getElementById('gm-connect-script');
            if (btn) btn.disabled = !state.draftScriptUrl.trim() || opts.isSyncing;
          });
        }

        var connectScriptBtn = document.getElementById('gm-connect-script');
        if (connectScriptBtn) {
          connectScriptBtn.addEventListener('click', function () {
            opts.onConnectScript(state.draftScriptUrl.trim(), state.sheetMode);
          });
        }

        var clientInp = document.getElementById('gm-client-id');
        if (clientInp) {
          clientInp.addEventListener('input', function (e) {
            state.draftClientId = e.target.value;
            var btn = document.getElementById('gm-connect-oauth');
            if (btn) btn.disabled = !state.draftClientId.trim() || opts.isSyncing;
          });
        }

        var connectOAuthBtn = document.getElementById('gm-connect-oauth');
        if (connectOAuthBtn) {
          connectOAuthBtn.addEventListener('click', function () {
            opts.onSaveClientId(state.draftClientId.trim());
            opts.onConnectOAuth(state.sheetMode);
          });
        }
      }
    }

    render();
  }

  window.openGoogleModal = openGoogleModal;
})();

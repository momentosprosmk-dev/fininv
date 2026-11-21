(function () {
  var cachedScriptCode = null;

  async function loadAppsScriptCode() {
    if (cachedScriptCode) return cachedScriptCode;
    var paths = ['/google-apps-script/Code.gs', 'google-apps-script/Code.gs'];
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
      authMode: opts.authMode || 'email', // 'email' | 'credentials'
      sheetMode: null, // 'existing' | 'new'
      wizardStep: 1, // 1 | 2 | 3 | 'connecting'
      prevStepBeforeConnect: 2,
      linkConfirmed: false,
      baseCurrency: opts.baseCurrency || window.AppFormat.getBaseCurrency(),
      draftScriptUrl: opts.scriptUrl || '',
      draftEmail: opts.authEmail || '',
      draftUser: opts.authUser || '',
      draftPassword: '',
      showSetCredentials: false,
      newCredUser: '',
      newCredPassword: '',
      isBusy: false,
      localError: opts.syncError || '',
      copied: false,
      showCode: false,
      codeText: cachedScriptCode || 'Cargando Code.gs...',
    };

    if (!cachedScriptCode) {
      loadAppsScriptCode().then(function (txt) {
        state.codeText = txt;
        var pre = document.getElementById('gm-code-preview');
        if (pre) pre.textContent = txt;
      });
    }

    function renderPwdInput(id, placeholder, val, disabled) {
      var esc = window.escapeHTML;
      return (
        '<div class="pwd-input-wrap">' +
          '<input type="password" id="' + id + '" class="input" placeholder="' + esc(placeholder) + '" value="' + esc(val) + '" ' + (disabled ? 'disabled' : '') + ' />' +
          '<div class="pwd-actions">' +
            '<button type="button" class="pwd-action-btn" data-pwd-clear="' + id + '" title="Borrar contraseña" tabindex="-1"><i class="fa-solid fa-xmark"></i></button>' +
            '<button type="button" class="pwd-action-btn" data-pwd-toggle="' + id + '" title="Mostrar u ocultar contraseña" tabindex="-1"><i class="fa-regular fa-eye"></i></button>' +
          '</div>' +
        '</div>'
      );
    }

    function bindPwdControls(container) {
      container.querySelectorAll('[data-pwd-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var targetId = btn.getAttribute('data-pwd-toggle');
          var inp = document.getElementById(targetId);
          if (!inp) return;
          var isPwd = inp.type === 'password';
          inp.type = isPwd ? 'text' : 'password';
          var icon = btn.querySelector('i');
          if (icon) icon.className = isPwd ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
          inp.focus();
        });
      });
      container.querySelectorAll('[data-pwd-clear]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var targetId = btn.getAttribute('data-pwd-clear');
          var inp = document.getElementById(targetId);
          if (!inp || inp.disabled) return;
          inp.value = '';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.focus();
        });
      });
    }

    function render() {
      var esc = window.escapeHTML;
      var isConnected = opts.connectionMode !== 'none';
      var currencyOptionsHtml = window.AppFormat.getSupportedCurrencies().map(function (c) {
        return '<option value="' + esc(c.code) + '" ' + (state.baseCurrency === c.code ? 'selected' : '') + '>' + esc(c.label) + '</option>';
      }).join('');
      var currencyBoxHtml =
        '<div class="field-group" style="margin-bottom:0.9rem">' +
          '<label class="field-label" for="gm-base-currency">Moneda principal del Sheet y la App</label>' +
          '<select id="gm-base-currency" class="select">' + currencyOptionsHtml + '</select>' +
        '</div>';
      var bodyHtml = '';
      var topTabsHtml = '';
      var bottomFooterHtml = '';

      function maskIdentity(val) {
        var s = String(val || '').trim();
        if (!s) return '';
        var atIdx = s.indexOf('@');
        if (atIdx !== -1) {
          var local = s.slice(0, atIdx);
          var domain = s.slice(atIdx);
          var prefix = local.slice(0, Math.min(3, local.length));
          return prefix + '•••••' + domain;
        }
        if (s.length <= 4) return s.charAt(0) + '••••';
        return s.slice(0, 3) + '••••' + s.slice(-2);
      }

      if (isConnected) {
        var identityText = opts.authMode === 'credentials'
          ? 'Usuario autenticado: <strong>' + esc(maskIdentity(opts.authUser || '')) + '</strong> (acceso protegido con contraseña)'
          : 'Correo vinculado: <strong>' + esc(opts.authEmail ? maskIdentity(opts.authEmail) : 'Apps Script directo') + '</strong>';

        var protectedLinkHtml =
          (opts.sheetWebUrl
            ? '<a href="' + esc(opts.sheetWebUrl) + '" target="_blank" rel="noreferrer" class="config-item" style="margin-bottom:0.6rem;color:var(--text-main)"><span>Abrir mi Google Sheet en Drive</span><i class="fa-solid fa-arrow-up-right-from-square text-muted"></i></a>'
            : '') +
          '<div class="config-item" style="margin-bottom:0.6rem;word-break:break-all;font-size:0.82rem;color:var(--text-muted)">' +
            '<span><strong>URL Apps Script:</strong> ' + esc(opts.scriptUrl) + '</span>' +
          '</div>';

        bodyHtml =
          '<div class="alert-banner alert-emerald" style="display:flex;flex-direction:column;gap:0.25rem">' +
            '<div style="display:flex;align-items:center;gap:0.55rem"><i class="fa-regular fa-circle-check" style="font-size:1.1rem"></i><span>Conectado vía <strong>Google Apps Script</strong>.</span></div>' +
            '<span style="font-size:0.84rem;opacity:0.92">' + identityText + '</span>' +
          '</div>' +
          currencyBoxHtml +
          (state.isBusy
            ? '<div class="alert-banner alert-indigo" style="display:flex;align-items:center;gap:0.6rem"><i class="fa-solid fa-spinner fa-spin"></i><span>Sincronizando con Google Sheets, por favor espera...</span></div>'
            : '') +
          (state.localError ? '<div class="alert-banner alert-rose"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(state.localError) + '</div>' : '');

        bottomFooterHtml =
          '<div class="modal-bottom-fixed" style="justify-content:space-between;flex-wrap:wrap">' +
            '<button type="button" id="gm-disconnect" class="btn btn-secondary" ' + (state.isBusy ? 'disabled' : '') + '>Cerrar sesión / Desconectar</button>' +
            '<div style="display:flex;gap:0.5rem">' +
              '<button type="button" id="gm-pull" class="btn btn-secondary" ' + (state.isBusy ? 'disabled' : '') + '><i class="fa-solid fa-rotate ' + (state.isBusy ? 'fa-spin' : '') + '"></i> Traer del Sheet</button>' +
              '<button type="button" id="gm-push" class="btn btn-emerald" ' + (state.isBusy ? 'disabled' : '') + '><i class="fa-solid fa-rotate ' + (state.isBusy ? 'fa-spin' : '') + '"></i> ' + (state.isBusy ? 'Sincronizando...' : 'Guardar en Sheet') + '</button>' +
            '</div>' +
          '</div>';
      } else {
        var isNew = state.sheetMode === 'new';
        var effectiveAuthMode = isNew ? 'credentials' : state.authMode;

        if (state.wizardStep === 1 || !state.sheetMode) {
          var step1Html =
            '<div class="config-box" style="margin-bottom:0">' +
              '<p class="field-label" style="color:var(--text-strong);margin-bottom:0.5rem">¿Qué tipo de proyecto vas a conectar?</p>' +
              '<div class="form-grid-2">' +
                '<button type="button" class="btn ' + (state.sheetMode === 'existing' ? 'btn-emerald-outline' : 'btn-secondary') + '" data-sheet-mode="existing" style="flex-direction:column;align-items:flex-start;padding:0.7rem">' +
                  '<strong>Proyecto existente</strong>' +
                  '<span style="font-size:0.78rem;font-weight:400;opacity:0.85">Validar y cargar datos de mi Sheet</span>' +
                '</button>' +
                '<button type="button" class="btn ' + (state.sheetMode === 'new' ? 'btn-emerald-outline' : 'btn-secondary') + '" data-sheet-mode="new" style="flex-direction:column;align-items:flex-start;padding:0.7rem">' +
                  '<strong>Proyecto nuevo</strong>' +
                  '<span style="font-size:0.78rem;font-weight:400;opacity:0.85">Inicializar hojas limpias desde cero</span>' +
                '</button>' +
              '</div>' +
            '</div>';

          bodyHtml = currencyBoxHtml + step1Html;
          bottomFooterHtml =
            '<div class="modal-bottom-fixed">' +
              '<button type="button" class="btn btn-secondary" id="gm-cancel-btn">Cancelar</button>' +
              '<button type="button" id="gm-next-step" class="btn btn-primary" ' + (!state.sheetMode ? 'disabled' : '') + '>Siguiente &rarr;</button>' +
            '</div>';
        } else if (state.wizardStep === 'connecting') {
          bodyHtml = state.isBusy
            ? '<div class="alert-banner alert-indigo" style="margin-bottom:0;padding:1.25rem;display:flex;align-items:center;justify-content:center;gap:0.75rem;font-size:0.92rem">' +
                '<i class="fa-solid fa-spinner fa-spin" style="font-size:1.15rem"></i>' +
                '<span>Validando credenciales y conectando con tu Google Sheet...</span>' +
              '</div>'
            : '<div class="alert-banner alert-rose" style="margin-bottom:0">' +
                '<i class="fa-solid fa-triangle-exclamation"></i> ' + esc(state.localError || 'No se pudo conectar con el Google Sheet.') +
              '</div>';

          bottomFooterHtml = state.isBusy
            ? '<div class="modal-bottom-fixed"><button type="button" class="btn btn-secondary" disabled>Conectando...</button></div>'
            : '<div class="modal-bottom-fixed">' +
                '<button type="button" class="btn btn-secondary" id="gm-back-from-connect">&larr; Atrás</button>' +
                '<button type="button" class="btn btn-emerald" id="gm-retry-connect"><i class="fa-solid fa-rotate"></i> Reintentar</button>' +
              '</div>';
        } else {
          topTabsHtml = !isNew
            ? '<div class="segmented-tabs cols-2">' +
                '<button type="button" class="seg-btn ' + (state.authMode === 'email' ? 'active-emerald' : '') + '" data-gm-auth="email"><i class="fa-regular fa-envelope"></i> Con Correo</button>' +
                '<button type="button" class="seg-btn ' + (state.authMode === 'credentials' ? 'active-indigo' : '') + '" data-gm-auth="credentials"><i class="fa-solid fa-lock"></i> Link con Contraseña</button>' +
              '</div>'
            : '';

          var codeBlockHtml =
            '<div class="field-group" style="margin-bottom:0">' +
              '<div class="field-label-row">' +
                '<span class="field-label" style="margin:0">Código para Extensiones &gt; Apps Script</span>' +
                '<div style="display:flex;align-items:center;gap:0.75rem">' +
                  '<button type="button" id="gm-toggle-code" class="link-btn" title="' + (state.showCode ? 'Ocultar código' : 'Ver código') + '">' +
                    '<i class="fa-regular ' + (state.showCode ? 'fa-eye-slash' : 'fa-eye') + '"></i> ' + (state.showCode ? 'Ocultar' : 'Ver') +
                  '</button>' +
                  '<button type="button" id="gm-copy-code" class="link-btn"><i class="fa-regular fa-copy"></i> ' + (state.copied ? '¡Copiado!' : 'Copiar Code.gs') + '</button>' +
                '</div>' +
              '</div>' +
              (state.showCode ? '<pre id="gm-code-preview" class="code-preview">' + esc(state.codeText) + '</pre>' : '') +
            '</div>';

          if (isNew || (!isNew && effectiveAuthMode === 'credentials')) {
            if (state.wizardStep === 2) {
              bodyHtml =
                '<div class="field-group">' +
                  '<label class="field-label">URL de implementación (/exec)</label>' +
                  '<input type="url" id="gm-script-url" class="input" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(state.draftScriptUrl) + '" />' +
                '</div>' +
                codeBlockHtml;

              bottomFooterHtml =
                '<div class="modal-bottom-fixed">' +
                  '<button type="button" class="btn btn-secondary" id="gm-back-step">&larr; Atrás</button>' +
                  '<button type="button" id="gm-next-cred" class="btn btn-primary" ' + (!state.draftScriptUrl.trim() ? 'disabled' : '') + '>Siguiente &rarr;</button>' +
                '</div>';
            } else {
              var canLoginCred = Boolean(state.draftScriptUrl.trim()) && Boolean(state.draftUser.trim()) && Boolean(state.draftPassword);
              bodyHtml = isNew
                ? '<div class="config-box" style="margin-bottom:0">' +
                    '<p class="field-label" style="margin:0 0 0.5rem;color:var(--text-strong)"><i class="fa-solid fa-user-plus text-emerald"></i> Crear usuario y contraseña de acceso</p>' +
                    '<div class="form-grid-2" style="margin-bottom:0.5rem">' +
                      '<div><label class="field-label">Usuario</label><input type="text" id="gm-user" class="input" placeholder="Ej. esandoval" value="' + esc(state.draftUser) + '" /></div>' +
                      '<div><label class="field-label">Contraseña</label>' + renderPwdInput('gm-password', '••••••••', state.draftPassword, false) + '</div>' +
                    '</div>' +
                    '<div><label class="field-label">Correo electrónico (opcional)</label><input type="email" id="gm-email" class="input" placeholder="tucorreo@gmail.com" value="' + esc(state.draftEmail) + '" /></div>' +
                  '</div>'
                : '<div class="config-box" style="margin-bottom:0">' +
                    '<p class="field-label" style="margin:0 0 0.5rem;color:var(--text-strong)"><i class="fa-solid fa-user-shield text-indigo"></i> Ingresa tu Usuario y Contraseña</p>' +
                    '<div class="form-grid-2">' +
                      '<div><label class="field-label">Usuario</label><input type="text" id="gm-user" class="input" placeholder="Tu usuario" value="' + esc(state.draftUser) + '" /></div>' +
                      '<div><label class="field-label">Contraseña</label>' + renderPwdInput('gm-password', '••••••••', state.draftPassword, false) + '</div>' +
                    '</div>' +
                  '</div>';

              bottomFooterHtml =
                '<div class="modal-bottom-fixed">' +
                  '<button type="button" class="btn btn-secondary" id="gm-back-cred">&larr; Atrás</button>' +
                  '<button type="button" id="gm-connect-script" class="btn btn-emerald" ' + (!canLoginCred ? 'disabled' : '') + '>' +
                    (isNew ? 'Crear usuario y conectar' : 'Iniciar sesión y conectar') +
                  '</button>' +
                '</div>';
            }
          } else {
            var authFieldsHtml = effectiveAuthMode === 'email'
              ? '<div class="field-group">' +
                  '<label class="field-label">Correo electrónico (Gmail)</label>' +
                  '<input type="email" id="gm-email" class="input" placeholder="tucorreo@gmail.com" value="' + esc(state.draftEmail) + '" />' +
                '</div>'
              : '<div class="config-box" style="margin-bottom:0.75rem">' +
                  '<p class="field-label" style="margin:0 0 0.5rem;color:var(--text-strong)"><i class="fa-solid fa-user-plus text-emerald"></i> Crear usuario y contraseña de acceso</p>' +
                  '<div class="form-grid-2" style="margin-bottom:0.5rem">' +
                    '<div><label class="field-label">Usuario</label><input type="text" id="gm-user" class="input" placeholder="Ej. esandoval" value="' + esc(state.draftUser) + '" /></div>' +
                    '<div><label class="field-label">Contraseña</label>' + renderPwdInput('gm-password', '••••••••', state.draftPassword, false) + '</div>' +
                  '</div>' +
                  '<div><label class="field-label">Correo electrónico</label><input type="email" id="gm-email" class="input" placeholder="tucorreo@gmail.com" value="' + esc(state.draftEmail) + '" /></div>' +
                '</div>';

            var canSubmit = Boolean(state.draftScriptUrl.trim()) && (
              effectiveAuthMode === 'email'
                ? Boolean(state.draftEmail.trim())
                : (Boolean(state.draftUser.trim()) && Boolean(state.draftPassword))
            );

            bodyHtml =
              authFieldsHtml +
              '<div class="field-group">' +
                '<label class="field-label">URL de implementación (/exec)</label>' +
                '<input type="url" id="gm-script-url" class="input" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(state.draftScriptUrl) + '" />' +
              '</div>' +
              codeBlockHtml;

            bottomFooterHtml =
              '<div class="modal-bottom-fixed">' +
                '<button type="button" class="btn btn-secondary" id="gm-back-step">&larr; Atrás</button>' +
                '<button type="button" id="gm-connect-script" class="btn btn-emerald" ' + (!canSubmit ? 'disabled' : '') + '>' +
                  (isNew ? 'Crear usuario y conectar' : 'Iniciar sesión y conectar') +
                '</button>' +
              '</div>';
          }
        }
      }

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box modal-flex">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header" style="' + (topTabsHtml ? '' : 'margin-bottom:0;') + '">' +
                '<div style="display:flex;align-items:center;gap:0.65rem">' +
                  '<div class="brand-icon" style="background:rgba(16,185,129,0.15);color:#34d399"><i class="fa-solid fa-table"></i></div>' +
                  '<div><h2 class="modal-title">Acceso y Google Sheets</h2><p class="modal-subtitle">Conecta tu hoja con correo o mediante link protegido con contraseña</p></div>' +
                '</div>' +
                '<button type="button" class="modal-close" id="gm-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
              topTabsHtml +
            '</div>' +
            '<div class="modal-body-scroll">' +
              bodyHtml +
            '</div>' +
            bottomFooterHtml +
          '</div>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('gm-close').addEventListener('click', closeFn);
      var cancelBtn = document.getElementById('gm-cancel-btn');
      if (cancelBtn) cancelBtn.addEventListener('click', closeFn);
      bindPwdControls(root);

      var currencySel = document.getElementById('gm-base-currency');
      if (currencySel) {
        currencySel.addEventListener('change', function (e) {
          state.baseCurrency = e.target.value;
          if (typeof opts.onChangeCurrency === 'function') {
            opts.onChangeCurrency(state.baseCurrency);
          }
        });
      }

      if (isConnected) {
        document.getElementById('gm-disconnect').addEventListener('click', function () {
          opts.onDisconnect();
          closeFn();
        });
        var pullBtn = document.getElementById('gm-pull');
        if (pullBtn) {
          pullBtn.addEventListener('click', async function () {
            state.isBusy = true;
            state.localError = '';
            render();
            var res = await opts.onPullFromSheet();
            state.isBusy = false;
            if (res && !res.ok) state.localError = res.error || 'Error al traer datos del Sheet.';
            render();
          });
        }
        var pushBtn = document.getElementById('gm-push');
        if (pushBtn) {
          pushBtn.addEventListener('click', async function () {
            state.isBusy = true;
            state.localError = '';
            render();
            var res = await opts.onForceSync();
            state.isBusy = false;
            if (res && !res.ok) state.localError = res.error || 'Error al guardar en el Sheet.';
            render();
          });
        }

        var unlockInp = document.getElementById('gm-unlock-pwd');
        if (unlockInp) {
          unlockInp.addEventListener('input', function (e) {
            state.unlockPassword = e.target.value;
          });
        }
        var unlockBtn = document.getElementById('gm-btn-unlock');
        if (unlockBtn) {
          unlockBtn.addEventListener('click', function () {
            var enteredHash = window.GoogleSheetsService.hashPassword(state.unlockPassword);
            if (enteredHash && opts.authPassHash && enteredHash === opts.authPassHash) {
              state.linkUnlocked = true;
              state.unlockError = '';
            } else {
              state.unlockError = 'Contraseña incorrecta.';
            }
            render();
          });
        }
      } else {
        root.querySelectorAll('[data-sheet-mode]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.sheetMode = btn.getAttribute('data-sheet-mode');
            state.linkConfirmed = false;
            state.localError = '';
            render();
          });
        });

        root.querySelectorAll('[data-gm-auth]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.authMode = btn.getAttribute('data-gm-auth');
            state.wizardStep = 2;
            state.localError = '';
            render();
          });
        });

        var nextCredBtn = document.getElementById('gm-next-cred');
        if (nextCredBtn) {
          nextCredBtn.addEventListener('click', function () {
            if (!state.draftScriptUrl.trim()) return;
            state.wizardStep = 3;
            state.localError = '';
            render();
          });
        }

        var backCredBtn = document.getElementById('gm-back-cred');
        if (backCredBtn) {
          backCredBtn.addEventListener('click', function () {
            state.wizardStep = 2;
            state.localError = '';
            render();
          });
        }

        var backFromConnectBtn = document.getElementById('gm-back-from-connect');
        if (backFromConnectBtn) {
          backFromConnectBtn.addEventListener('click', function () {
            state.wizardStep = state.prevStepBeforeConnect || 2;
            state.localError = '';
            render();
          });
        }

        var nextStepBtn = document.getElementById('gm-next-step');
        if (nextStepBtn) {
          nextStepBtn.addEventListener('click', function () {
            if (!state.sheetMode) return;
            state.wizardStep = 2;
            state.localError = '';
            render();
          });
        }

        var backStepBtn = document.getElementById('gm-back-step');
        if (backStepBtn) {
          backStepBtn.addEventListener('click', function () {
            state.wizardStep = 1;
            state.linkConfirmed = false;
            state.localError = '';
            render();
          });
        }

        var backLinkBtn = document.getElementById('gm-back-link');
        if (backLinkBtn) {
          backLinkBtn.addEventListener('click', function () {
            state.linkConfirmed = false;
            state.localError = '';
            render();
          });
        }

        var confirmLinkBtn = document.getElementById('gm-confirm-link');
        if (confirmLinkBtn) {
          confirmLinkBtn.addEventListener('click', function () {
            if (!state.draftScriptUrl.trim()) return;
            state.linkConfirmed = true;
            state.localError = '';
            render();
          });
        }

        var changeLinkBtn = document.getElementById('gm-change-link');
        if (changeLinkBtn) {
          changeLinkBtn.addEventListener('click', function () {
            state.linkConfirmed = false;
            state.localError = '';
            render();
          });
        }

        var toggleCodeBtn = document.getElementById('gm-toggle-code');
        if (toggleCodeBtn) {
          toggleCodeBtn.addEventListener('click', function () {
            state.showCode = !state.showCode;
            render();
          });
        }

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

        function syncSubmitDisabled() {
          var btn = document.getElementById('gm-connect-script');
          if (!btn) return;
          var effMode = state.sheetMode === 'new' ? 'credentials' : state.authMode;
          var ok = Boolean(state.draftScriptUrl.trim()) && !opts.isSyncing && (
            effMode === 'email'
              ? Boolean(state.draftEmail.trim())
              : (Boolean(state.draftUser.trim()) && Boolean(state.draftPassword))
          );
          btn.disabled = !ok;
        }

        var emailInp = document.getElementById('gm-email');
        if (emailInp) {
          emailInp.addEventListener('input', function (e) {
            state.draftEmail = e.target.value;
            syncSubmitDisabled();
          });
        }

        var userInp = document.getElementById('gm-user');
        if (userInp) {
          userInp.addEventListener('input', function (e) {
            state.draftUser = e.target.value;
            syncSubmitDisabled();
          });
        }

        var pwdInp = document.getElementById('gm-password');
        if (pwdInp) {
          pwdInp.addEventListener('input', function (e) {
            state.draftPassword = e.target.value;
            syncSubmitDisabled();
          });
        }

        var urlInp = document.getElementById('gm-script-url');
        if (urlInp) {
          urlInp.addEventListener('input', function (e) {
            state.draftScriptUrl = e.target.value;
            syncSubmitDisabled();
            var cBtn = document.getElementById('gm-next-cred');
            if (cBtn) cBtn.disabled = !state.draftScriptUrl.trim();
          });
        }

        async function startConnectAttempt() {
          if (state.wizardStep !== 'connecting') {
            state.prevStepBeforeConnect = state.wizardStep;
          }
          state.wizardStep = 'connecting';
          state.isBusy = true;
          state.localError = '';
          render();
          var res = await opts.onConnectScript({
            url: state.draftScriptUrl.trim(),
            sheetMode: state.sheetMode,
            authMode: state.sheetMode === 'new' ? 'credentials' : state.authMode,
            email: state.draftEmail.trim(),
            username: state.draftUser.trim(),
            password: state.draftPassword,
          });
          if (!res || !res.ok) {
            state.isBusy = false;
            state.localError = (res && res.error) || 'No se pudo conectar con el Google Sheet. Verifica la URL /exec y tus datos.';
            render();
          }
        }

        var connectScriptBtn = document.getElementById('gm-connect-script');
        if (connectScriptBtn) {
          connectScriptBtn.addEventListener('click', startConnectAttempt);
        }
        var retryConnectBtn = document.getElementById('gm-retry-connect');
        if (retryConnectBtn) {
          retryConnectBtn.addEventListener('click', startConnectAttempt);
        }
      }
    }

    render();
  }

  window.openGoogleModal = openGoogleModal;
})();

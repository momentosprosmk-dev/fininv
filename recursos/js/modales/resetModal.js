(function () {
  var RESET_OPTIONS = [
    { key: 'cuentas', label: 'Restablecer Cuentas', desc: 'Restaura las cuentas financieras por defecto en $0.', icon: 'fa-solid fa-wallet text-sky' },
    { key: 'conceptos', label: 'Restablecer Conceptos', desc: 'Restaura el catálogo original de conceptos (egresos, ingresos y traspasos).', icon: 'fa-solid fa-tags text-indigo' },
    { key: 'egresos', label: 'Restablecer Egresos', desc: 'Elimina todos los movimientos registrados de tipo Egreso.', icon: 'fa-solid fa-arrow-trend-down text-rose' },
    { key: 'ingresos', label: 'Restablecer Ingresos', desc: 'Elimina todos los movimientos registrados de tipo Ingreso.', icon: 'fa-solid fa-arrow-trend-up text-emerald' },
    { key: 'traspasos', label: 'Restablecer Traspasos', desc: 'Elimina todos los movimientos registrados de tipo Traspaso.', icon: 'fa-solid fa-right-left text-sky' },
    { key: 'cuentas_inversion', label: 'Restablecer Cuentas de Inversión', desc: 'Elimina los fondos y sub-inversiones creados.', icon: 'fa-solid fa-folder-minus text-violet' },
    { key: 'movimientos_inversion', label: 'Restablecer Movimientos de Inversión', desc: 'Elimina el historial de operaciones del módulo de Inversiones.', icon: 'fa-solid fa-chart-line text-amber' },
    { key: 'prestamos', label: 'Restablecer Préstamos', desc: 'Elimina los préstamos otorgados y sus cobros registrados.', icon: 'fa-solid fa-hand-holding-dollar text-emerald' },
  ];

  function bytesToBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }

  async function deriveAesKey(password, saltBytes) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Tu navegador no soporta cifrado Web Crypto (usa HTTPS).');
    }
    var enc = new TextEncoder();
    var keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptBackup(payloadObj, password) {
    var salt = window.crypto.getRandomValues(new Uint8Array(16));
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveAesKey(password, salt);
    var encoded = new TextEncoder().encode(JSON.stringify(payloadObj));
    var cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoded);
    return {
      app: 'FinInv',
      version: 1,
      encrypted: true,
      exportedAt: new Date().toISOString(),
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(cipherBuf)),
    };
  }

  async function decryptBackup(envelope, password) {
    if (!envelope || envelope.app !== 'FinInv' || !envelope.encrypted || !envelope.salt || !envelope.iv || !envelope.data) {
      throw new Error('El archivo no es una copia de seguridad cifrada válida de FinInv.');
    }
    var salt = base64ToBytes(envelope.salt);
    var iv = base64ToBytes(envelope.iv);
    var cipherBytes = base64ToBytes(envelope.data);
    var key = await deriveAesKey(password, salt);
    var plainBuf;
    try {
      plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipherBytes);
    } catch (e) {
      throw new Error('Contraseña incorrecta o archivo dañado.');
    }
    var parsed = JSON.parse(new TextDecoder().decode(plainBuf));
    if (!parsed || !parsed.data || !Array.isArray(parsed.data.accounts)) {
      throw new Error('La copia descifrada no contiene datos válidos de FinInv.');
    }
    return parsed;
  }

  function openResetModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var curData = opts.data || {};
    var state = {
      tab: 'backup', // 'backup' | 'reset'
      backupSubTab: 'export', // 'export' | 'restore'
      // Backup export
      exportPwd: '',
      showExportPwd: false,
      exportBusy: false,
      exportMsg: '',
      exportErr: '',
      // Backup restore
      restoreFileName: '',
      restoreEnvelope: null,
      restorePwd: '',
      showRestorePwd: false,
      restoreBusy: false,
      restoreErr: '',
      decryptedPreview: null,
      restoreDoneMsg: '',
      // Reset
      selected: {},
      confirming: false,
      doneMsg: '',
    };

    function renderPwdInput(id, placeholder, val) {
      var esc = window.escapeHTML;
      return (
        '<div class="pwd-input-wrap">' +
          '<input type="password" id="' + id + '" class="input" placeholder="' + esc(placeholder) + '" value="' + esc(val || '') + '" />' +
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
          var inp = document.getElementById(btn.getAttribute('data-pwd-toggle'));
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
          var inp = document.getElementById(btn.getAttribute('data-pwd-clear'));
          if (!inp || inp.disabled) return;
          inp.value = '';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.focus();
        });
      });
    }

    function getSelectedKeys() {
      return RESET_OPTIONS.map(function (o) { return o.key; }).filter(function (k) { return Boolean(state.selected[k]); });
    }

    function isAllSelected() {
      return getSelectedKeys().length === RESET_OPTIONS.length;
    }

    function render() {
      var prevScrollEl = root.querySelector('.modal-body-scroll');
      var prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
      var esc = window.escapeHTML;
      var selectedKeys = getSelectedKeys();
      var allChecked = isAllSelected();

      var topTabsHtml =
        '<div class="segmented-tabs cols-2">' +
          '<button type="button" class="seg-btn ' + (state.tab === 'backup' ? 'active-indigo' : '') + '" data-adm-tab="backup"><i class="fa-solid fa-shield-halved"></i> Copia de Seguridad</button>' +
          '<button type="button" class="seg-btn ' + (state.tab === 'reset' ? 'active-rose' : '') + '" data-adm-tab="reset"><i class="fa-solid fa-rotate-left"></i> Restablecer</button>' +
        '</div>';

      var bodyHtml = '';
      var bottomFooterHtml = '';

      if (state.tab === 'backup') {
        var movCount = (curData.movements || []).length;
        var invCount = (curData.investmentAccounts || []).length;
        var loanCount = (curData.loans || []).length;
        var canExport = state.exportPwd.length >= 4 && !state.exportBusy;

        var exportBoxHtml =
          '<div class="config-box" style="margin-bottom:0.85rem">' +
            '<p class="field-label" style="margin:0 0 0.25rem;color:var(--text-strong)"><i class="fa-solid fa-download text-indigo"></i> Exportar copia cifrada (.json)</p>' +
            '<p style="margin:0 0 0.65rem;font-size:0.8rem;color:var(--text-muted)">Respaldo actual: <strong>' + movCount + '</strong> mov. · <strong>' + invCount + '</strong> inversiones · <strong>' + loanCount + '</strong> préstamos. Siempre se cifra con tu contraseña.</p>' +
            '<div class="field-group" style="margin-bottom:0.65rem">' +
              renderPwdInput('bk-export-pwd', 'Contraseña (mín. 4 caracteres)', state.exportPwd) +
            '</div>' +
            '<div style="display:flex;gap:0.45rem;flex-wrap:nowrap">' +
              '<button type="button" id="bk-btn-export" class="btn btn-primary" style="flex:1 1 0;min-width:0;padding:0.48rem 0.6rem;font-size:0.82rem;white-space:nowrap" ' + (!canExport ? 'disabled' : '') + '>' +
                '<i class="fa-solid ' + (state.exportBusy ? 'fa-spinner fa-spin' : 'fa-download') + '"></i> ' + (state.exportBusy ? 'Cifrando...' : 'Descargar') +
              '</button>' +
              '<button type="button" id="bk-btn-share" class="btn btn-secondary" style="flex:1 1 0;min-width:0;padding:0.48rem 0.6rem;font-size:0.82rem;white-space:nowrap" ' + (!canExport ? 'disabled' : '') + '>' +
                '<i class="fa-solid ' + (state.exportBusy ? 'fa-spinner fa-spin' : 'fa-share-nodes') + '"></i> Compartir' +
              '</button>' +
            '</div>' +
            (state.exportErr ? '<div class="alert-banner alert-rose" style="margin-top:0.6rem;margin-bottom:0">' + esc(state.exportErr) + '</div>' : '') +
            (state.exportMsg ? '<div class="alert-banner alert-emerald" style="margin-top:0.6rem;margin-bottom:0"><i class="fa-regular fa-circle-check"></i> ' + esc(state.exportMsg) + '</div>' : '') +
          '</div>';

        var previewBlockHtml = '';
        if (state.decryptedPreview) {
          var pd = state.decryptedPreview.data;
          previewBlockHtml =
            '<div class="alert-banner alert-indigo" style="margin-top:0.65rem;margin-bottom:0">' +
              '<p style="margin:0 0 0.45rem">Archivo descifrado correctamente: <strong>' + (pd.movements || []).length + '</strong> mov. · <strong>' + (pd.investmentAccounts || []).length + '</strong> inversiones · <strong>' + (pd.loans || []).length + '</strong> préstamos.</p>' +
              '<div style="display:flex;gap:0.45rem;justify-content:flex-end">' +
                '<button type="button" id="bk-cancel-restore" class="btn btn-secondary" style="padding:0.35rem 0.7rem;font-size:0.8rem">Cancelar</button>' +
                '<button type="button" id="bk-confirm-restore" class="btn btn-emerald" style="padding:0.35rem 0.75rem;font-size:0.8rem">Sí, restaurar datos</button>' +
              '</div>' +
            '</div>';
        }

        var restoreBoxHtml =
          '<div class="config-box" style="margin-bottom:0">' +
            '<p class="field-label" style="margin:0 0 0.65rem;color:var(--text-strong)"><i class="fa-solid fa-upload text-emerald"></i> Restaurar copia de seguridad</p>' +
            '<input type="file" id="bk-file-input" accept=".json,application/json" style="display:none" />' +
            '<button type="button" id="bk-pick-file" class="btn btn-secondary" style="width:100%;margin-bottom:0.65rem">' +
              '<i class="fa-regular fa-folder-open"></i> ' + (state.restoreFileName ? esc(state.restoreFileName) : 'Seleccionar archivo (.json)') +
            '</button>' +
            (state.restoreEnvelope && !state.decryptedPreview
              ? '<div class="field-group" style="margin-bottom:0.65rem">' +
                  '<label class="field-label">Contraseña de la copia</label>' +
                  renderPwdInput('bk-restore-pwd', 'Contraseña del respaldo', state.restorePwd) +
                '</div>' +
                '<button type="button" id="bk-btn-decrypt" class="btn btn-emerald" style="width:100%" ' + (!state.restorePwd || state.restoreBusy ? 'disabled' : '') + '>' +
                  '<i class="fa-solid ' + (state.restoreBusy ? 'fa-spinner fa-spin' : 'fa-unlock-keyhole') + '"></i> ' + (state.restoreBusy ? 'Descifrando...' : 'Verificar y descifrar copia') +
                '</button>'
              : '') +
            previewBlockHtml +
            (state.restoreErr ? '<div class="alert-banner alert-rose" style="margin-top:0.6rem;margin-bottom:0">' + esc(state.restoreErr) + '</div>' : '') +
            (state.restoreDoneMsg ? '<div class="alert-banner alert-emerald" style="margin-top:0.6rem;margin-bottom:0"><i class="fa-regular fa-circle-check"></i> ' + esc(state.restoreDoneMsg) + '</div>' : '') +
          '</div>';

        var backupSubTabsHtml =
          '<div class="segmented-tabs cols-2" style="margin-bottom:0.85rem">' +
            '<button type="button" class="seg-btn ' + (state.backupSubTab === 'export' ? 'active-indigo' : '') + '" data-bk-subtab="export"><i class="fa-solid fa-file-shield"></i> Realizar copia</button>' +
            '<button type="button" class="seg-btn ' + (state.backupSubTab === 'restore' ? 'active-emerald' : '') + '" data-bk-subtab="restore"><i class="fa-solid fa-upload"></i> Restaurar copia</button>' +
          '</div>';

        bodyHtml = backupSubTabsHtml + (state.backupSubTab === 'export' ? exportBoxHtml : restoreBoxHtml);
        bottomFooterHtml =
          '<div class="modal-bottom-fixed">' +
            '<button type="button" class="btn btn-secondary" id="rst-cancel">Cerrar</button>' +
          '</div>';
      } else {
        var masterHtml =
          '<label class="config-item" style="cursor:pointer;align-items:flex-start;gap:0.75rem;border-color:var(--rose-border);background:var(--rose-bg);margin-bottom:0.35rem">' +
            '<input type="checkbox" id="rst-chk-all" ' + (allChecked ? 'checked' : '') + ' style="margin-top:0.25rem;width:1.1rem;height:1.1rem" />' +
            '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:center;gap:0.45rem;font-weight:700;color:var(--text-strong);font-size:0.96rem">' +
                '<i class="fa-solid fa-rotate-left text-rose"></i><span>Modo Default (Restablecer Todo)</span>' +
              '</div>' +
              '<p style="margin:0.15rem 0 0;font-size:0.82rem;color:var(--text-muted)">Selecciona todas las opciones para dejar la aplicación limpia en $0.</p>' +
            '</div>' +
          '</label>';

        var itemsHtml = RESET_OPTIONS.map(function (item) {
          var checked = Boolean(state.selected[item.key]);
          return (
            '<label class="config-item" style="cursor:pointer;align-items:flex-start;gap:0.75rem;margin-left:0.65rem">' +
              '<input type="checkbox" class="rst-chk" data-rst-key="' + esc(item.key) + '" ' + (checked ? 'checked' : '') + ' style="margin-top:0.25rem;width:1.05rem;height:1.05rem" />' +
              '<div style="flex:1;min-width:0">' +
                '<div style="display:flex;align-items:center;gap:0.45rem;font-weight:600;color:var(--text-strong);font-size:0.92rem">' +
                  '<i class="' + item.icon + '"></i><span>' + esc(item.label) + '</span>' +
                '</div>' +
                '<p style="margin:0.15rem 0 0;font-size:0.82rem;color:var(--text-muted)">' + esc(item.desc) + '</p>' +
              '</div>' +
            '</label>'
          );
        }).join('');

        var confirmBannerHtml = state.confirming && selectedKeys.length > 0
          ? '<div class="alert-banner alert-rose" style="margin-top:0.85rem;margin-bottom:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.5rem">' +
              '<span>¿Confirmas restablecer las <strong>' + selectedKeys.length + '</strong> opción(es) seleccionada(s)?</span>' +
              '<div style="display:flex;gap:0.4rem">' +
                '<button type="button" class="btn btn-secondary" id="rst-cancel-confirm" style="padding:0.35rem 0.7rem;font-size:0.82rem">No</button>' +
                '<button type="button" class="btn btn-primary" id="rst-do-confirm" style="background:#e11d48;padding:0.35rem 0.7rem;font-size:0.82rem">Sí, restablecer</button>' +
              '</div>' +
            '</div>'
          : '';

        var doneBannerHtml = state.doneMsg
          ? '<div class="alert-banner alert-emerald" style="margin-top:0.85rem;margin-bottom:0"><i class="fa-regular fa-circle-check"></i> ' + esc(state.doneMsg) + '</div>'
          : '';

        bodyHtml =
          '<div style="display:flex;flex-direction:column;gap:0.5rem">' + masterHtml + itemsHtml + '</div>' +
          confirmBannerHtml +
          doneBannerHtml;

        bottomFooterHtml =
          '<div class="modal-bottom-fixed">' +
            '<button type="button" class="btn btn-secondary" id="rst-cancel">Cerrar</button>' +
            '<button type="button" class="btn btn-primary" id="rst-apply" style="background:#e11d48;border-color:#f43f5e" ' + (selectedKeys.length === 0 ? 'disabled' : '') + '>Restablecer seleccionados (' + selectedKeys.length + ')</button>' +
          '</div>';
      }

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box modal-flex">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header">' +
                '<div style="display:flex;align-items:center;gap:0.65rem">' +
                  '<div class="brand-icon" style="background:rgba(99,102,241,0.16);color:#a5b4fc"><i class="fa-solid fa-database"></i></div>' +
                  '<div><h2 class="modal-title">Administrar Datos</h2><p class="modal-subtitle">Copias de seguridad cifradas y restablecimiento</p></div>' +
                '</div>' +
                '<button type="button" class="modal-close" id="rst-close"><i class="fa-solid fa-xmark"></i></button>' +
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
      document.getElementById('rst-close').addEventListener('click', closeFn);
      document.getElementById('rst-cancel').addEventListener('click', closeFn);
      bindPwdControls(root);

      root.querySelectorAll('[data-adm-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.tab = btn.getAttribute('data-adm-tab');
          render();
        });
      });

      if (state.tab === 'backup') {
        root.querySelectorAll('[data-bk-subtab]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.backupSubTab = btn.getAttribute('data-bk-subtab');
            render();
          });
        });

        var expPwdInp = document.getElementById('bk-export-pwd');
        if (expPwdInp) {
          expPwdInp.addEventListener('input', function (e) {
            state.exportPwd = e.target.value;
            state.exportErr = '';
            var bExp = document.getElementById('bk-btn-export');
            if (bExp) bExp.disabled = state.exportPwd.length < 4 || state.exportBusy;
            var bShr = document.getElementById('bk-btn-share');
            if (bShr) bShr.disabled = state.exportPwd.length < 4 || state.exportBusy;
          });
        }
        var toggleExpBtn = document.getElementById('bk-toggle-exp-pwd');
        if (toggleExpBtn) toggleExpBtn.addEventListener('click', function () { state.showExportPwd = !state.showExportPwd; render(); });

        async function runExportBackup(mode) {
          if (state.exportPwd.length < 4) return;
          state.exportBusy = true;
          state.exportErr = '';
          state.exportMsg = '';
          render();
          try {
            var payload = {
              data: curData,
              baseCurrency: window.AppFormat && window.AppFormat.getBaseCurrency ? window.AppFormat.getBaseCurrency() : 'COP',
              monthCloseDay: window.AppFormat && window.AppFormat.getMonthCloseDay ? window.AppFormat.getMonthCloseDay() : 0,
            };
            var encrypted = await encryptBackup(payload, state.exportPwd);
            var jsonStr = JSON.stringify(encrypted, null, 2);
            var today = window.AppFormat && window.AppFormat.getTodayISO ? window.AppFormat.getTodayISO() : 'backup';
            var fileName = 'fininv-respaldo-' + today + '.json';
            var blob = new Blob([jsonStr], { type: 'application/json' });

            if (mode === 'share' && typeof File === 'function' && navigator.share) {
              var fileObj = new File([blob], fileName, { type: 'application/json' });
              if (!navigator.canShare || navigator.canShare({ files: [fileObj] })) {
                await navigator.share({
                  files: [fileObj],
                  title: 'Respaldo FinInv',
                  text: 'Copia de seguridad cifrada de FinInv (' + today + ')',
                });
                state.exportPwd = '';
                state.exportMsg = 'Copia cifrada compartida correctamente.';
                return;
              }
            }

            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            state.exportPwd = '';
            state.exportMsg = mode === 'share'
              ? 'Tu navegador no permite compartir archivos directamente; se descargó la copia cifrada.'
              : 'Copia cifrada descargada correctamente.';
          } catch (err) {
            if (err && err.name === 'AbortError') {
              state.exportErr = '';
            } else {
              state.exportErr = err && err.message ? err.message : 'No se pudo generar la copia cifrada.';
            }
          } finally {
            state.exportBusy = false;
            render();
          }
        }

        var expBtn = document.getElementById('bk-btn-export');
        if (expBtn) expBtn.addEventListener('click', function () { runExportBackup('download'); });
        var shareBtn = document.getElementById('bk-btn-share');
        if (shareBtn) shareBtn.addEventListener('click', function () { runExportBackup('share'); });

        var fileInput = document.getElementById('bk-file-input');
        var pickBtn = document.getElementById('bk-pick-file');
        if (pickBtn && fileInput) {
          pickBtn.addEventListener('click', function () { fileInput.click(); });
          fileInput.addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            state.restoreFileName = file.name;
            state.restoreErr = '';
            state.restoreDoneMsg = '';
            state.decryptedPreview = null;
            state.restorePwd = '';
            var reader = new FileReader();
            reader.onload = function () {
              try {
                var parsed = JSON.parse(String(reader.result || ''));
                if (!parsed || parsed.app !== 'FinInv' || !parsed.encrypted) {
                  state.restoreEnvelope = null;
                  state.restoreErr = 'El archivo seleccionado no es una copia cifrada válida de FinInv.';
                } else {
                  state.restoreEnvelope = parsed;
                }
              } catch (err) {
                state.restoreEnvelope = null;
                state.restoreErr = 'No se pudo leer el archivo JSON.';
              }
              render();
            };
            reader.readAsText(file);
          });
        }

        var resPwdInp = document.getElementById('bk-restore-pwd');
        if (resPwdInp) {
          resPwdInp.addEventListener('input', function (e) {
            state.restorePwd = e.target.value;
            state.restoreErr = '';
            var b = document.getElementById('bk-btn-decrypt');
            if (b) b.disabled = !state.restorePwd || state.restoreBusy;
          });
        }
        var toggleResBtn = document.getElementById('bk-toggle-res-pwd');
        if (toggleResBtn) toggleResBtn.addEventListener('click', function () { state.showRestorePwd = !state.showRestorePwd; render(); });

        var decBtn = document.getElementById('bk-btn-decrypt');
        if (decBtn) {
          decBtn.addEventListener('click', async function () {
            if (!state.restoreEnvelope || !state.restorePwd) return;
            state.restoreBusy = true;
            state.restoreErr = '';
            render();
            try {
              state.decryptedPreview = await decryptBackup(state.restoreEnvelope, state.restorePwd);
            } catch (err) {
              state.restoreErr = err && err.message ? err.message : 'Contraseña incorrecta.';
            } finally {
              state.restoreBusy = false;
              render();
            }
          });
        }

        var cancelRestoreBtn = document.getElementById('bk-cancel-restore');
        if (cancelRestoreBtn) {
          cancelRestoreBtn.addEventListener('click', function () {
            state.decryptedPreview = null;
            state.restorePwd = '';
            render();
          });
        }

        var confirmRestoreBtn = document.getElementById('bk-confirm-restore');
        if (confirmRestoreBtn) {
          confirmRestoreBtn.addEventListener('click', function () {
            if (!state.decryptedPreview) return;
            if (typeof opts.onRestoreBackup === 'function') {
              opts.onRestoreBackup(state.decryptedPreview);
              curData = state.decryptedPreview.data;
            }
            state.decryptedPreview = null;
            state.restoreEnvelope = null;
            state.restoreFileName = '';
            state.restorePwd = '';
            state.restoreDoneMsg = 'Datos restaurados correctamente en tu dispositivo.';
            render();
          });
        }
      } else {
        document.getElementById('rst-chk-all').addEventListener('change', function (e) {
          var checkAll = Boolean(e.target.checked);
          RESET_OPTIONS.forEach(function (o) { state.selected[o.key] = checkAll; });
          state.confirming = false;
          state.doneMsg = '';
          render();
        });

        root.querySelectorAll('.rst-chk').forEach(function (chk) {
          chk.addEventListener('change', function (e) {
            state.selected[chk.getAttribute('data-rst-key')] = Boolean(e.target.checked);
            state.confirming = false;
            state.doneMsg = '';
            render();
          });
        });

        var applyBtn = document.getElementById('rst-apply');
        if (applyBtn) {
          applyBtn.addEventListener('click', function () {
            if (getSelectedKeys().length === 0) return;
            state.confirming = true;
            state.doneMsg = '';
            render();
          });
        }

        var cancelConfirm = document.getElementById('rst-cancel-confirm');
        if (cancelConfirm) cancelConfirm.addEventListener('click', function () { state.confirming = false; render(); });

        var doConfirm = document.getElementById('rst-do-confirm');
        if (doConfirm) {
          doConfirm.addEventListener('click', function () {
            var keys = getSelectedKeys();
            if (keys.length === 0) return;
            opts.onApplyReset(keys);
            state.selected = {};
            state.confirming = false;
            state.doneMsg = 'Se restablecieron correctamente los datos seleccionados.';
            render();
          });
        }
      }

      var nextScrollEl = root.querySelector('.modal-body-scroll');
      if (nextScrollEl && prevScrollTop > 0) nextScrollEl.scrollTop = prevScrollTop;
    }

    render();
  }

  window.openResetModal = openResetModal;
})();

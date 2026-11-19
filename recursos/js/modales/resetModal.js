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

  function openResetModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var state = {
      selected: {},
      confirming: false,
      doneMsg: '',
    };

    function getSelectedKeys() {
      return RESET_OPTIONS.map(function (o) { return o.key; }).filter(function (k) { return Boolean(state.selected[k]); });
    }

    function isAllSelected() {
      return getSelectedKeys().length === RESET_OPTIONS.length;
    }

    function render() {
      var esc = window.escapeHTML;
      var selectedKeys = getSelectedKeys();
      var allChecked = isAllSelected();

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

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box modal-flex">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header" style="margin-bottom:0">' +
                '<div style="display:flex;align-items:center;gap:0.65rem">' +
                  '<div class="brand-icon" style="background:rgba(244,63,94,0.16);color:#fb7185"><i class="fa-solid fa-rotate-left"></i></div>' +
                  '<div><h2 class="modal-title">Restablecer Datos</h2><p class="modal-subtitle">Selecciona qué módulos deseas reiniciar</p></div>' +
                '</div>' +
                '<button type="button" class="modal-close" id="rst-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
            '</div>' +
            '<div class="modal-body-scroll">' +
              '<div style="display:flex;flex-direction:column;gap:0.5rem">' + masterHtml + itemsHtml + '</div>' +
              confirmBannerHtml +
              doneBannerHtml +
            '</div>' +
            '<div class="modal-bottom-fixed">' +
              '<button type="button" class="btn btn-secondary" id="rst-cancel">Cerrar</button>' +
              '<button type="button" class="btn btn-primary" id="rst-apply" style="background:#e11d48;border-color:#f43f5e" ' + (selectedKeys.length === 0 ? 'disabled' : '') + '>Restablecer seleccionados (' + selectedKeys.length + ')</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('rst-close').addEventListener('click', closeFn);
      document.getElementById('rst-cancel').addEventListener('click', closeFn);

      var chkAll = document.getElementById('rst-chk-all');
      if (chkAll) {
        chkAll.addEventListener('change', function (e) {
          var check = e.target.checked;
          var nextSel = {};
          if (check) {
            RESET_OPTIONS.forEach(function (o) { nextSel[o.key] = true; });
          }
          state.selected = nextSel;
          state.confirming = false;
          state.doneMsg = '';
          render();
        });
      }

      root.querySelectorAll('.rst-chk').forEach(function (chk) {
        chk.addEventListener('change', function (e) {
          var key = chk.getAttribute('data-rst-key');
          state.selected[key] = e.target.checked;
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

      var cancelConfirmBtn = document.getElementById('rst-cancel-confirm');
      if (cancelConfirmBtn) {
        cancelConfirmBtn.addEventListener('click', function () {
          state.confirming = false;
          render();
        });
      }

      var doConfirmBtn = document.getElementById('rst-do-confirm');
      if (doConfirmBtn) {
        doConfirmBtn.addEventListener('click', function () {
          var keys = isAllSelected() ? ['default_all'] : getSelectedKeys();
          if (keys.length === 0) return;
          opts.onResetSelected(keys);
          state.selected = {};
          state.confirming = false;
          state.doneMsg = 'Se restablecieron correctamente los elementos seleccionados.';
          render();
        });
      }
    }

    render();
  }

  window.openResetModal = openResetModal;
})();

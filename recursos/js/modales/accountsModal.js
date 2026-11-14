(function () {
  function openAccountsModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var state = {
      tab: 'cuentas',
      draftAccounts: (opts.accounts || []).map(function (a) { return Object.assign({}, a); }),
      draftCategories: (opts.categories || []).map(function (c) { return Object.assign({}, c); }),
      newAccName: '',
      newAccKind: 'liquidez',
      newAccBalance: '',
      newAccLimit: '2400000',
      catFilter: 'Egreso',
      newCatName: '',
      newCatIsArq: false,
      confirmReset: false,
      pendingDelete: null, // { kind: 'account' | 'category', key, label }
    };

    function render() {
      var esc = window.escapeHTML;
      var bodyHtml = '';

      if (state.tab === 'cuentas') {
        var accItems = state.draftAccounts.map(function (acc, idx) {
          var limitInput = acc.kind === 'deuda'
            ? '<div style="margin-top:0.4rem;display:flex;align-items:center;gap:0.4rem"><span class="text-muted" style="font-size:0.72rem">Cupo TC:</span><input type="text" inputmode="numeric" class="input acc-limit-inp" data-acc-idx="' + idx + '" value="' + (acc.creditLimit != null ? acc.creditLimit : 2400000) + '" style="padding:0.3rem 0.5rem;font-size:0.75rem;width:8rem" /></div>'
            : '';
          var deleteBtn = state.draftAccounts.length > 1
            ? '<button type="button" class="icon-delete-btn ask-del-acc" data-acc-idx="' + idx + '" title="Eliminar cuenta"><i class="fa-regular fa-trash-can"></i></button>'
            : '';

          return (
            '<div class="config-item" style="flex-direction:column;align-items:stretch">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
                '<div>' +
                  '<strong style="font-size:0.85rem;color:#fff">' + esc(acc.name) + '</strong> ' +
                  '<span class="badge ' + (acc.kind === 'deuda' ? 'badge-rose' : 'badge-sky') + '">' + (acc.kind === 'deuda' ? 'Deuda / TC' : 'Liquidez') + '</span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:0.4rem">' +
                  '<span class="text-muted" style="font-size:0.72rem">Saldo inicial:</span>' +
                  '<input type="text" inputmode="decimal" class="input acc-bal-inp" data-acc-idx="' + idx + '" value="' + (acc.initialBalance || 0) + '" style="padding:0.3rem 0.5rem;font-size:0.78rem;width:7.5rem;text-align:right" />' +
                  deleteBtn +
                '</div>' +
              '</div>' +
              limitInput +
            '</div>'
          );
        }).join('');

        var delAccBanner = (state.pendingDelete && state.pendingDelete.kind === 'account')
          ? '<div class="alert-banner alert-rose" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
              '<span>¿Eliminar cuenta <strong>' + esc(state.pendingDelete.label) + '</strong>?</span>' +
              '<div style="display:flex;gap:0.4rem">' +
                '<button type="button" class="btn btn-secondary" id="cfg-cancel-del" style="padding:0.25rem 0.6rem;font-size:0.72rem">Cancelar</button>' +
                '<button type="button" class="btn btn-primary" id="cfg-confirm-del" style="background:#e11d48;padding:0.25rem 0.6rem;font-size:0.72rem">Sí, eliminar</button>' +
              '</div>' +
            '</div>'
          : '';

        bodyHtml =
          '<div class="config-list">' + accItems + '</div>' +
          delAccBanner +
          '<div class="config-box">' +
            '<p class="field-label" style="margin-bottom:0.5rem;color:#cbd5e1">Agregar nueva cuenta</p>' +
            '<div class="form-grid-2" style="margin-bottom:0.5rem">' +
              '<input type="text" id="new-acc-name" class="input" placeholder="Nombre (ej. Bancolombia, Daviplata)" value="' + esc(state.newAccName) + '" />' +
              '<select id="new-acc-kind" class="select">' +
                '<option value="liquidez" ' + (state.newAccKind === 'liquidez' ? 'selected' : '') + '>Liquidez (Débito/Efectivo)</option>' +
                '<option value="deuda" ' + (state.newAccKind === 'deuda' ? 'selected' : '') + '>Deuda (Tarjeta de Crédito)</option>' +
              '</select>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
              '<input type="text" id="new-acc-bal" class="input" inputmode="decimal" placeholder="Saldo inicial COP" value="' + esc(state.newAccBalance) + '" style="flex:1;min-width:8rem" />' +
              (state.newAccKind === 'deuda'
                ? '<input type="text" id="new-acc-limit" class="input" inputmode="numeric" placeholder="Cupo TC" value="' + esc(state.newAccLimit) + '" style="flex:1;min-width:8rem" />'
                : '') +
              '<button type="button" id="btn-add-acc" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Agregar</button>' +
            '</div>' +
          '</div>';
      } else {
        var filteredCats = state.draftCategories.filter(function (c) { return c.type === state.catFilter; });
        var catItems = filteredCats.map(function (c) {
          return (
            '<div class="config-item">' +
              '<div style="font-size:0.85rem;color:#fff">' + esc(c.name) + (c.isArq ? ' <span class="badge badge-violet">Inversión ARQ</span>' : '') + '</div>' +
              '<button type="button" class="icon-delete-btn ask-del-cat" data-cat-id="' + esc(c.id) + '" data-cat-name="' + esc(c.name) + '" title="Eliminar concepto"><i class="fa-regular fa-trash-can"></i></button>' +
            '</div>'
          );
        }).join('');

        var delCatBanner = (state.pendingDelete && state.pendingDelete.kind === 'category')
          ? '<div class="alert-banner alert-rose" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
              '<span>¿Eliminar concepto <strong>' + esc(state.pendingDelete.label) + '</strong>?</span>' +
              '<div style="display:flex;gap:0.4rem">' +
                '<button type="button" class="btn btn-secondary" id="cfg-cancel-del" style="padding:0.25rem 0.6rem;font-size:0.72rem">Cancelar</button>' +
                '<button type="button" class="btn btn-primary" id="cfg-confirm-del" style="background:#e11d48;padding:0.25rem 0.6rem;font-size:0.72rem">Sí, eliminar</button>' +
              '</div>' +
            '</div>'
          : '';

        bodyHtml =
          '<div class="segmented-tabs" style="margin-bottom:0.75rem">' +
            '<button type="button" class="seg-btn ' + (state.catFilter === 'Egreso' ? 'active-rose' : '') + '" data-cat-type="Egreso">Egresos</button>' +
            '<button type="button" class="seg-btn ' + (state.catFilter === 'Ingreso' ? 'active-emerald' : '') + '" data-cat-type="Ingreso">Ingresos</button>' +
            '<button type="button" class="seg-btn ' + (state.catFilter === 'Traspaso' ? 'active-sky' : '') + '" data-cat-type="Traspaso">Traspasos</button>' +
          '</div>' +
          '<div class="config-list">' + (catItems || '<p class="text-dim" style="text-align:center;font-size:0.8rem">Sin conceptos en este tipo.</p>') + '</div>' +
          delCatBanner +
          '<div class="config-box">' +
            '<p class="field-label" style="margin-bottom:0.5rem;color:#cbd5e1">Nuevo concepto de ' + esc(state.catFilter) + '</p>' +
            '<div style="display:flex;gap:0.5rem">' +
              '<input type="text" id="new-cat-name" class="input" placeholder="Nombre del concepto..." value="' + esc(state.newCatName) + '" />' +
              '<button type="button" id="btn-add-cat" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Agregar</button>' +
            '</div>' +
            (state.catFilter === 'Egreso'
              ? '<label style="display:flex;align-items:center;gap:0.45rem;margin-top:0.5rem;font-size:0.75rem;color:#cbd5e1"><input type="checkbox" id="new-cat-arq" ' + (state.newCatIsArq ? 'checked' : '') + ' /> Contabilizar como inversión / aporte ARQ</label>'
              : '') +
          '</div>';
      }

      var resetSection = state.confirmReset
        ? '<div class="alert-banner alert-rose" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-top:0.5rem">' +
            '<span>¿Seguro que deseas borrar movimientos y empezar en $0?</span>' +
            '<div style="display:flex;gap:0.4rem">' +
              '<button type="button" class="btn btn-secondary" id="cfg-cancel-reset" style="padding:0.25rem 0.6rem;font-size:0.72rem">No</button>' +
              '<button type="button" class="btn btn-primary" id="cfg-confirm-reset" style="background:#e11d48;padding:0.25rem 0.6rem;font-size:0.72rem">Sí, limpiar</button>' +
            '</div>' +
          '</div>'
        : '<button type="button" class="link-btn" style="color:#fb7185" id="cfg-ask-reset">Empezar en blanco (borrar datos demo)</button>';

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box">' +
            '<div class="modal-header">' +
              '<div><h2 class="modal-title">Cuentas y Conceptos (COP)</h2><p class="modal-subtitle">Administra tus cuentas, saldos iniciales y conceptos vinculados a Google Sheets.</p></div>' +
              '<button type="button" class="modal-close" id="cfg-close"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="segmented-tabs cols-2">' +
              '<button type="button" class="seg-btn ' + (state.tab === 'cuentas' ? 'active-indigo' : '') + '" data-cfg-tab="cuentas">Cuentas (' + state.draftAccounts.length + ')</button>' +
              '<button type="button" class="seg-btn ' + (state.tab === 'conceptos' ? 'active-indigo' : '') + '" data-cfg-tab="conceptos">Conceptos (' + state.draftCategories.length + ')</button>' +
            '</div>' +
            '<form id="cfg-form">' +
              bodyHtml +
              resetSection +
              '<div class="modal-footer">' +
                '<button type="button" class="btn btn-secondary" id="cfg-cancel">Cancelar</button>' +
                '<button type="submit" class="btn btn-primary">Guardar cambios</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('cfg-close').addEventListener('click', closeFn);
      document.getElementById('cfg-cancel').addEventListener('click', closeFn);

      root.querySelectorAll('[data-cfg-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.tab = btn.getAttribute('data-cfg-tab');
          state.pendingDelete = null;
          render();
        });
      });

      // Accounts bindings
      root.querySelectorAll('.acc-bal-inp').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var idx = Number(inp.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].initialBalance = Number(e.target.value.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
        });
      });
      root.querySelectorAll('.acc-limit-inp').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var idx = Number(inp.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].creditLimit = Number(e.target.value.replace(/[^0-9]/g, '')) || 0;
        });
      });
      root.querySelectorAll('.ask-del-acc').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-acc-idx'));
          state.pendingDelete = { kind: 'account', key: idx, label: state.draftAccounts[idx].name };
          render();
        });
      });

      var newAccName = document.getElementById('new-acc-name');
      if (newAccName) newAccName.addEventListener('input', function (e) { state.newAccName = e.target.value; });
      var newAccKind = document.getElementById('new-acc-kind');
      if (newAccKind) newAccKind.addEventListener('change', function (e) { state.newAccKind = e.target.value; render(); });
      var newAccBal = document.getElementById('new-acc-bal');
      if (newAccBal) newAccBal.addEventListener('input', function (e) { state.newAccBalance = e.target.value; });
      var newAccLim = document.getElementById('new-acc-limit');
      if (newAccLim) newAccLim.addEventListener('input', function (e) { state.newAccLimit = e.target.value; });
      var addAccBtn = document.getElementById('btn-add-acc');
      if (addAccBtn) {
        addAccBtn.addEventListener('click', function () {
          var trimmed = state.newAccName.trim();
          if (!trimmed) return;
          if (state.draftAccounts.some(function (a) { return a.name.toLowerCase() === trimmed.toLowerCase(); })) return;
          var item = {
            name: trimmed,
            kind: state.newAccKind,
            initialBalance: Number(state.newAccBalance.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0,
          };
          if (state.newAccKind === 'deuda') item.creditLimit = Number(state.newAccLimit.replace(/[^0-9]/g, '')) || 2400000;
          state.draftAccounts.push(item);
          state.newAccName = '';
          state.newAccBalance = '';
          render();
        });
      }

      // Categories bindings
      root.querySelectorAll('[data-cat-type]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.catFilter = btn.getAttribute('data-cat-type');
          state.pendingDelete = null;
          render();
        });
      });
      root.querySelectorAll('.ask-del-cat').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.pendingDelete = {
            kind: 'category',
            key: btn.getAttribute('data-cat-id'),
            label: btn.getAttribute('data-cat-name'),
          };
          render();
        });
      });
      var newCatName = document.getElementById('new-cat-name');
      if (newCatName) newCatName.addEventListener('input', function (e) { state.newCatName = e.target.value; });
      var newCatArq = document.getElementById('new-cat-arq');
      if (newCatArq) newCatArq.addEventListener('change', function (e) { state.newCatIsArq = e.target.checked; });
      var addCatBtn = document.getElementById('btn-add-cat');
      if (addCatBtn) {
        addCatBtn.addEventListener('click', function () {
          var trimmed = state.newCatName.trim();
          if (!trimmed) return;
          var exists = state.draftCategories.some(function (c) {
            return c.type === state.catFilter && c.name.toLowerCase() === trimmed.toLowerCase();
          });
          if (exists) return;
          state.draftCategories.push({
            id: 'cat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            name: trimmed,
            type: state.catFilter,
            isArq: state.catFilter === 'Egreso' ? state.newCatIsArq : false,
          });
          state.newCatName = '';
          state.newCatIsArq = false;
          render();
        });
      }

      // Confirm delete
      var cancelDel = document.getElementById('cfg-cancel-del');
      if (cancelDel) cancelDel.addEventListener('click', function () { state.pendingDelete = null; render(); });
      var confirmDel = document.getElementById('cfg-confirm-del');
      if (confirmDel) {
        confirmDel.addEventListener('click', function () {
          if (state.pendingDelete.kind === 'account') {
            if (state.draftAccounts.length > 1) state.draftAccounts.splice(state.pendingDelete.key, 1);
          } else {
            state.draftCategories = state.draftCategories.filter(function (c) { return c.id !== state.pendingDelete.key; });
          }
          state.pendingDelete = null;
          render();
        });
      }

      // Reset clean
      var askReset = document.getElementById('cfg-ask-reset');
      if (askReset) askReset.addEventListener('click', function () { state.confirmReset = true; render(); });
      var cancelReset = document.getElementById('cfg-cancel-reset');
      if (cancelReset) cancelReset.addEventListener('click', function () { state.confirmReset = false; render(); });
      var confirmReset = document.getElementById('cfg-confirm-reset');
      if (confirmReset) {
        confirmReset.addEventListener('click', function () {
          opts.onResetClean();
          closeFn();
        });
      }

      document.getElementById('cfg-form').addEventListener('submit', function (e) {
        e.preventDefault();
        opts.onSave(state.draftAccounts, state.draftCategories);
        closeFn();
      });
    }

    render();
  }

  window.openAccountsModal = openAccountsModal;
})();

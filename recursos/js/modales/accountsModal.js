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
      newAccIcon: 'auto',
      newAccBalance: '',
      newAccLimit: '2400000',
      newAccMonths: '24',
      newAccInstallment: '',
      newAccDueDay: '15',
      catFilter: 'Egreso',
      newCatName: '',
      newCatIsArq: false,
      confirmReset: false,
      editingAccIdx: null,
      showAddAccount: false,
      showAddCat: false,
      pendingDelete: null, // { kind: 'account' | 'category', key, label }
    };

    function render() {
      var prevScrollEl = root.querySelector('.modal-body-scroll');
      var prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
      var esc = window.escapeHTML;
      var bodyHtml = '';

      if (state.tab === 'cuentas') {
        var iconOptions = [
          { value: 'auto', label: 'Icono: Automático' },
          { value: 'banco', label: 'Banco / Cuenta' },
          { value: 'billetera', label: 'Billetera digital' },
          { value: 'efectivo', label: 'Efectivo' },
          { value: 'debito', label: 'Tarjeta de Débito' },
          { value: 'credito', label: 'Tarjeta de Crédito' },
        ];
        var renderIconSelect = function (cls, attr, selectedVal) {
          return '<select class="select ' + cls + '" ' + attr + ' style="padding:0.3rem 0.5rem;font-size:0.75rem">' +
            iconOptions.map(function (op) {
              return '<option value="' + op.value + '" ' + ((selectedVal || 'auto') === op.value ? 'selected' : '') + '>' + op.label + '</option>';
            }).join('') +
          '</select>';
        };

        var accItems = state.draftAccounts.map(function (acc, idx) {
          var limitInput = acc.kind === 'deuda'
            ? '<div style="display:flex;align-items:center;gap:0.4rem"><span class="text-muted" style="font-size:0.78rem">Cupo TC:</span><input type="text" inputmode="numeric" class="input acc-limit-inp" data-acc-idx="' + idx + '" value="' + (acc.creditLimit != null ? acc.creditLimit : 2400000) + '" style="padding:0.3rem 0.5rem;font-size:0.8rem;width:7.5rem" /></div>'
            : (acc.kind === 'credito'
              ? '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem">' +
                  '<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--text-muted)">Meses:<input type="text" inputmode="numeric" class="input acc-months-inp" data-acc-idx="' + idx + '" value="' + (acc.totalMonths || 12) + '" style="padding:0.3rem 0.45rem;font-size:0.8rem;width:3.8rem" /></label>' +
                  '<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--text-muted)">Cuotas pagas:<input type="text" inputmode="numeric" class="input acc-paid-inst-inp" data-acc-idx="' + idx + '" value="' + (acc.initialPaidInstallments || 0) + '" style="padding:0.3rem 0.45rem;font-size:0.8rem;width:3.5rem" /></label>' +
                  '<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--text-muted)">Cuota:<input type="text" inputmode="decimal" class="input acc-inst-inp" data-acc-idx="' + idx + '" value="' + (acc.monthlyInstallment || 0) + '" style="padding:0.3rem 0.45rem;font-size:0.8rem;width:6.5rem" /></label>' +
                  '<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--text-muted)">Cap. pagado:<input type="text" inputmode="decimal" class="input acc-paid-cap-inp" data-acc-idx="' + idx + '" value="' + (acc.initialPaidCapital || 0) + '" style="padding:0.3rem 0.45rem;font-size:0.8rem;width:6rem" /></label>' +
                  '<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--text-muted)">Int. pagado:<input type="text" inputmode="decimal" class="input acc-paid-int-inp" data-acc-idx="' + idx + '" value="' + (acc.initialPaidInterest || 0) + '" style="padding:0.3rem 0.45rem;font-size:0.8rem;width:6rem" /></label>' +
                  '<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--text-muted)">Día límite:<input type="text" inputmode="numeric" class="input acc-due-inp" data-acc-idx="' + idx + '" value="' + (acc.dueDay || '') + '" placeholder="15" style="padding:0.3rem 0.45rem;font-size:0.8rem;width:3.5rem" /></label>' +
                  '<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.8rem;color:#fda4af;cursor:pointer"><input type="checkbox" class="acc-mora-chk" data-acc-idx="' + idx + '" ' + (acc.inMora ? 'checked' : '') + ' /> En mora</label>' +
                '</div>'
              : '');
          var kindBadgeCls = acc.kind === 'deuda' ? 'badge-rose' : (acc.kind === 'credito' ? 'badge-violet' : 'badge-sky');
          var kindBadgeLbl = acc.kind === 'deuda' ? 'Deuda / TC' : (acc.kind === 'credito' ? 'Crédito' : 'Liquidez');
          var deleteBtn = state.draftAccounts.length > 1
            ? '<button type="button" class="icon-delete-btn ask-del-acc" data-acc-idx="' + idx + '" title="Eliminar cuenta"><i class="fa-regular fa-trash-can"></i></button>'
            : '';

          var isEditingAcc = state.editingAccIdx === idx;
          var detailsHtml = isEditingAcc
            ? '<div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:0.55rem">' +
                '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.5rem">' +
                  '<div style="width:10.5rem">' + renderIconSelect('acc-icon-sel', 'data-acc-idx="' + idx + '"', acc.icon || 'auto') + '</div>' +
                  '<div style="display:flex;align-items:center;gap:0.4rem">' +
                    '<span class="text-muted" style="font-size:0.75rem">Saldo inicial:</span>' +
                    '<input type="text" inputmode="decimal" class="input acc-bal-inp" data-acc-idx="' + idx + '" value="' + (acc.initialBalance || 0) + '" style="padding:0.3rem 0.5rem;font-size:0.8rem;width:7.5rem;text-align:right" />' +
                  '</div>' +
                '</div>' +
                (limitInput ? '<div>' + limitInput + '</div>' : '') +
              '</div>'
            : '';

          return (
            '<div class="config-item" style="flex-direction:column;align-items:stretch">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
                '<div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap">' +
                  '<strong style="font-size:0.88rem;color:var(--text-strong)">' + esc(acc.name) + '</strong>' +
                  '<span class="badge ' + kindBadgeCls + '">' + kindBadgeLbl + '</span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:0.4rem">' +
                  '<button type="button" class="btn btn-secondary toggle-edit-acc" data-acc-idx="' + idx + '" style="padding:0.28rem 0.6rem;font-size:0.76rem">' +
                    '<i class="fa-regular ' + (isEditingAcc ? 'fa-eye-slash' : 'fa-pen-to-square') + '"></i> ' + (isEditingAcc ? 'Ocultar' : 'Editar') +
                  '</button>' +
                  deleteBtn +
                '</div>' +
              '</div>' +
              detailsHtml +
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
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
              '<span class="field-label" style="margin:0;color:var(--text-strong)"><i class="fa-solid fa-plus text-emerald" style="margin-right:0.35rem"></i>Agregar nueva cuenta</span>' +
              '<button type="button" id="cfg-toggle-add-acc" class="link-btn">' + (state.showAddAccount ? 'Ocultar' : '+ Agregar') + '</button>' +
            '</div>' +
            (state.showAddAccount
              ? '<div style="margin-top:0.65rem">' +
                  '<div class="form-grid-2" style="margin-bottom:0.5rem">' +
                    '<input type="text" id="new-acc-name" class="input" placeholder="Nombre (ej. Bancolombia, Daviplata)" value="' + esc(state.newAccName) + '" />' +
                    '<select id="new-acc-kind" class="select">' +
                      '<option value="liquidez" ' + (state.newAccKind === 'liquidez' ? 'selected' : '') + '>Liquidez (Débito/Efectivo)</option>' +
                      '<option value="deuda" ' + (state.newAccKind === 'deuda' ? 'selected' : '') + '>Deuda (Tarjeta de Crédito)</option>' +
                      '<option value="credito" ' + (state.newAccKind === 'credito' ? 'selected' : '') + '>Crédito Bancario (Cuotas)</option>' +
                    '</select>' +
                  '</div>' +
                  '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
                    '<select id="new-acc-icon" class="select" style="flex:1;min-width:9rem">' +
                      iconOptions.map(function (op) {
                        return '<option value="' + op.value + '" ' + (state.newAccIcon === op.value ? 'selected' : '') + '>' + op.label + '</option>';
                      }).join('') +
                    '</select>' +
                    '<input type="text" id="new-acc-bal" class="input" inputmode="decimal" placeholder="Saldo inicial ' + esc(window.AppFormat.getBaseCurrency()) + '" value="' + esc(state.newAccBalance) + '" style="flex:1;min-width:8rem" />' +
                    (state.newAccKind === 'deuda'
                      ? '<input type="text" id="new-acc-limit" class="input" inputmode="numeric" placeholder="Cupo TC" value="' + esc(state.newAccLimit) + '" style="flex:1;min-width:8rem" />'
                      : (state.newAccKind === 'credito'
                        ? '<input type="text" id="new-acc-months" class="input" inputmode="numeric" placeholder="Meses (ej. 24)" value="' + esc(state.newAccMonths) + '" style="flex:1;min-width:6.5rem" />' +
                          '<input type="text" id="new-acc-installment" class="input" inputmode="decimal" placeholder="Cuota mensual" value="' + esc(state.newAccInstallment) + '" style="flex:1;min-width:7.5rem" />' +
                          '<input type="text" id="new-acc-due-day" class="input" inputmode="numeric" placeholder="Día límite (1-31)" value="' + esc(state.newAccDueDay) + '" style="flex:1;min-width:7.5rem" />'
                        : '')) +
                    '<button type="button" id="btn-add-acc" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Guardar cuenta</button>' +
                  '</div>' +
                '</div>'
              : '') +
          '</div>';
      } else {
        var filteredCats = state.draftCategories.filter(function (c) { return c.type === state.catFilter; });
        var catItems = filteredCats.map(function (c) {
          return (
            '<div class="config-item">' +
              '<div style="font-size:0.85rem;color:#fff">' + esc(c.name) + (c.isArq ? ' <span class="badge badge-violet">Inversión</span>' : '') + '</div>' +
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
          '<div class="config-list">' + (catItems || '<p class="text-dim" style="text-align:center;font-size:0.8rem">Sin conceptos en este tipo.</p>') + '</div>' +
          delCatBanner +
          '<div class="config-box">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
              '<span class="field-label" style="margin:0;color:var(--text-strong)"><i class="fa-solid fa-plus text-emerald" style="margin-right:0.35rem"></i>Nuevo concepto de ' + esc(state.catFilter) + '</span>' +
              '<button type="button" id="cfg-toggle-add-cat" class="link-btn">' + (state.showAddCat ? 'Ocultar' : '+ Agregar') + '</button>' +
            '</div>' +
            (state.showAddCat
              ? '<div style="margin-top:0.65rem">' +
                  '<div style="display:flex;gap:0.5rem">' +
                    '<input type="text" id="new-cat-name" class="input" placeholder="Nombre del concepto..." value="' + esc(state.newCatName) + '" />' +
                    '<button type="button" id="btn-add-cat" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Agregar</button>' +
                  '</div>' +
                  (state.catFilter === 'Egreso'
                    ? '<label style="display:flex;align-items:center;gap:0.45rem;margin-top:0.5rem;font-size:0.75rem;color:#cbd5e1"><input type="checkbox" id="new-cat-arq" ' + (state.newCatIsArq ? 'checked' : '') + ' /> Contabilizar como Inversión</label>'
                    : '') +
                '</div>'
              : '') +
          '</div>';
      }

      var catSubTabsHtml = state.tab === 'conceptos'
        ? '<div class="segmented-tabs" style="margin-top:0.6rem;margin-bottom:0">' +
            '<button type="button" class="seg-btn ' + (state.catFilter === 'Egreso' ? 'active-rose' : '') + '" data-cat-type="Egreso">Egresos</button>' +
            '<button type="button" class="seg-btn ' + (state.catFilter === 'Ingreso' ? 'active-emerald' : '') + '" data-cat-type="Ingreso">Ingresos</button>' +
            '<button type="button" class="seg-btn ' + (state.catFilter === 'Traspaso' ? 'active-sky' : '') + '" data-cat-type="Traspaso">Traspasos</button>' +
          '</div>'
        : '';

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box modal-flex">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header">' +
                '<div><h2 class="modal-title">Cuentas y Conceptos (' + esc(window.AppFormat.getBaseCurrency()) + ')</h2><p class="modal-subtitle">Administra tus cuentas, saldos iniciales y conceptos vinculados a Google Sheets.</p></div>' +
                '<button type="button" class="modal-close" id="cfg-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
              '<div class="segmented-tabs cols-2">' +
                '<button type="button" class="seg-btn ' + (state.tab === 'cuentas' ? 'active-indigo' : '') + '" data-cfg-tab="cuentas">Cuentas (' + state.draftAccounts.length + ')</button>' +
                '<button type="button" class="seg-btn ' + (state.tab === 'conceptos' ? 'active-indigo' : '') + '" data-cfg-tab="conceptos">Conceptos (' + state.draftCategories.length + ')</button>' +
              '</div>' +
              catSubTabsHtml +
            '</div>' +
            '<form id="cfg-form" style="display:flex;flex-direction:column;flex:1;min-height:0">' +
              '<div class="modal-body-scroll">' +
                bodyHtml +
              '</div>' +
              '<div class="modal-bottom-fixed">' +
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
      root.querySelectorAll('.acc-months-inp').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var idx = Number(inp.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].totalMonths = Math.max(1, Number(e.target.value.replace(/[^0-9]/g, '')) || 1);
        });
      });
      root.querySelectorAll('.acc-paid-inst-inp').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var idx = Number(inp.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].initialPaidInstallments = Math.max(0, Number(e.target.value.replace(/[^0-9]/g, '')) || 0);
        });
      });
      root.querySelectorAll('.acc-paid-cap-inp').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var idx = Number(inp.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].initialPaidCapital = Number(e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
        });
      });
      root.querySelectorAll('.acc-paid-int-inp').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var idx = Number(inp.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].initialPaidInterest = Number(e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
        });
      });
      root.querySelectorAll('.acc-inst-inp').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var idx = Number(inp.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].monthlyInstallment = Number(e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
        });
      });
      root.querySelectorAll('.acc-due-inp').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          var idx = Number(inp.getAttribute('data-acc-idx'));
          var day = Number(e.target.value.replace(/[^0-9]/g, '')) || 0;
          state.draftAccounts[idx].dueDay = day > 31 ? 31 : day;
        });
      });
      root.querySelectorAll('.acc-mora-chk').forEach(function (chk) {
        chk.addEventListener('change', function (e) {
          var idx = Number(chk.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].inMora = e.target.checked;
        });
      });
      root.querySelectorAll('.acc-icon-sel').forEach(function (sel) {
        sel.addEventListener('change', function (e) {
          var idx = Number(sel.getAttribute('data-acc-idx'));
          state.draftAccounts[idx].icon = e.target.value;
        });
      });
      root.querySelectorAll('.toggle-edit-acc').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-acc-idx'));
          state.editingAccIdx = state.editingAccIdx === idx ? null : idx;
          render();
        });
      });
      root.querySelectorAll('.ask-del-acc').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-acc-idx'));
          state.pendingDelete = { kind: 'account', key: idx, label: state.draftAccounts[idx].name };
          render();
        });
      });

      var toggleAddAccBtn = document.getElementById('cfg-toggle-add-acc');
      if (toggleAddAccBtn) {
        toggleAddAccBtn.addEventListener('click', function () {
          state.showAddAccount = !state.showAddAccount;
          render();
        });
      }

      var toggleAddCatBtn = document.getElementById('cfg-toggle-add-cat');
      if (toggleAddCatBtn) {
        toggleAddCatBtn.addEventListener('click', function () {
          state.showAddCat = !state.showAddCat;
          render();
        });
      }

      var newAccName = document.getElementById('new-acc-name');
      if (newAccName) newAccName.addEventListener('input', function (e) { state.newAccName = e.target.value; });
      var newAccKind = document.getElementById('new-acc-kind');
      if (newAccKind) newAccKind.addEventListener('change', function (e) { state.newAccKind = e.target.value; render(); });
      var newAccIcon = document.getElementById('new-acc-icon');
      if (newAccIcon) newAccIcon.addEventListener('change', function (e) { state.newAccIcon = e.target.value; });
      var newAccBal = document.getElementById('new-acc-bal');
      if (newAccBal) newAccBal.addEventListener('input', function (e) { state.newAccBalance = e.target.value; });
      var newAccLim = document.getElementById('new-acc-limit');
      if (newAccLim) newAccLim.addEventListener('input', function (e) { state.newAccLimit = e.target.value; });
      var newAccMonths = document.getElementById('new-acc-months');
      if (newAccMonths) newAccMonths.addEventListener('input', function (e) { state.newAccMonths = e.target.value; });
      var newAccInst = document.getElementById('new-acc-installment');
      if (newAccInst) newAccInst.addEventListener('input', function (e) { state.newAccInstallment = e.target.value; });
      var newAccDue = document.getElementById('new-acc-due-day');
      if (newAccDue) newAccDue.addEventListener('input', function (e) { state.newAccDueDay = e.target.value; });
      var addAccBtn = document.getElementById('btn-add-acc');
      if (addAccBtn) {
        addAccBtn.addEventListener('click', function () {
          var trimmed = state.newAccName.trim();
          if (!trimmed) return;
          if (state.draftAccounts.some(function (a) { return a.name.toLowerCase() === trimmed.toLowerCase(); })) return;
          var item = {
            name: trimmed,
            kind: state.newAccKind,
            icon: state.newAccIcon || 'auto',
            initialBalance: Number(state.newAccBalance.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0,
          };
          if (state.newAccKind === 'deuda') item.creditLimit = Number(state.newAccLimit.replace(/[^0-9]/g, '')) || 2400000;
          if (state.newAccKind === 'credito') {
            item.totalMonths = Math.max(1, Number(state.newAccMonths.replace(/[^0-9]/g, '')) || 12);
            item.monthlyInstallment = Number(state.newAccInstallment.replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
            var d = Number(state.newAccDueDay.replace(/[^0-9]/g, '')) || 0;
            item.dueDay = d > 31 ? 31 : d;
            item.startMonth = window.AppFormat.getCurrentMonthKey();
            item.inMora = false;
          }
          state.draftAccounts.push(item);
          state.newAccName = '';
          state.newAccIcon = 'auto';
          state.newAccBalance = '';
          state.newAccInstallment = '';
          state.showAddAccount = false;
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
          state.showAddCat = false;
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

      document.getElementById('cfg-form').addEventListener('submit', function (e) {
        e.preventDefault();
        opts.onSave(state.draftAccounts, state.draftCategories);
        closeFn();
      });

      var nextScrollEl = root.querySelector('.modal-body-scroll');
      if (nextScrollEl) nextScrollEl.scrollTop = prevScrollTop;
    }

    render();
  }

  window.openAccountsModal = openAccountsModal;
})();

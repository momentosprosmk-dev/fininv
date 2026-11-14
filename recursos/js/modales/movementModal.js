(function () {
  function openMovementModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var accounts = opts.accounts || [];
    var accountBalances = opts.accountBalances || {};
    var categories = opts.categories || [];
    var preset = opts.preset || {};
    var currentCcDebt = opts.currentCcDebt || 0;

    var liquidAccounts = accounts.filter(function (a) { return a.kind === 'liquidez'; }).map(function (a) { return a.name; });
    var allAccounts = accounts.map(function (a) { return a.name; });
    var debtNames = new Set(accounts.filter(function (a) { return a.kind === 'deuda'; }).map(function (a) { return a.name; }));

    var state = {
      type: preset.type || 'Egreso',
      date: window.AppFormat.getTodayISO(),
      fromAccount: preset.fromAccount || '',
      toAccount: preset.toAccount || '',
      category: preset.category || '',
      description: preset.description || '',
      amountStr: preset.amount ? String(preset.amount) : '',
      isCreatingCat: false,
      newCatName: '',
    };

    function getAvailableFunds(accName) {
      var acc = accounts.find(function (a) { return a.name === accName; });
      var bal = accountBalances[accName] || 0;
      if (acc && acc.kind === 'deuda') {
        var limit = acc.creditLimit != null ? acc.creditLimit : 2400000;
        return limit - bal;
      }
      return bal;
    }

    function render() {
      var esc = window.escapeHTML;
      var fmt = window.AppFormat;
      var parsedAmount = fmt.parseDecimalInput(state.amountStr);
      var availableFrom = state.fromAccount ? getAvailableFunds(state.fromAccount) : 0;
      var isOutflow = state.type === 'Egreso' || state.type === 'Traspaso';
      var hasInsufficient = isOutflow && Boolean(state.fromAccount) && (availableFrom <= 0 || parsedAmount > availableFrom);

      var missingRequired =
        parsedAmount <= 0 ||
        !state.category ||
        (state.type === 'Egreso' && !state.fromAccount) ||
        (state.type === 'Ingreso' && !state.toAccount) ||
        (state.type === 'Traspaso' && (!state.fromAccount || !state.toAccount || state.fromAccount === state.toAccount));

      var catsForType = categories.filter(function (c) { return c.type === state.type; });
      var selectedCatObj = categories.find(function (c) { return c.type === state.type && c.name === state.category; });

      var accountSectionHtml = '';
      if (state.type === 'Egreso') {
        var fromOpts = '<option value="">Selecciona una cuenta...</option>' + allAccounts.map(function (a) {
          return '<option value="' + esc(a) + '" ' + (state.fromAccount === a ? 'selected' : '') + '>' + esc(a) + '</option>';
        }).join('');
        accountSectionHtml =
          '<div class="field-group">' +
            '<label class="field-label">Pagado con</label>' +
            '<select id="mm-from" class="select">' + fromOpts + '</select>' +
            (debtNames.has(state.fromAccount)
              ? '<div class="alert-banner alert-amber" style="margin-top:0.5rem;margin-bottom:0">Cuenta como gasto de este mes y suma a la deuda de ' + esc(state.fromAccount) + '.</div>'
              : '') +
          '</div>';
      } else if (state.type === 'Ingreso') {
        var toOpts = '<option value="">Selecciona una cuenta...</option>' + liquidAccounts.map(function (a) {
          return '<option value="' + esc(a) + '" ' + (state.toAccount === a ? 'selected' : '') + '>' + esc(a) + '</option>';
        }).join('');
        accountSectionHtml =
          '<div class="field-group">' +
            '<label class="field-label">Entra a la cuenta</label>' +
            '<select id="mm-to" class="select">' + toOpts + '</select>' +
          '</div>';
      } else {
        var tFromOpts = '<option value="">Selecciona origen...</option>' + liquidAccounts.map(function (a) {
          return '<option value="' + esc(a) + '" ' + (state.fromAccount === a ? 'selected' : '') + '>' + esc(a) + '</option>';
        }).join('');
        var tToOpts = '<option value="">Selecciona destino...</option>' + allAccounts.filter(function (a) { return a !== state.fromAccount; }).map(function (a) {
          return '<option value="' + esc(a) + '" ' + (state.toAccount === a ? 'selected' : '') + '>' + esc(a) + '</option>';
        }).join('');
        accountSectionHtml =
          '<div class="form-grid-2">' +
            '<div class="field-group"><label class="field-label">Desde</label><select id="mm-from" class="select">' + tFromOpts + '</select></div>' +
            '<div class="field-group"><label class="field-label">Hacia</label><select id="mm-to" class="select">' + tToOpts + '</select></div>' +
          '</div>';
      }

      var catOptionsHtml = '<option value="">Selecciona un concepto...</option>' + catsForType.map(function (c) {
        return '<option value="' + esc(c.name) + '" ' + (state.category === c.name ? 'selected' : '') + '>' + esc(c.name) + (c.isArq ? ' (Inversión ARQ)' : '') + '</option>';
      }).join('');

      var catBlockHtml = state.isCreatingCat
        ? '<div style="display:flex;gap:0.4rem">' +
            '<input type="text" id="mm-new-cat" class="input" placeholder="Nombre del nuevo concepto..." value="' + esc(state.newCatName) + '" />' +
            '<button type="button" id="mm-save-cat" class="btn btn-primary">Crear</button>' +
          '</div>'
        : '<select id="mm-category" class="select">' + catOptionsHtml + '</select>';

      var insufficientBanner = hasInsufficient
        ? '<div class="alert-banner alert-rose">' +
            (debtNames.has(state.fromAccount)
              ? 'No tienes cupo suficiente en <strong>' + esc(state.fromAccount) + '</strong>. Cupo disponible: <strong>' + esc(fmt.formatCOP(Math.max(0, availableFrom))) + '</strong>.'
              : 'Saldo insuficiente en <strong>' + esc(state.fromAccount) + '</strong>. Disponible: <strong>' + esc(fmt.formatCOP(Math.max(0, availableFrom))) + '</strong>.') +
          '</div>'
        : '';

      var arqBanner = (state.type === 'Egreso' && selectedCatObj && selectedCatObj.isArq)
        ? '<div class="alert-banner alert-indigo">Los aportes a <strong>' + esc(selectedCatObj.name) + '</strong> se separan de tu consumo mensual y se contabilizan como inversión.</div>'
        : '';

      root.innerHTML =
        '<div class="modal-backdrop" id="mm-backdrop">' +
          '<div class="modal-box">' +
            '<div class="modal-header">' +
              '<h2 class="modal-title">Registrar Movimiento</h2>' +
              '<button type="button" class="modal-close" id="mm-close"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="segmented-tabs">' +
              '<button type="button" class="seg-btn ' + (state.type === 'Egreso' ? 'active-rose' : '') + '" data-mm-type="Egreso"><i class="fa-solid fa-arrow-trend-down"></i> Egreso</button>' +
              '<button type="button" class="seg-btn ' + (state.type === 'Ingreso' ? 'active-emerald' : '') + '" data-mm-type="Ingreso"><i class="fa-solid fa-arrow-trend-up"></i> Ingreso</button>' +
              '<button type="button" class="seg-btn ' + (state.type === 'Traspaso' ? 'active-sky' : '') + '" data-mm-type="Traspaso"><i class="fa-solid fa-right-left"></i> Traspaso</button>' +
            '</div>' +
            '<form id="mm-form">' +
              '<div class="form-grid-2">' +
                '<div class="field-group"><label class="field-label">Fecha</label><div id="mm-datepicker"></div></div>' +
                '<div class="field-group">' +
                  '<label class="field-label">Monto (COP)</label>' +
                  '<input type="text" inputmode="decimal" id="mm-amount" class="input" placeholder="Ej. 45000 o 45000.50" value="' + esc(state.amountStr) + '" />' +
                  (parsedAmount > 0 ? '<p style="margin:0.25rem 0 0;font-size:0.75rem;color:#a5b4fc">' + esc(fmt.formatCOP(parsedAmount)) + '</p>' : '') +
                '</div>' +
              '</div>' +
              accountSectionHtml +
              '<div class="field-group">' +
                '<div class="field-label-row">' +
                  '<label class="field-label" style="margin:0">Concepto de ' + esc(state.type) + '</label>' +
                  '<div style="display:flex;gap:0.75rem">' +
                    (state.type === 'Traspaso' && currentCcDebt > 0
                      ? '<button type="button" class="link-btn" style="color:#38bdf8" id="mm-fill-debt">Pagar deuda (' + esc(fmt.formatCOP(currentCcDebt)) + ')</button>'
                      : '') +
                    '<button type="button" class="link-btn" id="mm-toggle-cat">' + (state.isCreatingCat ? 'Cancelar' : '+ Nuevo concepto') + '</button>' +
                  '</div>' +
                '</div>' +
                catBlockHtml +
              '</div>' +
              '<div class="field-group">' +
                '<label class="field-label">Descripción (opcional)</label>' +
                '<input type="text" id="mm-desc" class="input" placeholder="Ej. Mercado D1, Uber, Pago arriendo..." value="' + esc(state.description) + '" />' +
              '</div>' +
              arqBanner +
              insufficientBanner +
              '<div class="modal-footer">' +
                '<button type="button" class="btn btn-secondary" id="mm-cancel">Cancelar</button>' +
                '<button type="submit" class="btn btn-primary" ' + (hasInsufficient || missingRequired ? 'disabled' : '') + '>Guardar movimiento</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>';

      // DatePicker
      var dpEl = document.getElementById('mm-datepicker');
      if (dpEl) {
        window.createDatePicker(dpEl, state.date, function (nextDate) {
          state.date = nextDate;
        });
      }

      // Close
      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('mm-close').addEventListener('click', closeFn);
      document.getElementById('mm-cancel').addEventListener('click', closeFn);

      // Type tabs
      root.querySelectorAll('[data-mm-type]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.type = btn.getAttribute('data-mm-type');
          state.isCreatingCat = false;
          state.category = '';
          state.fromAccount = '';
          state.toAccount = '';
          render();
        });
      });

      var amtInput = document.getElementById('mm-amount');
      amtInput.addEventListener('input', function (e) {
        state.amountStr = e.target.value;
        // Solo actualizar botón y preview sin perder foco
        renderSubmitAndPreview();
      });

      var fromSel = document.getElementById('mm-from');
      if (fromSel) {
        fromSel.addEventListener('change', function (e) {
          state.fromAccount = e.target.value;
          if (state.type === 'Traspaso' && state.toAccount === state.fromAccount) state.toAccount = '';
          render();
        });
      }

      var toSel = document.getElementById('mm-to');
      if (toSel) {
        toSel.addEventListener('change', function (e) {
          state.toAccount = e.target.value;
          render();
        });
      }

      var catSel = document.getElementById('mm-category');
      if (catSel) {
        catSel.addEventListener('change', function (e) {
          state.category = e.target.value;
          render();
        });
      }

      var descInput = document.getElementById('mm-desc');
      descInput.addEventListener('input', function (e) {
        state.description = e.target.value;
      });

      var toggleCatBtn = document.getElementById('mm-toggle-cat');
      toggleCatBtn.addEventListener('click', function () {
        state.isCreatingCat = !state.isCreatingCat;
        render();
      });

      var newCatInput = document.getElementById('mm-new-cat');
      if (newCatInput) {
        newCatInput.addEventListener('input', function (e) { state.newCatName = e.target.value; });
      }
      var saveCatBtn = document.getElementById('mm-save-cat');
      if (saveCatBtn) {
        saveCatBtn.addEventListener('click', function () {
          var trimmed = state.newCatName.trim();
          if (!trimmed) return;
          var exists = categories.some(function (c) { return c.type === state.type && c.name.toLowerCase() === trimmed.toLowerCase(); });
          if (!exists) {
            var created = opts.onAddCategory({ name: trimmed, type: state.type, isArq: false });
            categories.push(created);
          }
          state.category = trimmed;
          state.newCatName = '';
          state.isCreatingCat = false;
          render();
        });
      }

      var fillDebtBtn = document.getElementById('mm-fill-debt');
      if (fillDebtBtn) {
        fillDebtBtn.addEventListener('click', function () {
          state.amountStr = String(Math.round(currentCcDebt));
          var cc = accounts.find(function (a) { return a.kind === 'deuda'; });
          if (cc) state.toAccount = cc.name;
          render();
        });
      }

      document.getElementById('mm-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var amt = fmt.parseDecimalInput(state.amountStr);
        var avail = state.fromAccount ? getAvailableFunds(state.fromAccount) : 0;
        var out = state.type === 'Egreso' || state.type === 'Traspaso';
        if (amt <= 0 || !state.category) return;
        if (out && (!state.fromAccount || avail <= 0 || amt > avail)) return;
        if (state.type === 'Ingreso' && !state.toAccount) return;
        if (state.type === 'Traspaso' && (!state.toAccount || state.fromAccount === state.toAccount)) return;

        var month = state.date.slice(0, 7);
        var payload;
        if (state.type === 'Ingreso') {
          payload = {
            date: state.date,
            month: month,
            type: 'Ingreso',
            fromAccount: state.category.toLowerCase().indexOf('arq') !== -1 ? 'ARQ' : 'Externo',
            toAccount: state.toAccount,
            category: state.category,
            description: state.description.trim() || state.category,
            amount: amt,
          };
        } else if (state.type === 'Egreso') {
          var catObj = categories.find(function (c) { return c.type === 'Egreso' && c.name === state.category; });
          payload = {
            date: state.date,
            month: month,
            type: 'Egreso',
            fromAccount: state.fromAccount,
            toAccount: catObj && catObj.isArq ? 'ARQ' : 'Externo',
            category: state.category,
            description: state.description.trim() || state.category,
            amount: amt,
          };
        } else {
          payload = {
            date: state.date,
            month: month,
            type: 'Traspaso',
            fromAccount: state.fromAccount,
            toAccount: state.toAccount,
            category: state.category,
            description: state.description.trim() || (debtNames.has(state.toAccount) ? 'Pago ' + state.toAccount : state.category + ': ' + state.fromAccount + ' → ' + state.toAccount),
            amount: amt,
          };
        }
        opts.onSave(payload);
        closeFn();
      });

      function renderSubmitAndPreview() {
        var amt = fmt.parseDecimalInput(state.amountStr);
        var avail = state.fromAccount ? getAvailableFunds(state.fromAccount) : 0;
        var out = state.type === 'Egreso' || state.type === 'Traspaso';
        var insuf = out && Boolean(state.fromAccount) && (avail <= 0 || amt > avail);
        var miss =
          amt <= 0 ||
          !state.category ||
          (state.type === 'Egreso' && !state.fromAccount) ||
          (state.type === 'Ingreso' && !state.toAccount) ||
          (state.type === 'Traspaso' && (!state.fromAccount || !state.toAccount || state.fromAccount === state.toAccount));

        var submitBtn = root.querySelector('#mm-form button[type="submit"]');
        if (submitBtn) submitBtn.disabled = insuf || miss;

        var parent = amtInput.parentElement;
        var existingPreview = parent.querySelector('p');
        if (amt > 0) {
          if (!existingPreview) {
            existingPreview = document.createElement('p');
            existingPreview.style.cssText = 'margin:0.25rem 0 0;font-size:0.75rem;color:#a5b4fc';
            parent.appendChild(existingPreview);
          }
          existingPreview.textContent = fmt.formatCOP(amt);
        } else if (existingPreview) {
          existingPreview.remove();
        }
      }
    }

    render();
  }

  window.openMovementModal = openMovementModal;
})();

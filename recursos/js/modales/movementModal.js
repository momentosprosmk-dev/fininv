(function () {
  function openMovementModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var accounts = opts.accounts || [];
    var accountBalances = opts.accountBalances || {};
    var categories = opts.categories || [];
    var movements = opts.movements || [];
    var investmentAccounts = opts.investmentAccounts || [];
    var exchangeRates = opts.exchangeRates || {};
    var preset = opts.preset || {};
    var currentCcDebt = opts.currentCcDebt || 0;

    var liquidAccounts = window.sortAlpha(accounts.filter(function (a) { return a.kind === 'liquidez'; }).map(function (a) { return a.name; }));
    var egresoAccounts = window.sortAlpha(accounts.filter(function (a) { return a.kind === 'liquidez' || a.kind === 'deuda'; }).map(function (a) { return a.name; }));
    var allAccounts = window.sortAlpha(accounts.map(function (a) { return a.name; }));
    var debtNames = new Set(accounts.filter(function (a) { return a.kind === 'deuda'; }).map(function (a) { return a.name; }));

    var state = {
      type: preset.type || 'Egreso',
      date: window.AppFormat.getTodayISO(),
      fromAccount: preset.fromAccount || '',
      toAccount: preset.toAccount || '',
      category: preset.category || '',
      invFund: '',
      invRateStr: '',
      invEquivStr: '',
      invEquivManual: false,
      creditRequiredStr: '',
      creditCapitalStr: '',
      creditCapitalManual: false,
      description: preset.description || '',
      showObs: Boolean(preset.description),
      amountStr: preset.amount ? String(preset.amount) : '',
      amountManual: Boolean(preset.amount),
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

    function getCreditMonthState(creditName, dateStr) {
      var acc = accounts.find(function (a) { return a.name === creditName && a.kind === 'credito'; });
      if (!acc) return { locked: false, paidInMonth: 0, requiredAmount: 0, remaining: 0 };
      var mKey = window.AppFormat.getAccountingMonthForDate(dateStr);
      var monthMovs = movements.filter(function (m) {
        var mm = m.date ? window.AppFormat.getAccountingMonthForDate(m.date) : m.month;
        return mm === mKey && m.type === 'Traspaso' && m.toAccount === creditName;
      });
      if (monthMovs.length === 0) {
        var defReq = Number(acc.monthlyInstallment) || 0;
        return { locked: false, paidInMonth: 0, requiredAmount: defReq, remaining: defReq };
      }
      var paid = 0;
      var req = Number(acc.monthlyInstallment) || 0;
      monthMovs.forEach(function (m) {
        paid += Number(m.amount) || 0;
        if (Number(m.creditRequiredAmount) > 0) req = Number(m.creditRequiredAmount);
      });
      return {
        locked: true,
        paidInMonth: paid,
        requiredAmount: req,
        remaining: Math.max(0, req - paid),
      };
    }

    function render() {
      var prevScrollEl = root.querySelector('.modal-body-scroll');
      var prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
      var esc = window.escapeHTML;
      var fmt = window.AppFormat;
      var parsedAmount = fmt.parseDecimalInput(state.amountStr);
      var targetCreditAcc = state.type === 'Traspaso'
        ? accounts.find(function (a) { return a.name === state.toAccount && a.kind === 'credito'; })
        : null;
      var creditMonthState = targetCreditAcc ? getCreditMonthState(targetCreditAcc.name, state.date) : null;
      if (targetCreditAcc && creditMonthState && creditMonthState.locked) {
        state.creditRequiredStr = String(creditMonthState.requiredAmount);
      }
      var parsedCreditReq = targetCreditAcc
        ? (creditMonthState && creditMonthState.locked ? creditMonthState.requiredAmount : fmt.parseDecimalInput(state.creditRequiredStr))
        : 0;
      var availableFrom = state.fromAccount ? getAvailableFunds(state.fromAccount) : 0;
      var isOutflow = state.type === 'Egreso' || state.type === 'Traspaso';
      var hasInsufficient = isOutflow && Boolean(state.fromAccount) && (availableFrom <= 0 || parsedAmount > availableFrom);

      var catsForType = window.sortAlpha(categories.filter(function (c) { return c.type === state.type; }), function (c) { return c.name; });
      var selectedCatObj = categories.find(function (c) { return c.type === state.type && c.name === state.category; });
      var isInvExpense = state.type === 'Egreso' && selectedCatObj && selectedCatObj.isArq && investmentAccounts.length > 0;
      var lowerCat = String(state.category || '').toLowerCase();
      var isInvIncome = state.type === 'Ingreso' && investmentAccounts.length > 0 && (lowerCat.indexOf('inversión') !== -1 || lowerCat.indexOf('inversion') !== -1 || lowerCat.indexOf('arq') !== -1);
      var needsInvFund = isInvExpense || isInvIncome;
      var selectedInvObj = needsInvFund ? investmentAccounts.find(function (ia) { return ia.name === state.invFund; }) : null;
      var baseCur = fmt.getBaseCurrency();
      var invCur = selectedInvObj ? (selectedInvObj.currency || baseCur) : baseCur;
      var isForeignInv = invCur !== baseCur;
      var activeInvRate = isForeignInv ? (fmt.parseDecimalInput(state.invRateStr) || window.AppInvestments.getEffectiveRate(invCur, exchangeRates)) : 1;
      var parsedEquiv = isForeignInv
        ? (state.invEquivManual ? fmt.parseDecimalInput(state.invEquivStr) : (parsedAmount > 0 && activeInvRate > 0 ? Math.round((parsedAmount / activeInvRate) * 100) / 100 : 0))
        : parsedAmount;

      var missingRequired =
        parsedAmount <= 0 ||
        !state.category ||
        (state.type === 'Egreso' && !state.fromAccount) ||
        (state.type === 'Ingreso' && !state.toAccount) ||
        (state.type === 'Traspaso' && (!state.fromAccount || !state.toAccount || state.fromAccount === state.toAccount)) ||
        (needsInvFund && !state.invFund) ||
        (needsInvFund && isForeignInv && parsedEquiv <= 0);

      function getCreditDiffInfo(reqNow, paidBefore, amt) {
        if (!(reqNow > 0)) {
          return {
            color: 'var(--text-muted)',
            text: 'Indica la cuota obligatoria del mes para controlar si queda saldo pendiente.',
          };
        }
        var rawDiff = reqNow - (paidBefore + amt);
        if (rawDiff > 0) {
          return {
            color: '#fbbf24',
            text: 'Quedará pendiente ' + fmt.formatCOP(rawDiff) + ' de la cuota de este mes.',
          };
        }
        if (rawDiff < 0) {
          return {
            color: '#34d399',
            text: 'Deja el saldo pendiente en ' + fmt.formatCOP(0) + ' (cuota cubierta, excedente de ' + fmt.formatCOP(Math.abs(rawDiff)) + ').',
          };
        }
        return {
          color: '#34d399',
          text: 'Deja el saldo pendiente de este mes en ' + fmt.formatCOP(0) + ' (cuota cubierta).',
        };
      }

      var targetDebtBal = (state.type === 'Traspaso' && debtNames.has(state.toAccount))
        ? Math.max(0, accountBalances[state.toAccount] || 0)
        : 0;
      var amountFieldHtml =
        '<div class="field-group"' + (targetCreditAcc ? ' style="margin-bottom:0.45rem"' : '') + '>' +
          '<label class="field-label">' + (targetCreditAcc ? 'Cuota a pagar / abono (' + esc(baseCur) + ')' : 'Monto (' + esc(baseCur) + ')') + '</label>' +
          '<input type="text" inputmode="decimal" id="mm-amount" class="input" placeholder="Ej. 45000 o 45000.50" value="' + esc(state.amountStr) + '" />' +
          (parsedAmount > 0 ? '<p id="mm-amount-preview" style="margin:0.25rem 0 0;font-size:0.75rem;color:#a5b4fc">' + esc(fmt.formatCOP(parsedAmount)) + '</p>' : '') +
          (state.type === 'Traspaso' && debtNames.has(state.toAccount)
            ? '<p style="margin:0.25rem 0 0;font-size:0.78rem;color:var(--text-muted)">Deuda pendiente en ' + esc(state.toAccount) + ': <strong style="color:#38bdf8">' + esc(fmt.formatCOP(targetDebtBal)) + '</strong></p>'
            : '') +
        '</div>';

      var accountSectionHtml = '';
      if (state.type === 'Egreso') {
        var fromOpts = '<option value="">Selecciona una cuenta...</option>' + egresoAccounts.map(function (a) {
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
        var tFromOpts = '<option value="">Selecciona origen...</option>' + egresoAccounts.map(function (a) {
          return '<option value="' + esc(a) + '" ' + (state.fromAccount === a ? 'selected' : '') + '>' + esc(a) + '</option>';
        }).join('');
        var tToOpts = '<option value="">Selecciona destino...</option>' + allAccounts.filter(function (a) { return a !== state.fromAccount; }).map(function (a) {
          return '<option value="' + esc(a) + '" ' + (state.toAccount === a ? 'selected' : '') + '>' + esc(a) + '</option>';
        }).join('');
        var creditBoxHtml = '';
        if (targetCreditAcc) {
          var isReqLocked = Boolean(creditMonthState && creditMonthState.locked);
          var paidSoFar = creditMonthState ? creditMonthState.paidInMonth : 0;
          var diffInfo = getCreditDiffInfo(parsedCreditReq, paidSoFar, parsedAmount);
          var parsedCapVal = state.creditCapitalManual
            ? Math.min(parsedAmount, Math.max(0, fmt.parseDecimalInput(state.creditCapitalStr)))
            : parsedAmount;
          var parsedIntVal = Math.max(0, parsedAmount - parsedCapVal);
          var alreadyPaidLine = '';
          if (isReqLocked) {
            if (paidSoFar > parsedCreditReq && parsedCreditReq > 0) {
              alreadyPaidLine = '<p style="margin:0 0 0.45rem;font-size:0.8rem;color:var(--text-muted)">Ya abonaste <strong>' + esc(fmt.formatCOP(paidSoFar)) + '</strong> este mes (cuota cubierta con excedente de <strong>' + esc(fmt.formatCOP(paidSoFar - parsedCreditReq)) + '</strong>).</p>';
            } else {
              alreadyPaidLine = '<p style="margin:0 0 0.45rem;font-size:0.8rem;color:var(--text-muted)">Ya abonaste <strong>' + esc(fmt.formatCOP(paidSoFar)) + '</strong> este mes (resta <strong>' + esc(fmt.formatCOP(creditMonthState.remaining)) + '</strong>).</p>';
            }
          }
          creditBoxHtml =
            '<div class="config-box" style="margin-bottom:0.85rem">' +
              '<div class="field-group" style="margin-bottom:0.45rem">' +
                '<label class="field-label" for="mm-credit-required">Cuota obligatoria del mes (' + esc(baseCur) + ')' + (isReqLocked ? ' <span class="badge badge-indigo">Fijada este mes</span>' : '') + '</label>' +
                '<input type="text" inputmode="decimal" id="mm-credit-required" class="input" placeholder="Ej. 300000" value="' + esc(state.creditRequiredStr) + '" ' + (isReqLocked ? 'readonly style="opacity:0.75;cursor:not-allowed"' : '') + ' />' +
              '</div>' +
              alreadyPaidLine +
              amountFieldHtml +
              '<div class="field-group" style="margin-top:0.45rem;margin-bottom:0.45rem">' +
                '<label class="field-label" for="mm-credit-capital">Abono a capital (' + esc(baseCur) + ')</label>' +
                '<input type="text" inputmode="decimal" id="mm-credit-capital" class="input" placeholder="Igual al total si no hay intereses" value="' + esc(state.creditCapitalManual ? state.creditCapitalStr : state.amountStr) + '" />' +
                '<p id="mm-credit-int-hint" style="margin:0.25rem 0 0;font-size:0.78rem;color:var(--text-muted)">Intereses / gastos de este pago: <strong style="color:#fbbf24">' + esc(fmt.formatCOP(parsedIntVal)) + '</strong></p>' +
              '</div>' +
              '<p id="mm-credit-diff-hint" style="margin:0;font-size:0.82rem;color:' + diffInfo.color + '">' + esc(diffInfo.text) + '</p>' +
            '</div>';
        }
        accountSectionHtml =
          '<div class="form-grid-2">' +
            '<div class="field-group">' +
              '<label class="field-label">Desde</label>' +
              '<select id="mm-from" class="select">' + tFromOpts + '</select>' +
              (debtNames.has(state.fromAccount)
                ? '<div class="alert-banner alert-amber" style="margin-top:0.5rem;margin-bottom:0">Avance desde <strong>' + esc(state.fromAccount) + '</strong>: aumenta tu deuda en la tarjeta de crédito e ingresa el dinero a la cuenta destino.</div>'
                : '') +
            '</div>' +
            '<div class="field-group"><label class="field-label">Hacia</label><select id="mm-to" class="select">' + tToOpts + '</select></div>' +
          '</div>';
      }

      var catOptionsHtml = '<option value="">Selecciona un concepto...</option>' + catsForType.map(function (c) {
        return '<option value="' + esc(c.name) + '" ' + (state.category === c.name ? 'selected' : '') + '>' + esc(c.name) + '</option>';
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

      var invFundHtml = '';
      if (needsInvFund) {
        var invOpts = '<option value="">Selecciona fondo de inversión...</option>' + window.sortAlpha(investmentAccounts, function (ia) { return ia.name; }).map(function (ia) {
          return '<option value="' + esc(ia.name) + '" ' + (state.invFund === ia.name ? 'selected' : '') + '>' + esc(ia.name) + ' (' + esc(ia.currency || baseCur) + ')</option>';
        }).join('');
        invFundHtml =
          '<div class="config-box">' +
            '<div class="field-group" style="margin-bottom:' + (isForeignInv ? '0.65rem' : '0') + '">' +
              '<label class="field-label">' + (isInvExpense ? 'Fondo de Inversión destino' : 'Fondo de Inversión origen') + '</label>' +
              '<select id="mm-inv-fund" class="select">' + invOpts + '</select>' +
            '</div>' +
            (isForeignInv
              ? '<div class="field-group" style="margin-bottom:0">' +
                  '<label class="field-label">¿A cuánto equivale en ' + esc(invCur) + ' (' + (isInvExpense ? 'entra al fondo' : 'sale del fondo') + ')?</label>' +
                  '<input type="text" inputmode="decimal" id="mm-inv-equiv" class="input" placeholder="Ej. 25.50" value="' + esc(state.invEquivManual ? state.invEquivStr : (parsedEquiv > 0 ? String(parsedEquiv) : '')) + '" />' +
                  '<p id="mm-inv-rate-hint" style="margin:0.3rem 0 0;font-size:0.78rem;color:#34d399">' +
                    (parsedAmount > 0 && parsedEquiv > 0
                      ? 'Finanzas: ' + esc(fmt.formatCOP(parsedAmount)) + ' &rarr; Fondo: ' + esc(fmt.formatCurrency(parsedEquiv, invCur)) + ' (1 ' + esc(invCur) + ' ≈ ' + esc(fmt.formatCOP(parsedAmount / parsedEquiv)) + ')'
                      : 'Ingresa el monto equivalente en ' + esc(invCur) + ' (tasa ref: ' + esc(fmt.formatCOP(activeInvRate)) + ').') +
                  '</p>' +
                '</div>'
              : '') +
          '</div>';
      }

      var arqBanner = (state.type === 'Egreso' && selectedCatObj && selectedCatObj.isArq)
        ? '<div class="alert-banner alert-indigo">Los aportes a <strong>' + esc(selectedCatObj.name) + '</strong> se separan de tu consumo mensual y se contabilizan en el módulo de Inversiones.</div>'
        : '';

      root.innerHTML =
        '<div class="modal-backdrop" id="mm-backdrop">' +
          '<form id="mm-form" class="modal-box modal-flex">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header">' +
                '<h2 class="modal-title">Registrar Movimiento</h2>' +
                '<button type="button" class="modal-close" id="mm-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
              '<div class="segmented-tabs" style="margin-bottom:0">' +
                '<button type="button" class="seg-btn ' + (state.type === 'Egreso' ? 'active-rose' : '') + '" data-mm-type="Egreso"><i class="fa-solid fa-arrow-trend-down"></i> Egreso</button>' +
                '<button type="button" class="seg-btn ' + (state.type === 'Ingreso' ? 'active-emerald' : '') + '" data-mm-type="Ingreso"><i class="fa-solid fa-arrow-trend-up"></i> Ingreso</button>' +
                '<button type="button" class="seg-btn ' + (state.type === 'Traspaso' ? 'active-sky' : '') + '" data-mm-type="Traspaso"><i class="fa-solid fa-right-left"></i> Traspaso</button>' +
              '</div>' +
            '</div>' +
            '<div class="modal-body-scroll">' +
              '<div class="field-group"><label class="field-label">Fecha</label><div id="mm-datepicker"></div></div>' +
              accountSectionHtml +
              '<div class="field-group">' +
                '<div class="field-label-row">' +
                  '<label class="field-label" style="margin:0">Concepto de ' + esc(state.type) + '</label>' +
                  '<button type="button" class="link-btn" id="mm-toggle-cat">' + (state.isCreatingCat ? 'Cancelar' : '+ Nuevo concepto') + '</button>' +
                '</div>' +
                catBlockHtml +
              '</div>' +
              (state.type === 'Traspaso' && targetCreditAcc ? creditBoxHtml : amountFieldHtml) +
              invFundHtml +
              '<div class="field-group" style="margin-bottom:0">' +
                '<label class="obs-toggle-row">' +
                  '<span class="obs-toggle-label">Agregar observaciones</span>' +
                  '<span class="obs-switch ' + (state.showObs ? 'is-on' : '') + '"><input type="checkbox" id="mm-obs-toggle" ' + (state.showObs ? 'checked' : '') + ' /><span class="obs-switch-thumb"></span></span>' +
                '</label>' +
                (state.showObs
                  ? '<input type="text" id="mm-desc" class="input" style="margin-top:0.5rem" placeholder="Ej. Mercado D1, Uber, Pago arriendo..." value="' + esc(state.description) + '" />'
                  : '') +
              '</div>' +
              arqBanner +
              insufficientBanner +
            '</div>' +
            '<div class="modal-bottom-fixed">' +
              '<button type="button" class="btn btn-secondary" id="mm-cancel">Cancelar</button>' +
              '<button type="submit" class="btn btn-primary" ' + (hasInsufficient || missingRequired ? 'disabled' : '') + '>Guardar movimiento</button>' +
            '</div>' +
          '</form>' +
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
        state.amountManual = state.amountStr.trim() !== '';
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
          state.amountManual = false;
          state.creditCapitalManual = false;
          state.creditCapitalStr = '';
          var cState = getCreditMonthState(state.toAccount, state.date);
          if (cState.requiredAmount > 0) {
            state.creditRequiredStr = String(cState.requiredAmount);
            state.amountStr = cState.remaining > 0 ? String(cState.remaining) : '';
          } else if (debtNames.has(state.toAccount)) {
            state.creditRequiredStr = '';
            var debtBal = Math.max(0, accountBalances[state.toAccount] || 0);
            state.amountStr = debtBal > 0 ? String(Math.round(debtBal * 100) / 100) : '';
          } else {
            state.creditRequiredStr = '';
          }
          render();
        });
      }

      var creditReqInp = document.getElementById('mm-credit-required');
      if (creditReqInp && !(creditMonthState && creditMonthState.locked)) {
        creditReqInp.addEventListener('input', function (e) {
          state.creditRequiredStr = e.target.value;
          if (!state.amountManual) {
            state.amountStr = e.target.value;
            if (amtInput) amtInput.value = e.target.value;
          }
          renderSubmitAndPreview();
        });
      }

      var creditCapInp = document.getElementById('mm-credit-capital');
      if (creditCapInp) {
        creditCapInp.addEventListener('input', function (e) {
          state.creditCapitalStr = e.target.value;
          state.creditCapitalManual = state.creditCapitalStr.trim() !== '';
          renderSubmitAndPreview();
        });
      }

      var catSel = document.getElementById('mm-category');
      if (catSel) {
        catSel.addEventListener('change', function (e) {
          state.category = e.target.value;
          state.invFund = '';
          render();
        });
      }

      var invFundSel = document.getElementById('mm-inv-fund');
      if (invFundSel) {
        invFundSel.addEventListener('change', function (e) {
          state.invFund = e.target.value;
          var obj = investmentAccounts.find(function (ia) { return ia.name === state.invFund; });
          var cur = obj && obj.currency ? obj.currency : baseCur;
          state.invRateStr = cur !== baseCur
            ? String(window.AppInvestments.getEffectiveRate(cur, exchangeRates))
            : '1';
          state.invEquivManual = false;
          state.invEquivStr = '';
          render();
        });
      }

      var invEquivInp = document.getElementById('mm-inv-equiv');
      if (invEquivInp) {
        invEquivInp.addEventListener('input', function (e) {
          state.invEquivManual = true;
          state.invEquivStr = e.target.value;
          var hint = document.getElementById('mm-inv-rate-hint');
          var amtNow = fmt.parseDecimalInput(state.amountStr);
          var eqNow = fmt.parseDecimalInput(state.invEquivStr);
          if (hint) {
            hint.innerHTML = (amtNow > 0 && eqNow > 0)
              ? 'Finanzas: ' + esc(fmt.formatCOP(amtNow)) + ' &rarr; Fondo: ' + esc(fmt.formatCurrency(eqNow, invCur)) + ' (1 ' + esc(invCur) + ' ≈ ' + esc(fmt.formatCOP(amtNow / eqNow)) + ')'
              : 'Ingresa el monto equivalente en ' + esc(invCur) + '.';
          }
          renderSubmitAndPreview();
        });
      }

      var obsToggle = document.getElementById('mm-obs-toggle');
      if (obsToggle) {
        obsToggle.addEventListener('change', function (e) {
          state.showObs = Boolean(e.target.checked);
          if (!state.showObs) state.description = '';
          render();
          if (state.showObs) {
            var dEl = document.getElementById('mm-desc');
            if (dEl) dEl.focus();
          }
        });
      }

      var descInput = document.getElementById('mm-desc');
      if (descInput) {
        descInput.addEventListener('input', function (e) {
          state.description = e.target.value;
        });
      }

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

      document.getElementById('mm-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var amt = fmt.parseDecimalInput(state.amountStr);
        var avail = state.fromAccount ? getAvailableFunds(state.fromAccount) : 0;
        var out = state.type === 'Egreso' || state.type === 'Traspaso';
        if (amt <= 0 || !state.category) return;
        if (out && (!state.fromAccount || avail <= 0 || amt > avail)) return;
        if (state.type === 'Ingreso' && !state.toAccount) return;
        if (state.type === 'Traspaso' && (!state.toAccount || state.fromAccount === state.toAccount)) return;
        if (needsInvFund && !state.invFund) return;

        var month = state.date.slice(0, 7);
        var payload;
        var invPayload = null;
        if (state.type === 'Ingreso') {
          payload = {
            date: state.date,
            month: month,
            type: 'Ingreso',
            fromAccount: isInvIncome ? state.invFund : (state.category.toLowerCase().indexOf('inversión') !== -1 || state.category.toLowerCase().indexOf('inversion') !== -1 ? 'Inversión' : 'Externo'),
            toAccount: state.toAccount,
            category: state.category,
            description: state.description.trim() || state.category,
            amount: amt,
          };
          if (isInvIncome) {
            var eqIncome = isForeignInv
              ? (state.invEquivManual ? fmt.parseDecimalInput(state.invEquivStr) : Math.round((amt / activeInvRate) * 100) / 100)
              : amt;
            var rateIncome = isForeignInv && eqIncome > 0 ? Math.round((amt / eqIncome) * 100) / 100 : 1;
            invPayload = {
              date: state.date,
              type: 'Retiro',
              fundId: selectedInvObj ? selectedInvObj.id : '',
              fundName: state.invFund,
              subId: '',
              subName: '',
              normalAccount: state.toAccount,
              description: payload.description,
              amount: eqIncome,
              commission: 0,
              commissionApply: 'moved',
              exchangeRate: rateIncome,
              amountCOP: amt,
            };
          }
        } else if (state.type === 'Egreso') {
          var catObj = categories.find(function (c) { return c.type === 'Egreso' && c.name === state.category; });
          payload = {
            date: state.date,
            month: month,
            type: 'Egreso',
            fromAccount: state.fromAccount,
            toAccount: isInvExpense ? state.invFund : (catObj && catObj.isArq ? 'Inversión' : 'Externo'),
            category: state.category,
            description: state.description.trim() || state.category,
            amount: amt,
          };
          if (isInvExpense) {
            var eqExpense = isForeignInv
              ? (state.invEquivManual ? fmt.parseDecimalInput(state.invEquivStr) : Math.round((amt / activeInvRate) * 100) / 100)
              : amt;
            var rateExpense = isForeignInv && eqExpense > 0 ? Math.round((amt / eqExpense) * 100) / 100 : 1;
            invPayload = {
              date: state.date,
              type: 'Aporte',
              fundId: selectedInvObj ? selectedInvObj.id : '',
              fundName: state.invFund,
              subId: '',
              subName: '',
              normalAccount: state.fromAccount,
              description: payload.description,
              amount: eqExpense,
              commission: 0,
              commissionApply: 'moved',
              exchangeRate: rateExpense,
              amountCOP: amt,
            };
          }
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
          var finalCreditReq = targetCreditAcc
            ? ((creditMonthState && creditMonthState.locked)
                ? creditMonthState.requiredAmount
                : fmt.parseDecimalInput(state.creditRequiredStr))
            : 0;
          if (targetCreditAcc && finalCreditReq > 0) {
            payload.creditRequiredAmount = finalCreditReq;
          }
          if (targetCreditAcc) {
            var finalCapAmt = state.creditCapitalManual
              ? Math.min(amt, Math.max(0, fmt.parseDecimalInput(state.creditCapitalStr)))
              : amt;
            payload.capitalAmount = finalCapAmt;
          }
        }
        opts.onSave(payload, invPayload);
        closeFn();
      });

      var nextScrollEl = root.querySelector('.modal-body-scroll');
      if (nextScrollEl) nextScrollEl.scrollTop = prevScrollTop;

      function renderSubmitAndPreview() {
        var amt = fmt.parseDecimalInput(state.amountStr);
        var avail = state.fromAccount ? getAvailableFunds(state.fromAccount) : 0;
        var out = state.type === 'Egreso' || state.type === 'Traspaso';
        var insuf = out && Boolean(state.fromAccount) && (avail <= 0 || amt > avail);
        var eqNow = isForeignInv
          ? (state.invEquivManual ? fmt.parseDecimalInput(state.invEquivStr) : (amt > 0 && activeInvRate > 0 ? Math.round((amt / activeInvRate) * 100) / 100 : 0))
          : amt;
        var miss =
          amt <= 0 ||
          !state.category ||
          (state.type === 'Egreso' && !state.fromAccount) ||
          (state.type === 'Ingreso' && !state.toAccount) ||
          (state.type === 'Traspaso' && (!state.fromAccount || !state.toAccount || state.fromAccount === state.toAccount)) ||
          (needsInvFund && !state.invFund) ||
          (needsInvFund && isForeignInv && eqNow <= 0);

        if (isForeignInv) {
          var eqInp = document.getElementById('mm-inv-equiv');
          if (eqInp && !state.invEquivManual) {
            eqInp.value = eqNow > 0 ? String(eqNow) : '';
          }
          var hintEl = document.getElementById('mm-inv-rate-hint');
          if (hintEl) {
            hintEl.innerHTML = (amt > 0 && eqNow > 0)
              ? 'Finanzas: ' + esc(fmt.formatCOP(amt)) + ' &rarr; Fondo: ' + esc(fmt.formatCurrency(eqNow, invCur)) + ' (1 ' + esc(invCur) + ' ≈ ' + esc(fmt.formatCOP(amt / eqNow)) + ')'
              : 'Ingresa el monto equivalente en ' + esc(invCur) + ' (tasa ref: ' + esc(fmt.formatCOP(activeInvRate)) + ').';
          }
        }

        if (targetCreditAcc) {
          var reqNow = (creditMonthState && creditMonthState.locked)
            ? creditMonthState.requiredAmount
            : fmt.parseDecimalInput(state.creditRequiredStr);
          var paidBefore = creditMonthState ? creditMonthState.paidInMonth : 0;
          var diffInfoNow = getCreditDiffInfo(reqNow, paidBefore, amt);
          var diffEl = document.getElementById('mm-credit-diff-hint');
          if (diffEl) {
            diffEl.style.color = diffInfoNow.color;
            diffEl.textContent = diffInfoNow.text;
          }
          var capInpEl = document.getElementById('mm-credit-capital');
          if (capInpEl && !state.creditCapitalManual) {
            capInpEl.value = state.amountStr;
          }
          var capNow = state.creditCapitalManual
            ? Math.min(amt, Math.max(0, fmt.parseDecimalInput(state.creditCapitalStr)))
            : amt;
          var intNow = Math.max(0, amt - capNow);
          var intHintEl = document.getElementById('mm-credit-int-hint');
          if (intHintEl) {
            intHintEl.innerHTML = 'Intereses / gastos de este pago: <strong style="color:#fbbf24">' + esc(fmt.formatCOP(intNow)) + '</strong>';
          }
        }
        var submitBtn = root.querySelector('#mm-form button[type="submit"]');
        if (submitBtn) submitBtn.disabled = insuf || miss;

        var parent = amtInput.parentElement;
        var existingPreview = document.getElementById('mm-amount-preview');
        if (amt > 0) {
          if (!existingPreview) {
            existingPreview = document.createElement('p');
            existingPreview.id = 'mm-amount-preview';
            existingPreview.style.cssText = 'margin:0.25rem 0 0;font-size:0.75rem;color:#a5b4fc';
            amtInput.insertAdjacentElement('afterend', existingPreview);
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

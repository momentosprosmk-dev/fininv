(function () {
  function openInvestmentAccountModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;
    var existing = opts.account || null;
    var state = {
      name: existing ? existing.name : '',
      mode: existing ? existing.mode : 'simple',
      currency: existing ? existing.currency : window.AppFormat.getBaseCurrency(),
      initialBalance: existing ? String(existing.initialBalance || 0) : '',
      goal: existing && existing.goal ? String(existing.goal) : '',
      notes: existing ? (existing.notes || '') : '',
      showObs: Boolean(existing && existing.notes),
    };

    function render(focusId, selStart, selEnd) {
      var prevScrollEl = root.querySelector('.modal-body-scroll');
      var prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
      var esc = window.escapeHTML;
      var currencies = window.AppFormat.getSupportedCurrencies();
      var curOpts = currencies.map(function (c) {
        return '<option value="' + esc(c.code) + '" ' + (state.currency === c.code ? 'selected' : '') + '>' + esc(c.label) + '</option>';
      }).join('');

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<form id="ia-form" class="modal-box modal-flex">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header" style="margin-bottom:0">' +
                '<div><h2 class="modal-title">' + (existing ? 'Editar Cuenta de Inversión' : 'Nueva Cuenta de Inversión') + '</h2><p class="modal-subtitle">Configura una cartera gestionada (BBVA, CDT) o cartera libre (ARQ, acciones).</p></div>' +
                '<button type="button" class="modal-close" id="ia-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
            '</div>' +
            '<div class="modal-body-scroll">' +
              '<div class="field-group">' +
                '<label class="field-label">Nombre de la inversión / bróker</label>' +
                '<input type="text" id="ia-name" class="input" placeholder="Ej. ARQ, Fondo BBVA, Cajita Nu" value="' + esc(state.name) + '" ' + (existing ? 'readonly' : '') + ' />' +
              '</div>' +
              '<div class="form-grid-2">' +
                '<div class="field-group">' +
                  '<label class="field-label">Tipo de cartera</label>' +
                  '<select id="ia-mode" class="select">' +
                    '<option value="simple" ' + (state.mode === 'simple' ? 'selected' : '') + '>Cartera Gestionada (la maneja la entidad financiera)</option>' +
                    '<option value="fragmentado" ' + (state.mode === 'fragmentado' ? 'selected' : '') + '>Cartera Libre (tú eliges en qué invertir)</option>' +
                  '</select>' +
                '</div>' +
                '<div class="field-group">' +
                  '<label class="field-label">Moneda de la inversión</label>' +
                  '<select id="ia-currency" class="select" ' + (existing ? 'disabled' : '') + '>' + curOpts + '</select>' +
                  (existing ? '<span style="display:block;margin-top:0.25rem;font-size:0.75rem;color:var(--text-dim)">La moneda no se puede cambiar después de crear la inversión.</span>' : '') +
                '</div>' +
              '</div>' +
              '<div class="form-grid-2">' +
                '<div class="field-group">' +
                  '<label class="field-label">Saldo inicial disponible (' + esc(state.currency) + ')</label>' +
                  '<input type="text" inputmode="decimal" id="ia-init" class="input" placeholder="0" value="' + esc(state.initialBalance) + '" />' +
                '</div>' +
                '<div class="field-group">' +
                  '<label class="field-label">Meta opcional (' + esc(state.currency) + ')</label>' +
                  '<input type="text" inputmode="decimal" id="ia-goal" class="input" placeholder="Ej. 10000000" value="' + esc(state.goal) + '" />' +
                '</div>' +
              '</div>' +
              '<div class="field-group" style="margin-bottom:0">' +
                '<label class="obs-toggle-row">' +
                  '<span class="obs-toggle-label">Agregar observaciones</span>' +
                  '<span class="obs-switch ' + (state.showObs ? 'is-on' : '') + '"><input type="checkbox" id="ia-obs-toggle" ' + (state.showObs ? 'checked' : '') + ' /><span class="obs-switch-thumb"></span></span>' +
                '</label>' +
                (state.showObs
                  ? '<input type="text" id="ia-notes" class="input" style="margin-top:0.5rem" placeholder="Ej. Fondo balanceado global, acciones tech..." value="' + esc(state.notes) + '" />'
                  : '') +
              '</div>' +
            '</div>' +
            '<div class="modal-bottom-fixed">' +
              '<button type="button" class="btn btn-secondary" id="ia-cancel">Cancelar</button>' +
              '<button type="submit" class="btn btn-primary">' + (existing ? 'Guardar cambios' : 'Crear cuenta') + '</button>' +
            '</div>' +
          '</form>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('ia-close').addEventListener('click', closeFn);
      document.getElementById('ia-cancel').addEventListener('click', closeFn);
      document.getElementById('ia-name').addEventListener('input', function (e) { state.name = e.target.value; });
      document.getElementById('ia-mode').addEventListener('change', function (e) { state.mode = e.target.value; });
      document.getElementById('ia-currency').addEventListener('change', function (e) { state.currency = e.target.value; render(); });
      document.getElementById('ia-init').addEventListener('input', function (e) { state.initialBalance = e.target.value; });
      document.getElementById('ia-goal').addEventListener('input', function (e) { state.goal = e.target.value; });
      var iaObsToggle = document.getElementById('ia-obs-toggle');
      if (iaObsToggle) iaObsToggle.addEventListener('change', function (e) {
        state.showObs = Boolean(e.target.checked);
        if (!state.showObs) state.notes = '';
        render();
        if (state.showObs) {
          var el = document.getElementById('ia-notes');
          if (el) el.focus();
        }
      });
      var iaNotesInp = document.getElementById('ia-notes');
      if (iaNotesInp) iaNotesInp.addEventListener('input', function (e) { state.notes = e.target.value; });

      document.getElementById('ia-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var trimmed = state.name.trim();
        if (!trimmed) return;
        opts.onSave({
          id: existing ? existing.id : 'inv-' + Date.now(),
          name: trimmed,
          mode: state.mode,
          currency: state.currency,
          initialBalance: window.AppFormat.parseDecimalInput(state.initialBalance),
          goal: window.AppFormat.parseDecimalInput(state.goal),
          notes: state.notes.trim(),
        });
        closeFn();
      });
    }

    render();
  }

  function openSubInvestmentModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;
    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var availableCash = Math.max(0, Number(opts.availableCash) || 0);

    root.innerHTML =
      '<div class="modal-backdrop">' +
        '<form id="sub-form" class="modal-box modal-flex">' +
          '<div class="modal-top-fixed">' +
            '<div class="modal-header" style="margin-bottom:0">' +
              '<div><h2 class="modal-title">Nueva Sub-inversión en ' + esc(opts.fundName) + '</h2><p class="modal-subtitle">Disponible en cuenta principal: <strong>' + esc(fmt.formatCurrency(availableCash, opts.currency)) + '</strong></p></div>' +
              '<button type="button" class="modal-close" id="sub-close"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
          '</div>' +
          '<div class="modal-body-scroll">' +
            '<div class="field-group"><label class="field-label">Nombre del activo / acción</label><input type="text" id="sub-name" class="input" placeholder="Ej. Microsoft (MSFT)" required /></div>' +
            '<div class="form-grid-2">' +
              '<div class="field-group" style="margin-bottom:0"><label class="field-label">Saldo inicial ya invertido (' + esc(opts.currency) + ')</label><input type="text" inputmode="decimal" id="sub-init" class="input" placeholder="0" /></div>' +
              '<div class="field-group" style="margin-bottom:0"><label class="field-label">Notas (opcional)</label><input type="text" id="sub-notes" class="input" placeholder="Ej. Largo plazo" /></div>' +
            '</div>' +
            '<div id="sub-err-banner" class="alert-banner alert-rose hidden" style="margin-top:0.75rem;margin-bottom:0"></div>' +
          '</div>' +
          '<div class="modal-bottom-fixed">' +
            '<button type="button" class="btn btn-secondary" id="sub-cancel">Cancelar</button>' +
            '<button type="submit" id="sub-submit" class="btn btn-primary">Crear sub-inversión</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    var closeFn = function () { root.innerHTML = ''; };
    document.getElementById('sub-close').addEventListener('click', closeFn);
    document.getElementById('sub-cancel').addEventListener('click', closeFn);

    var subInitInp = document.getElementById('sub-init');
    var subErrBanner = document.getElementById('sub-err-banner');
    var subSubmitBtn = document.getElementById('sub-submit');

    function validateSubInit() {
      var val = fmt.parseDecimalInput(subInitInp.value);
      if (val > availableCash) {
        subErrBanner.textContent = 'No puedes asignar un valor superior al disponible en la cuenta principal (' + fmt.formatCurrency(availableCash, opts.currency) + ').';
        subErrBanner.classList.remove('hidden');
        subSubmitBtn.disabled = true;
        return false;
      }
      subErrBanner.classList.add('hidden');
      subSubmitBtn.disabled = false;
      return true;
    }

    subInitInp.addEventListener('input', validateSubInit);
    document.getElementById('sub-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('sub-name').value.trim();
      if (!name || !validateSubInit()) return;
      opts.onSave({
        id: 'sub-' + Date.now(),
        fundName: opts.fundName,
        name: name,
        initialBalance: fmt.parseDecimalInput(subInitInp.value),
        notes: document.getElementById('sub-notes').value.trim(),
      });
      closeFn();
    });
  }

  function openUpdateValueModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;
    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var cur = opts.currency || 'COP';
    var currentBookValue = Number(opts.currentBookValue) || 0;
    var netContributed = Number(opts.netContributed) || 0;
    var targetLabel = opts.subName ? (opts.fundName + ' — ' + opts.subName) : opts.fundName;
    var valueStr = String(currentBookValue);

    function render() {
      var realVal = fmt.parseDecimalInput(valueStr);
      var diff = Math.round((realVal - currentBookValue) * 100) / 100;
      var totalGain = Math.round((realVal - netContributed) * 100) / 100;
      var totalPct = netContributed > 0 ? ((totalGain / netContributed) * 100).toFixed(2) : '0.00';

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<form id="uv-form" class="modal-box modal-flex">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header" style="margin-bottom:0">' +
                '<div><h2 class="modal-title">Actualizar Valor Actual</h2><p class="modal-subtitle">' + esc(targetLabel) + ' (' + esc(cur) + ')</p></div>' +
                '<button type="button" class="modal-close" id="uv-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
            '</div>' +
            '<div class="modal-body-scroll">' +
              '<div class="alert-banner alert-indigo">' +
                'Capital neto aportado: <strong>' + esc(fmt.formatCurrency(netContributed, cur)) + '</strong> &middot; Saldo actual en sistema: <strong>' + esc(fmt.formatCurrency(currentBookValue, cur)) + '</strong>' +
              '</div>' +
              '<div class="field-group">' +
                '<label class="field-label">¿Cuánto marca hoy tu fondo / banco? (' + esc(cur) + ')</label>' +
                '<input type="text" inputmode="decimal" id="uv-amount" class="input" value="' + esc(valueStr) + '" />' +
              '</div>' +
              '<div id="uv-preview" class="alert-banner ' + (totalGain >= 0 ? 'alert-emerald' : 'alert-rose') + '" style="margin-bottom:0">' +
                'Ajuste por rendimiento: <strong>' + (diff >= 0 ? '+' : '') + esc(fmt.formatCurrency(diff, cur)) + '</strong><br/>' +
                'Ganancia / Pérdida acumulada: <strong>' + (totalGain >= 0 ? '+' : '') + esc(fmt.formatCurrency(totalGain, cur)) + ' (' + totalPct + '%)</strong>' +
              '</div>' +
            '</div>' +
            '<div class="modal-bottom-fixed">' +
              '<button type="button" class="btn btn-secondary" id="uv-cancel">Cancelar</button>' +
              '<button type="submit" class="btn btn-primary" id="uv-submit" ' + (diff === 0 ? 'disabled' : '') + '>Guardar actualización</button>' +
            '</div>' +
          '</form>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('uv-close').addEventListener('click', closeFn);
      document.getElementById('uv-cancel').addEventListener('click', closeFn);

      var inp = document.getElementById('uv-amount');
      inp.addEventListener('input', function (e) {
        valueStr = e.target.value;
        var v = fmt.parseDecimalInput(valueStr);
        var d = Math.round((v - currentBookValue) * 100) / 100;
        var g = Math.round((v - netContributed) * 100) / 100;
        var p = netContributed > 0 ? ((g / netContributed) * 100).toFixed(2) : '0.00';
        var prev = document.getElementById('uv-preview');
        prev.className = 'alert-banner ' + (g >= 0 ? 'alert-emerald' : 'alert-rose');
        prev.innerHTML =
          'Ajuste por rendimiento: <strong>' + (d >= 0 ? '+' : '') + esc(fmt.formatCurrency(d, cur)) + '</strong><br/>' +
          'Ganancia / Pérdida acumulada: <strong>' + (g >= 0 ? '+' : '') + esc(fmt.formatCurrency(g, cur)) + ' (' + p + '%)</strong>';
        document.getElementById('uv-submit').disabled = (d === 0);
      });

      document.getElementById('uv-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var v = fmt.parseDecimalInput(valueStr);
        var d = Math.round((v - currentBookValue) * 100) / 100;
        if (d === 0) return;
        opts.onSave(d);
        closeFn();
      });
    }

    render();
  }

  function openInvestmentOpModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;
    var fmt = window.AppFormat;
    var inv = window.AppInvestments;

    var fundSummaries = opts.fundSummaries || [];
    var liquidAccounts = opts.liquidAccounts || [];
    var accountBalances = opts.accountBalances || {};
    var exchangeRates = opts.exchangeRates || {};

    var state = {
      type: opts.initialType || 'Aporte', // Aporte | Retiro | AsignarSub | LiberarSub | TraspasoInv
      date: fmt.getTodayISO(),
      fundName: opts.initialFund || '',
      subName: opts.initialSub || '',
      normalAccount: '',
      destFundName: '',
      amountStr: '',
      exchangeRateStr: '',
      equivStr: '',
      equivManual: false,
      commType: 'none', // none | percent | fixed
      commValueStr: '',
      commApply: 'moved', // moved | fund
      description: '',
      showObs: false,
      isCreatingSub: false,
      newSubName: '',
      newSubNotes: '',
    };

    function getSelectedFund() {
      return fundSummaries.find(function (f) { return f.account.name === state.fundName; }) || null;
    }

    function syncDefaultRate() {
      var f = getSelectedFund();
      var baseCur = fmt.getBaseCurrency();
      state.equivManual = false;
      state.equivStr = '';
      if (!f || f.currency === baseCur) {
        state.exchangeRateStr = '1';
      } else {
        state.exchangeRateStr = String(inv.getEffectiveRate(f.currency, exchangeRates));
      }
    }
    syncDefaultRate();

    function render(focusId, selStart, selEnd) {
      var prevScrollEl = root.querySelector('.modal-body-scroll');
      var prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
      var esc = window.escapeHTML;
      var f = getSelectedFund();
      var baseCur = fmt.getBaseCurrency();
      var cur = f ? f.currency : baseCur;
      var isForeign = cur !== baseCur;
      var refRate = isForeign ? (fmt.parseDecimalInput(state.exchangeRateStr) || inv.getEffectiveRate(cur, exchangeRates)) : 1;

      var amountVal = fmt.parseDecimalInput(state.amountStr);
      var commVal = fmt.parseDecimalInput(state.commValueStr);

      var equivVal = 0;
      var baseAmountInFundCur = amountVal;
      var commInFundCur = commVal;
      var split;
      var copAmountForNormal = 0;
      var rate = refRate;

      if (state.type === 'Aporte' && isForeign) {
        equivVal = state.equivManual
          ? fmt.parseDecimalInput(state.equivStr)
          : (amountVal > 0 && refRate > 0 ? Math.round((amountVal / refRate) * 100) / 100 : 0);
        baseAmountInFundCur = equivVal;
        rate = (amountVal > 0 && equivVal > 0) ? Math.round((amountVal / equivVal) * 100) / 100 : refRate;
        commInFundCur = state.commType === 'fixed' ? (rate > 0 ? commVal / rate : 0) : commVal;
        split = inv.computeCommissionSplit(baseAmountInFundCur, state.commType, commInFundCur, state.commApply);
        copAmountForNormal = amountVal;
      } else if (state.type === 'Retiro' && isForeign) {
        split = inv.computeCommissionSplit(baseAmountInFundCur, state.commType, commInFundCur, state.commApply);
        equivVal = state.equivManual
          ? fmt.parseDecimalInput(state.equivStr)
          : (split.netToDest > 0 ? Math.round(split.netToDest * refRate) : 0);
        copAmountForNormal = equivVal;
        rate = (split.netToDest > 0 && equivVal > 0) ? Math.round((equivVal / split.netToDest) * 100) / 100 : refRate;
      } else {
        split = inv.computeCommissionSplit(baseAmountInFundCur, state.commType, commInFundCur, state.commApply);
        copAmountForNormal = (state.type === 'Aporte') ? amountVal : (state.type === 'Retiro' ? split.netToDest : 0);
      }

      // Validaciones de saldo
      var insufficientMsg = '';
      if (state.type === 'Aporte' && state.normalAccount) {
        var bankBal = accountBalances[state.normalAccount] || 0;
        if (bankBal <= 0 || amountVal > bankBal) {
          insufficientMsg = 'Saldo insuficiente en ' + state.normalAccount + '. Disponible: ' + fmt.formatCOP(Math.max(0, bankBal));
        } else if (split.fundExtraFee > 0 && f && split.fundExtraFee > f.availableCash) {
          insufficientMsg = 'No hay saldo libre suficiente en ' + f.account.name + ' para cubrir la comisión (' + fmt.formatCurrency(split.fundExtraFee, cur) + ').';
        }
      } else if (state.type === 'Retiro' && f) {
        var neededFromFund = split.applyTo === 'fund' ? (split.grossAmount + split.commission) : split.grossAmount;
        if (f.availableCash <= 0 || neededFromFund > f.availableCash) {
          insufficientMsg = 'Saldo disponible insuficiente en ' + f.account.name + '. Disponible: ' + fmt.formatCurrency(Math.max(0, f.availableCash), cur);
        }
      } else if (state.type === 'AsignarSub' && f) {
        var neededAssign = split.applyTo === 'fund' ? (split.grossAmount + split.commission) : split.grossAmount;
        if (f.availableCash <= 0 || neededAssign > f.availableCash) {
          insufficientMsg = 'Disponible por invertir insuficiente en ' + f.account.name + '. Disponible: ' + fmt.formatCurrency(Math.max(0, f.availableCash), cur);
        }
      } else if (state.type === 'LiberarSub' && f && state.subName) {
        var subObj = f.subSummaries.find(function (s) { return s.sub.name === state.subName; });
        var subBal = subObj ? subObj.currentValue : 0;
        if (subBal <= 0 || amountVal > subBal) {
          insufficientMsg = 'Saldo insuficiente en ' + state.subName + '. Disponible: ' + fmt.formatCurrency(Math.max(0, subBal), cur);
        }
      } else if (state.type === 'TraspasoInv' && f) {
        var neededTr = split.applyTo === 'fund' ? (split.grossAmount + split.commission) : split.grossAmount;
        if (f.availableCash <= 0 || neededTr > f.availableCash) {
          insufficientMsg = 'Saldo disponible insuficiente en ' + f.account.name + '.';
        }
      }

      var fundListForType = (state.type === 'AsignarSub' || state.type === 'LiberarSub')
        ? fundSummaries.filter(function (x) { return x.mode === 'fragmentado'; })
        : fundSummaries;

      var fundOpts = '<option value="">Selecciona fondo...</option>' + fundListForType.map(function (x) {
        return '<option value="' + esc(x.account.name) + '" ' + (state.fundName === x.account.name ? 'selected' : '') + '>' + esc(x.account.name) + ' (' + esc(x.currency) + ')</option>';
      }).join('');

      var normalOpts = '<option value="">Selecciona cuenta...</option>' + liquidAccounts.map(function (a) {
        return '<option value="' + esc(a.name) + '" ' + (state.normalAccount === a.name ? 'selected' : '') + '>' + esc(a.name) + '</option>';
      }).join('');

      var subOpts = f
        ? '<option value="">Selecciona sub-inversión...</option>' + f.subSummaries.map(function (s) {
            return '<option value="' + esc(s.sub.name) + '" ' + (state.subName === s.sub.name ? 'selected' : '') + '>' + esc(s.sub.name) + '</option>';
          }).join('')
        : '<option value="">Selecciona fondo primero...</option>';

      var destFundOpts = '<option value="">Selecciona fondo destino...</option>' + fundSummaries.filter(function (x) { return x.account.name !== state.fundName; }).map(function (x) {
        return '<option value="' + esc(x.account.name) + '" ' + (state.destFundName === x.account.name ? 'selected' : '') + '>' + esc(x.account.name) + ' (' + esc(x.currency) + ')</option>';
      }).join('');

      var accountFields = '';
      if (state.type === 'Aporte') {
        accountFields =
          '<div class="form-grid-2">' +
            '<div class="field-group"><label class="field-label">Sale de cuenta normal (' + esc(baseCur) + ')</label><select id="io-normal" class="select">' + normalOpts + '</select></div>' +
            '<div class="field-group"><label class="field-label">Entra al fondo</label><select id="io-fund" class="select">' + fundOpts + '</select></div>' +
          '</div>';
      } else if (state.type === 'Retiro') {
        accountFields =
          '<div class="form-grid-2">' +
            '<div class="field-group"><label class="field-label">Sale del fondo</label><select id="io-fund" class="select">' + fundOpts + '</select></div>' +
            '<div class="field-group"><label class="field-label">Ingresa a cuenta normal (' + esc(baseCur) + ')</label><select id="io-normal" class="select">' + normalOpts + '</select></div>' +
          '</div>';
      } else if (state.type === 'AsignarSub' || state.type === 'LiberarSub') {
        var canCreateSub = Boolean(f && state.type === 'AsignarSub');
        var subFieldContent = state.isCreatingSub && canCreateSub
          ? '<div class="config-box" style="margin:0;padding:0.65rem">' +
              '<div class="field-group" style="margin-bottom:0.5rem">' +
                '<input type="text" id="io-new-sub-name" class="input" placeholder="Nombre de la subcuenta (ej. Microsoft)" value="' + esc(state.newSubName) + '" />' +
              '</div>' +
              '<div style="display:flex;gap:0.45rem;align-items:center">' +
                '<input type="text" id="io-new-sub-notes" class="input" placeholder="Notas (opcional)" value="' + esc(state.newSubNotes) + '" style="flex:1" />' +
                '<button type="button" id="io-save-new-sub" class="btn btn-primary" style="padding:0.45rem 0.75rem;font-size:0.8rem">Crear</button>' +
              '</div>' +
            '</div>'
          : '<select id="io-sub" class="select">' + subOpts + '</select>';

        var selectedSubObj = (f && state.subName)
          ? f.subSummaries.find(function (s) { return s.sub.name === state.subName; })
          : null;
        var subStatsHtml = (selectedSubObj && !state.isCreatingSub)
          ? (function () {
              var sGain = selectedSubObj.gainLoss || 0;
              var sPos = sGain >= 0;
              var sPct = (sGain >= 0 ? '+' : '') + (selectedSubObj.gainLossPct || 0).toFixed(1) + '%';
              return (
                '<p style="margin:0.35rem 0 0;font-size:0.78rem;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:0.35rem 0.65rem">' +
                  '<span>Invertido: <strong class="tabular" style="color:var(--text-strong)">' + esc(fmt.formatCurrency(selectedSubObj.netInvested, cur)) + '</strong></span>' +
                  '<span>Ganancia: <strong class="tabular ' + (sPos ? 'text-emerald' : 'text-rose') + '">' + (sPos ? '+' : '') + esc(fmt.formatCurrency(sGain, cur)) + '</strong></span>' +
                  '<span>Rend: <strong class="tabular ' + (sPos ? 'text-emerald' : 'text-rose') + '">' + esc(sPct) + '</strong></span>' +
                '</p>'
              );
            })()
          : '';

        accountFields =
          '<div class="form-grid-2">' +
            '<div class="field-group"><label class="field-label">Cartera Libre</label><select id="io-fund" class="select">' + fundOpts + '</select></div>' +
            '<div class="field-group">' +
              '<div class="field-label-row">' +
                '<label class="field-label" style="margin:0">Sub-inversión</label>' +
                (canCreateSub
                  ? '<button type="button" class="link-btn" id="io-toggle-new-sub">' + (state.isCreatingSub ? 'Cancelar' : '+ Agregar subcuenta') + '</button>'
                  : '') +
              '</div>' +
              subFieldContent +
              subStatsHtml +
            '</div>' +
          '</div>' +
          (state.type === 'AsignarSub' && f
            ? '<p style="margin:-0.35rem 0 0.75rem;font-size:0.8rem;color:var(--text-muted)">Disponible en cuenta principal: <strong class="text-sky tabular">' + esc(fmt.formatCurrency(Math.max(0, f.availableCash), cur)) + '</strong></p>'
            : '');
      } else {
        accountFields =
          '<div class="form-grid-2">' +
            '<div class="field-group"><label class="field-label">Inversión origen</label><select id="io-fund" class="select">' + fundOpts + '</select></div>' +
            '<div class="field-group"><label class="field-label">Inversión destino</label><select id="io-dest-fund" class="select">' + destFundOpts + '</select></div>' +
          '</div>';
      }

      var amountLabel = state.type === 'Aporte' ? ('Monto que envías (' + baseCur + ')') : ('Monto (' + cur + ')');
      var previewHtml = '';
      if (amountVal > 0 && f) {
        if (state.type === 'Aporte') {
          previewHtml =
            '<div class="alert-banner alert-indigo">' +
              'Salen <strong>' + esc(fmt.formatCOP(amountVal)) + '</strong> de tu cuenta normal &rarr; ' +
              'Entran <strong>' + esc(fmt.formatCurrency(split.netToDest, cur)) + '</strong> al fondo' +
              (split.commission > 0 ? ' (Comisión: <strong>' + esc(fmt.formatCurrency(split.commission, cur)) + '</strong> ' + (split.applyTo === 'fund' ? 'descontada de tu saldo previo en el fondo' : 'descontada del envío') + ')' : '') +
            '</div>';
        } else if (state.type === 'Retiro') {
          previewHtml =
            '<div class="alert-banner alert-indigo">' +
              'Salen <strong>' + esc(fmt.formatCurrency(split.applyTo === 'fund' ? split.grossAmount + split.commission : split.grossAmount, cur)) + '</strong> del fondo &rarr; ' +
              'Ingresan <strong>' + esc(fmt.formatCOP(copAmountForNormal)) + '</strong> a tu cuenta normal' +
              (split.commission > 0 ? ' (Comisión: <strong>' + esc(fmt.formatCurrency(split.commission, cur)) + '</strong>)' : '') +
            '</div>';
        }
      }

      var missing =
        amountVal <= 0 ||
        !state.fundName ||
        ((state.type === 'Aporte' || state.type === 'Retiro') && !state.normalAccount) ||
        (isForeign && (state.type === 'Aporte' || state.type === 'Retiro') && equivVal <= 0) ||
        ((state.type === 'AsignarSub' || state.type === 'LiberarSub') && !state.subName) ||
        (state.type === 'TraspasoInv' && !state.destFundName);

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<form id="io-form" class="modal-box modal-flex">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header" style="margin-bottom:0">' +
                '<h2 class="modal-title">Operación de Inversión</h2>' +
                '<button type="button" class="modal-close" id="io-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
            '</div>' +
            '<div class="modal-body-scroll">' +
              '<div class="field-group">' +
                '<label class="field-label">Tipo de operación</label>' +
                '<select id="io-type" class="select">' +
                  '<option value="Aporte" ' + (state.type === 'Aporte' ? 'selected' : '') + '>Aportar (Cuenta normal &rarr; Inversión)</option>' +
                  '<option value="Retiro" ' + (state.type === 'Retiro' ? 'selected' : '') + '>Retirar (Inversión &rarr; Cuenta normal)</option>' +
                  '<option value="AsignarSub" ' + (state.type === 'AsignarSub' ? 'selected' : '') + '>Invertir en Sub-activo (Disponible &rarr; Acción)</option>' +
                  '<option value="LiberarSub" ' + (state.type === 'LiberarSub' ? 'selected' : '') + '>Vender / Liberar Sub-activo (Acción &rarr; Disponible)</option>' +
                  '<option value="TraspasoInv" ' + (state.type === 'TraspasoInv' ? 'selected' : '') + '>Traspaso entre inversiones</option>' +
                '</select>' +
              '</div>' +
              accountFields +
              '<div class="form-grid-2">' +
                '<div class="field-group"><label class="field-label">Fecha</label><div id="io-datepicker"></div></div>' +
                '<div class="field-group"><label class="field-label">' + esc(amountLabel) + '</label><input type="text" inputmode="decimal" id="io-amount" class="input" placeholder="Ej. 100000" value="' + esc(state.amountStr) + '" /></div>' +
              '</div>' +
              (isForeign && (state.type === 'Aporte' || state.type === 'Retiro')
                ? '<div class="field-group">' +
                    '<label class="field-label">' +
                      (state.type === 'Aporte'
                        ? '¿A cuánto equivale en ' + esc(cur) + ' (entra al fondo)?'
                        : '¿A cuánto equivale en ' + esc(baseCur) + ' (ingresa a tu cuenta normal)?') +
                    '</label>' +
                    '<input type="text" inputmode="decimal" id="io-equiv" class="input" placeholder="Ej. ' + (state.type === 'Aporte' ? '25.50' : '100000') + '" value="' + esc(state.equivManual ? state.equivStr : (equivVal > 0 ? String(equivVal) : '')) + '" />' +
                    '<p style="margin:0.3rem 0 0;font-size:0.78rem;color:#34d399">' +
                      (amountVal > 0 && equivVal > 0
                        ? 'Tasa implícita: 1 ' + esc(cur) + ' ≈ ' + esc(fmt.formatCOP(rate))
                        : 'Tasa de referencia: 1 ' + esc(cur) + ' ≈ ' + esc(fmt.formatCOP(refRate))) +
                    '</p>' +
                  '</div>'
                : '') +
              '<div class="config-box">' +
                '<p class="field-label" style="margin-bottom:0.45rem">Comisión (opcional)</p>' +
                '<div class="form-grid-2" style="margin-bottom:0.5rem">' +
                  '<select id="io-comm-type" class="select">' +
                    '<option value="none" ' + (state.commType === 'none' ? 'selected' : '') + '>Sin comisión</option>' +
                    '<option value="percent" ' + (state.commType === 'percent' ? 'selected' : '') + '>Porcentaje (%)</option>' +
                    '<option value="fixed" ' + (state.commType === 'fixed' ? 'selected' : '') + '>Valor fijo (' + (state.type === 'Aporte' ? esc(baseCur) : esc(cur)) + ')</option>' +
                  '</select>' +
                  (state.commType !== 'none'
                    ? '<input type="text" inputmode="decimal" id="io-comm-val" class="input" placeholder="' + (state.commType === 'percent' ? 'Ej. 4' : 'Ej. 4000') + '" value="' + esc(state.commValueStr) + '" />'
                    : '') +
                '</div>' +
                (state.commType !== 'none'
                  ? '<select id="io-comm-apply" class="select">' +
                      '<option value="moved" ' + (state.commApply === 'moved' ? 'selected' : '') + '>Descontar de lo que se mueve (ej. 100 &rarr; 96 netos)</option>' +
                      '<option value="fund" ' + (state.commApply === 'fund' ? 'selected' : '') + '>Descontar de lo que tengo en el fondo (100 exactos)</option>' +
                    '</select>'
                  : '') +
              '</div>' +
              '<div class="field-group" style="margin-bottom:0">' +
                '<label class="obs-toggle-row">' +
                  '<span class="obs-toggle-label">Agregar observaciones</span>' +
                  '<span class="obs-switch ' + (state.showObs ? 'is-on' : '') + '"><input type="checkbox" id="io-obs-toggle" ' + (state.showObs ? 'checked' : '') + ' /><span class="obs-switch-thumb"></span></span>' +
                '</label>' +
                (state.showObs
                  ? '<input type="text" id="io-desc" class="input" style="margin-top:0.5rem" placeholder="Ej. Compra MSFT, retiro ganancias..." value="' + esc(state.description) + '" />'
                  : '') +
              '</div>' +
              previewHtml +
              (insufficientMsg ? '<div class="alert-banner alert-rose" style="margin-top:0.75rem;margin-bottom:0">' + esc(insufficientMsg) + '</div>' : '') +
            '</div>' +
            '<div class="modal-bottom-fixed">' +
              '<button type="button" class="btn btn-secondary" id="io-cancel">Cancelar</button>' +
              '<button type="submit" class="btn btn-primary" ' + (missing || insufficientMsg ? 'disabled' : '') + '>Guardar operación</button>' +
            '</div>' +
          '</form>' +
        '</div>';

      var dpEl = document.getElementById('io-datepicker');
      if (dpEl) window.createDatePicker(dpEl, state.date, function (d) { state.date = d; });

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('io-close').addEventListener('click', closeFn);
      document.getElementById('io-cancel').addEventListener('click', closeFn);
      document.getElementById('io-type').addEventListener('change', function (e) {
        state.type = e.target.value;
        state.subName = '';
        state.equivManual = false;
        state.equivStr = '';
        render();
      });

      var fundSel = document.getElementById('io-fund');
      if (fundSel) fundSel.addEventListener('change', function (e) { state.fundName = e.target.value; state.subName = ''; syncDefaultRate(); render(); });
      var normSel = document.getElementById('io-normal');
      if (normSel) normSel.addEventListener('change', function (e) { state.normalAccount = e.target.value; render(); });
      var subSel = document.getElementById('io-sub');
      if (subSel) subSel.addEventListener('change', function (e) { state.subName = e.target.value; render(); });
      var toggleNewSubBtn = document.getElementById('io-toggle-new-sub');
      if (toggleNewSubBtn) toggleNewSubBtn.addEventListener('click', function () {
        state.isCreatingSub = !state.isCreatingSub;
        state.newSubName = '';
        state.newSubNotes = '';
        render();
      });
      var newSubNameInp = document.getElementById('io-new-sub-name');
      if (newSubNameInp) newSubNameInp.addEventListener('input', function (e) { state.newSubName = e.target.value; });
      var newSubNotesInp = document.getElementById('io-new-sub-notes');
      if (newSubNotesInp) newSubNotesInp.addEventListener('input', function (e) { state.newSubNotes = e.target.value; });
      var saveNewSubBtn = document.getElementById('io-save-new-sub');
      if (saveNewSubBtn) saveNewSubBtn.addEventListener('click', function () {
        var name = state.newSubName.trim();
        if (!name || !f) return;
        var newSub = {
          id: 'sub-' + Date.now(),
          fundName: f.account.name,
          name: name,
          initialBalance: 0,
          notes: state.newSubNotes.trim(),
        };
        if (typeof opts.onCreateSub === 'function') {
          opts.onCreateSub(newSub);
        }
        var alreadyInList = f.subSummaries.some(function (s) {
          return s.sub.name.toLowerCase() === name.toLowerCase();
        });
        if (!alreadyInList) {
          f.subSummaries.push({
            sub: newSub,
            currentValue: 0,
            netInvested: 0,
            gainLoss: 0,
            gainLossPct: 0,
            currentValueCOP: 0,
          });
        }
        state.subName = name;
        state.isCreatingSub = false;
        state.newSubName = '';
        state.newSubNotes = '';
        render();
      });
      var destSel = document.getElementById('io-dest-fund');
      if (destSel) destSel.addEventListener('change', function (e) { state.destFundName = e.target.value; render(); });

      document.getElementById('io-amount').addEventListener('input', function (e) {
        state.amountStr = e.target.value;
        render('io-amount', e.target.selectionStart, e.target.selectionEnd);
      });
      var equivInp = document.getElementById('io-equiv');
      if (equivInp) equivInp.addEventListener('input', function (e) {
        state.equivManual = true;
        state.equivStr = e.target.value;
        render('io-equiv', e.target.selectionStart, e.target.selectionEnd);
      });
      document.getElementById('io-comm-type').addEventListener('change', function (e) { state.commType = e.target.value; render(); });
      var commValInp = document.getElementById('io-comm-val');
      if (commValInp) commValInp.addEventListener('input', function (e) {
        state.commValueStr = e.target.value;
        render('io-comm-val', e.target.selectionStart, e.target.selectionEnd);
      });
      var commAppSel = document.getElementById('io-comm-apply');
      if (commAppSel) commAppSel.addEventListener('change', function (e) { state.commApply = e.target.value; render(); });
      var ioObsToggle = document.getElementById('io-obs-toggle');
      if (ioObsToggle) ioObsToggle.addEventListener('change', function (e) {
        state.showObs = Boolean(e.target.checked);
        if (!state.showObs) state.description = '';
        render();
        if (state.showObs) {
          var el = document.getElementById('io-desc');
          if (el) el.focus();
        }
      });
      var ioDescInp = document.getElementById('io-desc');
      if (ioDescInp) ioDescInp.addEventListener('input', function (e) { state.description = e.target.value; });

      document.getElementById('io-form').addEventListener('submit', function (e) {
        e.preventDefault();
        if (missing || insufficientMsg) return;
        opts.onSave({
          date: state.date,
          type: state.type,
          fundName: state.fundName,
          subName: state.subName,
          normalAccount: state.type === 'TraspasoInv' ? state.destFundName : state.normalAccount,
          description: state.description.trim() || state.type,
          amount: Math.round(baseAmountInFundCur * 100) / 100,
          commission: split.commission,
          commissionApply: split.applyTo,
          exchangeRate: rate,
          amountCOP: state.type === 'Aporte' ? amountVal : (state.type === 'Retiro' ? copAmountForNormal : Math.round(baseAmountInFundCur * rate)),
        });
        closeFn();
      });

      var nextScrollEl = root.querySelector('.modal-body-scroll');
      if (nextScrollEl && prevScrollTop > 0) nextScrollEl.scrollTop = prevScrollTop;

      if (focusId) {
        var el = document.getElementById(focusId);
        if (el) {
          el.focus();
          if (typeof selStart === 'number' && el.setSelectionRange) {
            try { el.setSelectionRange(selStart, selEnd); } catch (err) {}
          }
        }
      }
    }

    render();
  }

  window.InvestmentModals = {
    openAccountModal: openInvestmentAccountModal,
    openSubModal: openSubInvestmentModal,
    openUpdateValueModal: openUpdateValueModal,
    openOpModal: openInvestmentOpModal,
  };
})();

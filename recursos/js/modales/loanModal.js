(function () {
  function openLoanModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var liquidAccounts = opts.liquidAccounts || [];
    var balances = opts.accountBalances || {};

    var state = {
      isHistorical: false,
      initialPaidStr: '',
      borrower: '',
      fromAccount: liquidAccounts[0] || '',
      principalStr: '',
      interestMode: 'none', // 'none' | 'total' | 'monthly'
      interestRateStr: '',
      frequency: 'mensual', // 'unico' | 'semanal' | 'quincenal' | 'mensual'
      installmentsStr: '1',
      startDate: fmt.getTodayISO(),
      notes: '',
    };

    function calcTotals() {
      var principal = fmt.parseDecimalInput(state.principalStr);
      var rate = fmt.parseDecimalInput(state.interestRateStr);
      var installments = state.frequency === 'unico' ? 1 : Math.max(1, Math.floor(Number(state.installmentsStr) || 1));
      var totalInterest = 0;
      if (state.interestMode === 'total' && rate > 0) {
        totalInterest = principal * (rate / 100);
      } else if (state.interestMode === 'monthly' && rate > 0) {
        var monthsApprox = state.frequency === 'semanal'
          ? (installments * 7) / 30
          : (state.frequency === 'quincenal' ? (installments * 15) / 30 : installments);
        totalInterest = principal * (rate / 100) * Math.max(1, monthsApprox);
      }
      var totalDue = Math.round((principal + totalInterest) * 100) / 100;
      var quota = installments > 0 ? Math.round((totalDue / installments) * 100) / 100 : totalDue;
      return {
        principal: principal,
        rate: rate,
        installments: installments,
        totalInterest: Math.round(totalInterest * 100) / 100,
        totalDue: totalDue,
        quota: quota,
      };
    }

    function render() {
      var prevScrollEl = root.querySelector('.modal-body-scroll');
      var prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
      var calc = calcTotals();
      var avail = state.fromAccount ? (balances[state.fromAccount] || 0) : 0;
      var hasInsufficient = !state.isHistorical && Boolean(state.fromAccount) && calc.principal > avail;
      var canSave = Boolean(state.borrower.trim()) && (state.isHistorical || Boolean(state.fromAccount)) && calc.principal > 0 && !hasInsufficient;

      var accOpts = '<option value="">Selecciona cuenta...</option>' + liquidAccounts.map(function (a) {
        return '<option value="' + esc(a) + '"' + (state.fromAccount === a ? ' selected' : '') + '>' + esc(a) + ' (' + esc(fmt.formatCOP(balances[a] || 0)) + ')</option>';
      }).join('');

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box modal-flex" style="max-width:520px">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header" style="margin-bottom:0">' +
                '<div style="display:flex;align-items:center;gap:0.65rem">' +
                  '<div class="brand-icon" style="background:rgba(16,185,129,0.15);color:#34d399"><i class="fa-solid fa-hand-holding-dollar"></i></div>' +
                  '<div><h2 class="modal-title">Nuevo Préstamo</h2><p class="modal-subtitle">Descuenta de tu cuenta como Egreso y controla los cobros</p></div>' +
                '</div>' +
                '<button type="button" class="modal-close" id="lm-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
            '</div>' +
            '<div class="modal-body-scroll">' +
              '<label class="config-item" style="cursor:pointer;margin-bottom:0.85rem;gap:0.65rem;justify-content:flex-start">' +
                '<input type="checkbox" id="lm-historical" ' + (state.isHistorical ? 'checked' : '') + ' style="width:1.05rem;height:1.05rem" />' +
                '<div>' +
                  '<strong style="font-size:0.86rem;color:var(--text-strong)">Préstamo anterior a esta web</strong>' +
                  '<p style="margin:0.1rem 0 0;font-size:0.76rem;color:var(--text-muted)">No descuenta saldo de tus cuentas actuales (ideal para préstamos ya entregados antes).</p>' +
                '</div>' +
              '</label>' +
              '<div class="form-grid-2">' +
                '<div class="field-group"><label class="field-label">Persona / Deudor</label><input type="text" id="lm-borrower" class="input" placeholder="Ej. Juan Pérez" value="' + esc(state.borrower) + '" /></div>' +
                '<div class="field-group"><label class="field-label">Fecha del préstamo</label><div id="lm-datepicker"></div></div>' +
              '</div>' +
              '<div class="form-grid-2">' +
                (state.isHistorical
                  ? '<div class="field-group"><label class="field-label">Ya me han abonado antes (' + esc(fmt.getBaseCurrency()) + ')</label><input type="text" inputmode="decimal" id="lm-init-paid" class="input" placeholder="0" value="' + esc(state.initialPaidStr) + '" /></div>'
                  : '<div class="field-group"><label class="field-label">Sale de la cuenta</label><select id="lm-from" class="select">' + accOpts + '</select></div>') +
                '<div class="field-group"><label class="field-label">Capital prestado (' + esc(fmt.getBaseCurrency()) + ')</label><input type="text" inputmode="decimal" id="lm-principal" class="input" placeholder="Ej. 300000" value="' + esc(state.principalStr) + '" /></div>' +
              '</div>' +
              '<div class="config-box" style="margin-bottom:0.85rem">' +
                '<div class="form-grid-2" style="margin-bottom:' + (state.interestMode === 'none' ? '0' : '0.6rem') + '">' +
                  '<div>' +
                    '<label class="field-label">Interés</label>' +
                    '<select id="lm-int-mode" class="select">' +
                      '<option value="none"' + (state.interestMode === 'none' ? ' selected' : '') + '>Sin interés (0%)</option>' +
                      '<option value="total"' + (state.interestMode === 'total' ? ' selected' : '') + '>% sobre el total</option>' +
                      '<option value="monthly"' + (state.interestMode === 'monthly' ? ' selected' : '') + '>% mensual</option>' +
                    '</select>' +
                  '</div>' +
                  (state.interestMode !== 'none'
                    ? '<div><label class="field-label">Tasa (%)</label><input type="text" inputmode="decimal" id="lm-int-rate" class="input" placeholder="Ej. 10" value="' + esc(state.interestRateStr) + '" /></div>'
                    : '<div></div>') +
                '</div>' +
              '</div>' +
              '<div class="form-grid-2">' +
                '<div class="field-group">' +
                  '<label class="field-label">Frecuencia de cobro</label>' +
                  '<select id="lm-freq" class="select">' +
                    '<option value="unico"' + (state.frequency === 'unico' ? ' selected' : '') + '>Pago único (1 mes)</option>' +
                    '<option value="semanal"' + (state.frequency === 'semanal' ? ' selected' : '') + '>Semanal</option>' +
                    '<option value="quincenal"' + (state.frequency === 'quincenal' ? ' selected' : '') + '>Quincenal</option>' +
                    '<option value="mensual"' + (state.frequency === 'mensual' ? ' selected' : '') + '>Mensual</option>' +
                  '</select>' +
                '</div>' +
                '<div class="field-group">' +
                  '<label class="field-label">Número de cuotas</label>' +
                  '<input type="number" min="1" max="120" id="lm-installments" class="input" value="' + (state.frequency === 'unico' ? '1' : esc(state.installmentsStr)) + '" ' + (state.frequency === 'unico' ? 'disabled' : '') + ' />' +
                '</div>' +
              '</div>' +
              '<div class="field-group">' +
                '<label class="field-label">Notas (opcional)</label>' +
                '<input type="text" id="lm-notes" class="input" placeholder="Ej. Préstamo a 1 mes..." value="' + esc(state.notes) + '" />' +
              '</div>' +
              '<div id="lm-summary-box" class="config-box" style="margin-bottom:0">' +
                '<p style="margin:0;font-size:0.82rem;color:var(--text-muted)">Total a cobrar: <strong id="lm-total-due" style="color:var(--emerald)">' + esc(fmt.formatCOP(calc.totalDue)) + '</strong>' +
                  (calc.totalInterest > 0 ? ' (interés: ' + esc(fmt.formatCOP(calc.totalInterest)) + ')' : '') +
                '</p>' +
                '<p style="margin:0.25rem 0 0;font-size:0.8rem;color:var(--text-muted)">Cuota estimada: <strong id="lm-quota-val" style="color:var(--text-strong)">' + esc(fmt.formatCOP(calc.quota)) + '</strong> &times; <span id="lm-quota-cnt">' + calc.installments + '</span> cuota(s)</p>' +
              '</div>' +
              (hasInsufficient
                ? '<div id="lm-insuf-banner" class="alert-banner alert-rose" style="margin-top:0.75rem;margin-bottom:0">Saldo insuficiente en <strong>' + esc(state.fromAccount) + '</strong>. Disponible: <strong>' + esc(fmt.formatCOP(avail)) + '</strong>.</div>'
                : '') +
            '</div>' +
            '<div class="modal-bottom-fixed">' +
              '<button type="button" class="btn btn-secondary" id="lm-cancel">Cancelar</button>' +
              '<button type="button" class="btn btn-primary" id="lm-save" ' + (!canSave ? 'disabled' : '') + '>Guardar préstamo</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('lm-close').addEventListener('click', closeFn);
      document.getElementById('lm-cancel').addEventListener('click', closeFn);

      var dpEl = document.getElementById('lm-datepicker');
      if (dpEl) {
        window.createDatePicker(dpEl, state.startDate, function (nextDate) { state.startDate = nextDate; });
      }

      function updatePreview() {
        var c = calcTotals();
        var av = state.fromAccount ? (balances[state.fromAccount] || 0) : 0;
        var ins = !state.isHistorical && Boolean(state.fromAccount) && c.principal > av;
        var ok = Boolean(state.borrower.trim()) && (state.isHistorical || Boolean(state.fromAccount)) && c.principal > 0 && !ins;
        var totEl = document.getElementById('lm-total-due');
        if (totEl) totEl.textContent = fmt.formatCOP(c.totalDue);
        var qEl = document.getElementById('lm-quota-val');
        if (qEl) qEl.textContent = fmt.formatCOP(c.quota);
        var cntEl = document.getElementById('lm-quota-cnt');
        if (cntEl) cntEl.textContent = String(c.installments);
        var saveBtn = document.getElementById('lm-save');
        if (saveBtn) saveBtn.disabled = !ok;
      }

      document.getElementById('lm-historical').addEventListener('change', function (e) {
        state.isHistorical = e.target.checked;
        render();
      });
      document.getElementById('lm-borrower').addEventListener('input', function (e) { state.borrower = e.target.value; updatePreview(); });
      var fromSel = document.getElementById('lm-from');
      if (fromSel) fromSel.addEventListener('change', function (e) { state.fromAccount = e.target.value; render(); });
      var initPaidInp = document.getElementById('lm-init-paid');
      if (initPaidInp) initPaidInp.addEventListener('input', function (e) { state.initialPaidStr = e.target.value; });
      document.getElementById('lm-principal').addEventListener('input', function (e) { state.principalStr = e.target.value; updatePreview(); });
      document.getElementById('lm-int-mode').addEventListener('change', function (e) { state.interestMode = e.target.value; render(); });
      var rateInp = document.getElementById('lm-int-rate');
      if (rateInp) rateInp.addEventListener('input', function (e) { state.interestRateStr = e.target.value; updatePreview(); });
      document.getElementById('lm-freq').addEventListener('change', function (e) {
        state.frequency = e.target.value;
        if (state.frequency === 'unico') state.installmentsStr = '1';
        render();
      });
      document.getElementById('lm-installments').addEventListener('input', function (e) { state.installmentsStr = e.target.value; updatePreview(); });
      document.getElementById('lm-notes').addEventListener('input', function (e) { state.notes = e.target.value; });

      document.getElementById('lm-save').addEventListener('click', function () {
        var c = calcTotals();
        closeFn();
        opts.onSave({
          isHistorical: state.isHistorical,
          initialPaid: state.isHistorical ? fmt.parseDecimalInput(state.initialPaidStr) : 0,
          borrower: state.borrower.trim(),
          fromAccount: state.isHistorical ? '' : state.fromAccount,
          principal: c.principal,
          interestRate: c.rate,
          interestMode: state.interestMode,
          totalDue: c.totalDue,
          installments: c.installments,
          frequency: state.frequency,
          startDate: state.startDate,
          notes: state.notes.trim(),
        });
      });

      var nextScrollEl = root.querySelector('.modal-body-scroll');
      if (nextScrollEl) nextScrollEl.scrollTop = prevScrollTop;
    }

    render();
  }

  function openLoanPaymentModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var loan = opts.loan;
    var liquidAccounts = opts.liquidAccounts || [];
    var suggested = opts.suggestedAmount > 0 ? opts.suggestedAmount : opts.remainingTotal;

    var state = {
      date: fmt.getTodayISO(),
      toAccount: liquidAccounts[0] || '',
      amountStr: suggested > 0 ? String(suggested) : '',
      notes: '',
    };

    function render() {
      var amt = fmt.parseDecimalInput(state.amountStr);
      var canSave = Boolean(state.toAccount) && amt > 0;
      var accOpts = '<option value="">Selecciona cuenta...</option>' + liquidAccounts.map(function (a) {
        return '<option value="' + esc(a) + '"' + (state.toAccount === a ? ' selected' : '') + '>' + esc(a) + '</option>';
      }).join('');

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box" style="max-width:440px">' +
            '<div class="modal-header">' +
              '<div><h2 class="modal-title">Registrar Cobro</h2><p class="modal-subtitle">Préstamo a ' + esc(loan.borrower) + '</p></div>' +
              '<button type="button" class="modal-close" id="lpm-close"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="config-box" style="margin-bottom:0.85rem">' +
              '<p style="margin:0;font-size:0.82rem;color:var(--text-muted)">Saldo pendiente total: <strong style="color:var(--amber)">' + esc(fmt.formatCOP(opts.remainingTotal)) + '</strong></p>' +
              '<p style="margin:0.2rem 0 0;font-size:0.8rem;color:var(--text-muted)">Cuota sugerida actual: <strong style="color:var(--text-strong)">' + esc(fmt.formatCOP(suggested)) + '</strong></p>' +
            '</div>' +
            '<div class="field-group"><label class="field-label">Fecha de cobro</label><div id="lpm-datepicker"></div></div>' +
            '<div class="field-group"><label class="field-label">Entra a la cuenta</label><select id="lpm-to" class="select">' + accOpts + '</select></div>' +
            '<div class="field-group">' +
              '<label class="field-label">Monto recibido (' + esc(fmt.getBaseCurrency()) + ')</label>' +
              '<input type="text" inputmode="decimal" id="lpm-amt" class="input" value="' + esc(state.amountStr) + '" />' +
              '<p style="margin:0.25rem 0 0;font-size:0.76rem;color:var(--text-muted)">Puedes ingresar el total o un abono parcial.</p>' +
            '</div>' +
            '<div class="field-group"><label class="field-label">Notas (opcional)</label><input type="text" id="lpm-notes" class="input" placeholder="Ej. Abono cuota 1" value="' + esc(state.notes) + '" /></div>' +
            '<div class="modal-footer">' +
              '<button type="button" class="btn btn-secondary" id="lpm-cancel">Cancelar</button>' +
              '<button type="button" class="btn btn-emerald" id="lpm-save" ' + (!canSave ? 'disabled' : '') + '>Registrar Ingreso</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('lpm-close').addEventListener('click', closeFn);
      document.getElementById('lpm-cancel').addEventListener('click', closeFn);
      var dpEl = document.getElementById('lpm-datepicker');
      if (dpEl) window.createDatePicker(dpEl, state.date, function (d) { state.date = d; });
      document.getElementById('lpm-to').addEventListener('change', function (e) {
        state.toAccount = e.target.value;
        document.getElementById('lpm-save').disabled = !(state.toAccount && fmt.parseDecimalInput(state.amountStr) > 0);
      });
      document.getElementById('lpm-amt').addEventListener('input', function (e) {
        state.amountStr = e.target.value;
        document.getElementById('lpm-save').disabled = !(state.toAccount && fmt.parseDecimalInput(state.amountStr) > 0);
      });
      document.getElementById('lpm-notes').addEventListener('input', function (e) { state.notes = e.target.value; });
      document.getElementById('lpm-save').addEventListener('click', function () {
        var amount = fmt.parseDecimalInput(state.amountStr);
        if (!state.toAccount || amount <= 0) return;
        closeFn();
        opts.onSave({
          loanId: loan.id,
          date: state.date,
          toAccount: state.toAccount,
          amount: amount,
          notes: state.notes.trim(),
        });
      });

      var nextScrollEl = root.querySelector('.modal-body-scroll');
      if (nextScrollEl) nextScrollEl.scrollTop = prevScrollTop;
    }

    render();
  }

  window.openLoanModal = openLoanModal;
  window.openLoanPaymentModal = openLoanPaymentModal;
})();

(function () {
  function addPeriodToDate(isoDate, frequency, stepCount) {
    var parts = String(isoDate || '').slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || !parts[0]) return isoDate;
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (frequency === 'semanal') {
      d.setDate(d.getDate() + stepCount * 7);
    } else if (frequency === 'quincenal') {
      d.setDate(d.getDate() + stepCount * 15);
    } else {
      d.setMonth(d.getMonth() + stepCount);
    }
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function computeLoanStats(loan, payments, todayISO) {
    var loanPayList = (payments || [])
      .filter(function (p) { return p.loanId === loan.id; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    var paidTotal = (Number(loan.initialPaid) || 0) + loanPayList.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
    var totalDue = Number(loan.totalDue) || Number(loan.principal) || 0;
    var installments = Math.max(1, Number(loan.installments) || 1);
    var quotaAmount = totalDue / installments;
    var remainingTotal = Math.max(0, Math.round((totalDue - paidTotal) * 100) / 100);
    var isPaid = remainingTotal <= 0.01;
    var paidInstallments = isPaid
      ? installments
      : Math.min(installments - 1, Math.floor((paidTotal + 0.01) / (quotaAmount || 1)));
    var paidInCurrentQuota = Math.max(0, paidTotal - paidInstallments * quotaAmount);
    var remainingInCurrentQuota = isPaid
      ? 0
      : Math.max(0, Math.round((quotaAmount - paidInCurrentQuota) * 100) / 100);
    var nextDueDate = isPaid ? '' : addPeriodToDate(loan.startDate, loan.frequency, paidInstallments + 1);
    var isOverdue = !isPaid && Boolean(nextDueDate) && nextDueDate < todayISO;
    var progressPct = totalDue > 0 ? Math.min(100, Math.round((paidTotal / totalDue) * 100)) : 0;

    return {
      loan: loan,
      payments: loanPayList,
      paidTotal: paidTotal,
      totalDue: totalDue,
      installments: installments,
      quotaAmount: quotaAmount,
      remainingTotal: remainingTotal,
      paidInstallments: paidInstallments,
      paidInCurrentQuota: paidInCurrentQuota,
      remainingInCurrentQuota: remainingInCurrentQuota,
      nextDueDate: nextDueDate,
      isPaid: isPaid,
      isOverdue: isOverdue,
      progressPct: progressPct,
    };
  }

  function renderPrestamosView(state) {
    var container = document.getElementById('view-prestamos');
    if (!container) return;

    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var hide = Boolean(state.hideValues);
    var mCOP = function (v) { return fmt.maskCOP(v, hide); };
    var todayISO = fmt.getTodayISO();
    var loans = state.data.loans || [];
    var payments = state.data.loanPayments || [];
    var stats = loans.map(function (l) { return computeLoanStats(l, payments, todayISO); });

    var totalPrincipalActive = stats.filter(function (s) { return !s.isPaid; }).reduce(function (a, s) { return a + (Number(s.loan.principal) || 0); }, 0);
    var totalPending = stats.reduce(function (a, s) { return a + s.remainingTotal; }, 0);
    var totalCollected = stats.reduce(function (a, s) { return a + s.paidTotal; }, 0);
    var totalInterestExpected = stats.reduce(function (a, s) { return a + Math.max(0, s.totalDue - (Number(s.loan.principal) || 0)); }, 0);
    var overdueCount = stats.filter(function (s) { return s.isOverdue; }).length;
    var activeCount = stats.filter(function (s) { return !s.isPaid; }).length;
    var paidCount = stats.filter(function (s) { return s.isPaid; }).length;
    var activeTab = state.prestActiveTab || 'lista';
    var filter = state.loanFilter || 'Todos';

    var filtered = stats.filter(function (s) {
      if (filter === 'Activos') return !s.isPaid;
      if (filter === 'Vencidos') return s.isOverdue;
      if (filter === 'Pagados') return s.isPaid;
      return true;
    });

    var freqLabels = { unico: 'Pago único', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };
    var filterPills = ['Todos', 'Activos', 'Vencidos', 'Pagados'].map(function (f) {
      return '<button type="button" class="filter-pill ' + (filter === f ? 'active' : '') + '" data-loan-filter="' + f + '" style="padding:0.38rem 0.68rem;font-size:0.82rem">' + f + '</button>';
    }).join('');

    var cardsHtml = filtered.length === 0
      ? '<div class="card" style="text-align:center;padding:2.5rem 1rem"><p class="text-dim" style="margin:0">No hay préstamos en esta vista. Usa <strong>+ Nuevo préstamo</strong> para registrar uno.</p></div>'
      : '<div class="accounts-grid">' + filtered.map(function (st) {
          var l = st.loan;
          var badge = st.isPaid
            ? '<span class="badge badge-emerald">Pagado</span>'
            : (st.isOverdue
                ? '<span class="badge badge-rose">Vencido</span>'
                : '<span class="badge badge-indigo">Activo</span>');

          var isConfirmDel = state.pendingDeleteLoanId === l.id;
          var delCtrl = isConfirmDel
            ? '<div class="inline-confirm">' +
                '<span class="text-rose" style="font-weight:500">¿Eliminar?</span>' +
                '<button type="button" class="inline-confirm-btn no" data-cancel-del-loan="' + esc(l.id) + '">No</button>' +
                '<button type="button" class="inline-confirm-btn yes" data-confirm-del-loan="' + esc(l.id) + '">Sí</button>' +
              '</div>'
            : '<button type="button" class="icon-delete-btn" data-ask-del-loan="' + esc(l.id) + '" title="Eliminar préstamo"><i class="fa-regular fa-trash-can"></i></button>';

          return (
            '<div class="account-card ' + (st.isOverdue ? 'debt' : '') + '">' +
              '<div class="account-top"><span style="font-weight:700">' + esc(l.borrower) + '</span>' + badge + '</div>' +
              '<p class="account-balance tabular" style="color:' + (st.isPaid ? 'var(--emerald)' : 'var(--text-strong)') + '">' + esc(mCOP(st.remainingTotal)) + '</p>' +
              '<div class="credit-meta" style="color:var(--text-muted)">' +
                '<span>Prestado: ' + esc(mCOP(l.principal)) + (l.interestRate > 0 ? ' · ' + l.interestRate + '% ' + (l.interestMode === 'monthly' ? 'mes' : 'total') : ' · 0% int.') + '</span>' +
                '<span>' + st.paidInstallments + ' / ' + st.installments + ' cuotas</span>' +
              '</div>' +
              '<div class="progress-track"><div class="progress-fill" style="width:' + st.progressPct + '%;background:' + (st.isPaid ? '#10b981' : '#6366f1') + '"></div></div>' +
              '<p class="account-sub" style="margin-top:0.35rem">' +
                (st.isPaid
                  ? 'Cobro completado (' + esc(mCOP(st.paidTotal)) + ')'
                  : 'Próx. cobro: <strong>' + esc(st.nextDueDate) + '</strong> · ' + esc(freqLabels[l.frequency] || l.frequency) + ' · Falta cuota: <strong>' + esc(mCOP(st.remainingInCurrentQuota)) + '</strong>') +
              '</p>' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-top:0.6rem">' +
                (!st.isPaid
                  ? '<button type="button" class="btn btn-emerald" data-pay-loan="' + esc(l.id) + '" style="padding:0.35rem 0.7rem;font-size:0.8rem"><i class="fa-solid fa-plus"></i> Registrar cobro</button>'
                  : '<span style="font-size:0.78rem;color:var(--emerald)"><i class="fa-regular fa-circle-check"></i> Al día</span>') +
                delCtrl +
              '</div>' +
            '</div>'
          );
        }).join('') + '</div>';

    if (activeTab === 'lista') {
      container.innerHTML =
        '<div class="view-sticky-header">' +
          '<h2 class="section-title-upper" style="margin:0">Préstamos</h2>' +
          '<div class="movimientos-toolbar">' +
            '<div class="filter-pills" style="gap:0.35rem">' + filterPills + '</div>' +
            '<button type="button" id="btn-new-loan" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Nuevo préstamo</button>' +
          '</div>' +
        '</div>' +
        cardsHtml;
    } else if (activeTab === 'estado') {
      container.innerHTML =
        '<div class="view-sticky-header">' +
          '<h2 class="section-title-upper" style="margin:0">Estado Financiero de Préstamos</h2>' +
        '</div>' +
        '<section class="kpi-grid">' +
          '<div class="kpi-card"><div class="kpi-label text-sky"><i class="fa-solid fa-hand-holding-dollar"></i> Capital activo</div><p class="kpi-value tabular">' + esc(mCOP(totalPrincipalActive)) + '</p></div>' +
          '<div class="kpi-card"><div class="kpi-label text-amber"><i class="fa-regular fa-clock"></i> Total por cobrar</div><p class="kpi-value tabular">' + esc(mCOP(totalPending)) + '</p></div>' +
          '<div class="kpi-card"><div class="kpi-label text-emerald"><i class="fa-solid fa-circle-check"></i> Total cobrado</div><p class="kpi-value tabular">' + esc(mCOP(totalCollected)) + '</p></div>' +
          '<div class="kpi-card"><div class="kpi-label text-violet"><i class="fa-solid fa-percent"></i> Intereses totales</div><p class="kpi-value tabular">' + esc(mCOP(totalInterestExpected)) + '</p></div>' +
        '</section>' +
        '<section class="kpi-grid" style="margin-top:0.85rem">' +
          '<div class="kpi-card"><div class="kpi-label text-indigo"><i class="fa-solid fa-list-check"></i> Préstamos activos</div><p class="kpi-value tabular">' + activeCount + '</p></div>' +
          '<div class="kpi-card"><div class="kpi-label ' + (overdueCount > 0 ? 'text-rose' : 'text-muted') + '"><i class="fa-solid fa-triangle-exclamation"></i> Vencidos</div><p class="kpi-value tabular">' + overdueCount + '</p></div>' +
          '<div class="kpi-card"><div class="kpi-label text-emerald"><i class="fa-regular fa-circle-check"></i> Pagados</div><p class="kpi-value tabular">' + paidCount + '</p></div>' +
          '<div class="kpi-card"><div class="kpi-label text-muted"><i class="fa-solid fa-layer-group"></i> Total registrados</div><p class="kpi-value tabular">' + loans.length + '</p></div>' +
        '</section>';
    } else {
      var loanById = {};
      loans.forEach(function (l) { loanById[l.id] = l; });
      var timeline = [];
      loans.forEach(function (l) {
        if (l.isHistorical) {
          timeline.push({
            id: l.id,
            kind: 'egreso_hist',
            date: l.startDate,
            createdAt: l.createdAt || '',
            borrower: l.borrower,
            account: 'Previo a la app',
            amount: l.principal,
            notes: l.notes || 'Préstamo anterior a la app',
          });
          if (Number(l.initialPaid) > 0) {
            timeline.push({
              id: l.id + '-initpaid',
              kind: 'ingreso_hist',
              date: l.startDate,
              createdAt: l.createdAt || '',
              borrower: l.borrower,
              account: 'Previo a la app',
              amount: Number(l.initialPaid),
              notes: 'Abono previo al registro en la app',
            });
          }
          return;
        }
        timeline.push({
          id: l.id,
          kind: 'egreso',
          date: l.startDate,
          createdAt: l.createdAt || '',
          borrower: l.borrower,
          account: l.fromAccount,
          amount: l.principal,
          notes: l.notes || 'Préstamo otorgado',
        });
      });
      payments.forEach(function (p) {
        var ln = loanById[p.loanId];
        timeline.push({
          id: p.id,
          kind: 'ingreso',
          date: p.date,
          createdAt: p.createdAt || '',
          borrower: ln ? ln.borrower : 'Préstamo',
          account: p.toAccount,
          amount: p.amount,
          notes: p.notes || 'Cobro / Abono',
        });
      });
      timeline.sort(function (a, b) {
        return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
      });

      var prestSearch = String(state.prestSearchTerm || '').trim().toLowerCase();
      var filteredTimeline = !prestSearch
        ? timeline
        : timeline.filter(function (item) {
            return (
              String(item.borrower || '').toLowerCase().indexOf(prestSearch) !== -1 ||
              String(item.account || '').toLowerCase().indexOf(prestSearch) !== -1 ||
              String(item.notes || '').toLowerCase().indexOf(prestSearch) !== -1 ||
              String(item.date || '').toLowerCase().indexOf(prestSearch) !== -1
            );
          });

      var rowsHtml = filteredTimeline.length === 0
        ? '<tr><td colspan="7" class="text-dim" style="text-align:center;padding:2.5rem 1rem">' + (timeline.length === 0 ? 'No hay movimientos vinculados a préstamos aún.' : 'No hay movimientos de préstamos que coincidan con la búsqueda.') + '</td></tr>'
        : filteredTimeline.map(function (item) {
            var isIn = item.kind === 'ingreso' || item.kind === 'ingreso_hist';
            var isHistIn = item.kind === 'ingreso_hist';
            var isHistOut = item.kind === 'egreso_hist';
            var isConfirmMovDel = item.kind === 'ingreso'
              ? (state.pendingDeleteLoanPayId === item.id)
              : (!isHistIn && state.pendingDeleteLoanId === item.id);
            var actionCell = isHistIn
              ? '<span class="text-dim" style="font-size:0.75rem">—</span>'
              : (isConfirmMovDel
                  ? '<div class="inline-confirm">' +
                      '<span class="text-rose" style="font-weight:500">¿Eliminar?</span>' +
                      '<button type="button" class="inline-confirm-btn no" ' + (item.kind === 'ingreso' ? 'data-cancel-del-loan-pay="' + esc(item.id) + '"' : 'data-cancel-del-loan="' + esc(item.id) + '"') + '>No</button>' +
                      '<button type="button" class="inline-confirm-btn yes" ' + (item.kind === 'ingreso' ? 'data-confirm-del-loan-pay="' + esc(item.id) + '"' : 'data-confirm-del-loan="' + esc(item.id) + '"') + '>Sí</button>' +
                    '</div>'
                  : '<button type="button" class="icon-delete-btn" ' + (item.kind === 'ingreso' ? 'data-ask-del-loan-pay="' + esc(item.id) + '" title="Eliminar cobro"' : 'data-ask-del-loan="' + esc(item.id) + '" title="Eliminar préstamo"') + '><i class="fa-regular fa-trash-can"></i></button>');
            var badgeCls = isHistIn ? 'badge-sky' : (isHistOut ? 'badge-amber' : (isIn ? 'badge-emerald' : 'badge-rose'));
            var badgeTxt = isHistIn ? 'Abono previo' : (isHistOut ? 'Préstamo previo' : (isIn ? 'Cobro (Ingreso)' : 'Préstamo (Egreso)'));
            return (
              '<tr>' +
                '<td class="text-muted" style="white-space:nowrap">' + esc(item.date) + '</td>' +
                '<td><span class="badge ' + badgeCls + '">' + badgeTxt + '</span></td>' +
                '<td style="font-weight:500;color:var(--text-strong)">' + esc(item.borrower) + '</td>' +
                '<td class="text-muted">' + esc(item.notes) + '</td>' +
                '<td class="text-muted" style="white-space:nowrap">' + esc(item.account) + '</td>' +
                '<td class="text-right tabular ' + (isIn ? 'text-emerald' : 'text-rose') + '" style="font-weight:600;white-space:nowrap">' + (hide ? '' : (isIn ? '+' : '-')) + esc(mCOP(item.amount)) + '</td>' +
                '<td class="text-right">' + actionCell + '</td>' +
              '</tr>'
            );
          }).join('');

      function bindPrestMovDeletes(scope) {
        scope.querySelectorAll('[data-ask-del-loan]').forEach(function (btn) {
          btn.addEventListener('click', function () { window.AppActions.askDeleteLoan(btn.getAttribute('data-ask-del-loan')); });
        });
        scope.querySelectorAll('[data-cancel-del-loan]').forEach(function (btn) {
          btn.addEventListener('click', function () { window.AppActions.askDeleteLoan(null); });
        });
        scope.querySelectorAll('[data-confirm-del-loan]').forEach(function (btn) {
          btn.addEventListener('click', function () { window.AppActions.deleteLoan(btn.getAttribute('data-confirm-del-loan')); });
        });
        scope.querySelectorAll('[data-ask-del-loan-pay]').forEach(function (btn) {
          btn.addEventListener('click', function () { window.AppActions.askDeleteLoanPayment(btn.getAttribute('data-ask-del-loan-pay')); });
        });
        scope.querySelectorAll('[data-cancel-del-loan-pay]').forEach(function (btn) {
          btn.addEventListener('click', function () { window.AppActions.askDeleteLoanPayment(null); });
        });
        scope.querySelectorAll('[data-confirm-del-loan-pay]').forEach(function (btn) {
          btn.addEventListener('click', function () { window.AppActions.deleteLoanPayment(btn.getAttribute('data-confirm-del-loan-pay')); });
        });
      }

      var existingPrestSearch = container.querySelector('#prest-mov-search');
      var existingPrestTbody = container.querySelector('#prest-mov-table-body');
      if (existingPrestSearch && existingPrestTbody && document.activeElement === existingPrestSearch) {
        existingPrestTbody.innerHTML = rowsHtml;
        bindPrestMovDeletes(existingPrestTbody);
        return;
      }

      container.innerHTML =
        '<div class="view-sticky-header">' +
          '<h2 class="section-title-upper" style="margin:0">Historial de Movimientos de Préstamos</h2>' +
          '<div class="movimientos-toolbar">' +
            '<div class="search-box" style="margin-left:auto">' +
              '<i class="fa-solid fa-magnifying-glass"></i>' +
              '<input type="text" id="prest-mov-search" class="input" placeholder="Buscar persona, cuenta o detalle..." value="' + esc(state.prestSearchTerm || '') + '" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="table-wrap">' +
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th>Fecha</th><th>Tipo</th><th>Persona</th><th>Detalle</th><th>Cuenta</th><th class="text-right">Monto</th><th class="text-right">Acción</th>' +
            '</tr></thead>' +
            '<tbody id="prest-mov-table-body">' + rowsHtml + '</tbody>' +
          '</table>' +
        '</div>';

      var prestSearchInp = document.getElementById('prest-mov-search');
      if (prestSearchInp) {
        prestSearchInp.addEventListener('input', function (e) {
          window.AppActions.setPrestSearchTerm(e.target.value);
        });
      }
    }

    container.querySelectorAll('[data-loan-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.AppActions.setLoanFilter(btn.getAttribute('data-loan-filter'));
      });
    });
    var newBtn = document.getElementById('btn-new-loan');
    if (newBtn) newBtn.addEventListener('click', function () { window.AppActions.openNewLoan(); });
    container.querySelectorAll('[data-pay-loan]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-pay-loan');
        var st = stats.find(function (s) { return s.loan.id === id; });
        if (st) window.AppActions.openNewLoanPayment(st);
      });
    });
    container.querySelectorAll('[data-ask-del-loan]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.AppActions.askDeleteLoan(btn.getAttribute('data-ask-del-loan')); });
    });
    container.querySelectorAll('[data-cancel-del-loan]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.AppActions.askDeleteLoan(null); });
    });
    container.querySelectorAll('[data-confirm-del-loan]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.AppActions.deleteLoan(btn.getAttribute('data-confirm-del-loan')); });
    });
    container.querySelectorAll('[data-ask-del-loan-pay]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.AppActions.askDeleteLoanPayment(btn.getAttribute('data-ask-del-loan-pay')); });
    });
    container.querySelectorAll('[data-cancel-del-loan-pay]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.AppActions.askDeleteLoanPayment(null); });
    });
    container.querySelectorAll('[data-confirm-del-loan-pay]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.AppActions.deleteLoanPayment(btn.getAttribute('data-confirm-del-loan-pay')); });
    });
  }

  window.renderPrestamosView = renderPrestamosView;
})();

(function () {
  var ACCOUNT_ICONS = {
    banco: { icon: 'fa-solid fa-landmark', cls: 'text-sky' },
    billetera: { icon: 'fa-solid fa-mobile-screen-button', cls: 'text-fuchsia' },
    efectivo: { icon: 'fa-solid fa-wallet', cls: 'text-emerald' },
    debito: { icon: 'fa-regular fa-credit-card', cls: 'text-sky' },
    credito: { icon: 'fa-regular fa-credit-card', cls: 'text-amber' },
  };

  function detectAccountIconKey(acc) {
    if (acc && acc.icon && acc.icon !== 'auto' && ACCOUNT_ICONS[acc.icon]) {
      return acc.icon;
    }
    var lower = String((acc && acc.name) || '').toLowerCase();
    if ((acc && acc.kind === 'deuda') || lower.indexOf('crédito') !== -1 || lower.indexOf('credito') !== -1) {
      return 'credito';
    }
    if (lower.indexOf('nequi') !== -1 || lower.indexOf('daviplata') !== -1 || lower.indexOf('dale') !== -1 || lower.indexOf('billetera') !== -1 || lower.indexOf('movii') !== -1) {
      return 'billetera';
    }
    if (lower.indexOf('efectivo') !== -1 || lower.indexOf('caja') !== -1 || lower.indexOf('mano') !== -1) {
      return 'efectivo';
    }
    if (lower.indexOf('débito') !== -1 || lower.indexOf('debito') !== -1 || lower.indexOf('tarjeta') !== -1) {
      return 'debito';
    }
    return 'banco';
  }

  function getAccountIcon(acc) {
    return ACCOUNT_ICONS[detectAccountIconKey(acc)] || ACCOUNT_ICONS.banco;
  }

  function renderResumenView(state) {
    var container = document.getElementById('view-resumen');
    if (!container) return;

    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var hide = Boolean(state.hideValues);
    var mCOP = function (v) { return fmt.maskCOP(v, hide); };
    var summary = state.summary;
    var data = state.data;
    var ccDebt = summary.totalDebt;
    var isSurplus = summary.ccSurplusOrDeficit >= 0;

    // 1. Cuentas
    var accountsHtml = (data.accounts || []).map(function (acc) {
      var balance = summary.endBalances[acc.name] || 0;
      if (acc.kind === 'deuda') {
        var limit = acc.creditLimit != null ? acc.creditLimit : 2400000;
        var available = limit - balance;
        var usagePct = limit > 0 ? Math.min(100, Math.max(0, Math.round((balance / limit) * 100))) : 0;
        return (
          '<div class="account-card debt">' +
            '<div class="account-top"><span>' + esc(acc.name) + ' (Deuda)</span><i class="fa-regular fa-credit-card text-amber"></i></div>' +
            '<p class="account-balance tabular">' + esc(mCOP(balance)) + '</p>' +
            '<div class="credit-meta"><span>Cupo disp: ' + esc(mCOP(available)) + '</span><span>' + usagePct + '% de ' + esc(mCOP(limit)) + '</span></div>' +
            '<div class="progress-track"><div class="progress-fill ' + (usagePct >= 85 ? 'high' : '') + '" style="width:' + usagePct + '%"></div></div>' +
          '</div>'
        );
      }
      var ic = getAccountIcon(acc);
      return (
        '<div class="account-card">' +
          '<div class="account-top"><span>' + esc(acc.name) + '</span><i class="' + ic.icon + ' ' + ic.cls + '"></i></div>' +
          '<p class="account-balance tabular">' + esc(mCOP(balance)) + '</p>' +
          '<p class="account-sub">Liquidez disponible</p>' +
        '</div>'
      );
    }).join('');

    // 2. Termómetro TC
    var payCcBtn = ccDebt > 0
      ? '<button type="button" id="btn-quick-pay-cc" class="btn btn-sky">Pagar TC</button>'
      : '';

    var thermometerHtml =
      '<section class="thermometer-card ' + (isSurplus ? '' : 'deficit') + '">' +
        '<div>' +
          '<h3 class="thermometer-title">' +
            '<i class="' + (isSurplus ? 'fa-regular fa-circle-check text-emerald' : 'fa-solid fa-triangle-exclamation text-rose') + '"></i>' +
            '<span>Capacidad de Pago Total — Tarjeta de Crédito</span>' +
          '</h3>' +
          '<p class="thermometer-desc">' +
            'Tienes <strong style="color:var(--text-strong)">' + esc(mCOP(summary.liquidityTotal)) + '</strong> en liquidez operativa ' +
            'frente a <strong class="text-amber">' + esc(mCOP(ccDebt)) + '</strong> de deuda en TC.' +
          '</p>' +
        '</div>' +
        '<div class="thermometer-right">' +
          '<div>' +
            '<p class="obligation-sub">' + (isSurplus ? 'Te sobraría después del pago total' : 'Te falta para cubrir el total') + '</p>' +
            '<p class="thermometer-amount tabular ' + (isSurplus ? 'text-emerald' : 'text-rose') + '">' + esc(mCOP(Math.abs(summary.ccSurplusOrDeficit))) + '</p>' +
          '</div>' +
          payCcBtn +
        '</div>' +
      '</section>';

    // 3. KPIs
    var kpisHtml =
      '<section class="kpi-grid">' +
        '<div class="kpi-card"><div class="kpi-label text-emerald"><i class="fa-solid fa-arrow-trend-up"></i> Ingresos del mes</div><p class="kpi-value tabular">' + esc(mCOP(summary.totalIncome)) + '</p></div>' +
        '<div class="kpi-card"><div class="kpi-label text-rose"><i class="fa-solid fa-arrow-trend-down"></i> Egresos de consumo</div><p class="kpi-value tabular">' + esc(mCOP(summary.totalConsumptionExpense)) + '</p></div>' +
        '<div class="kpi-card"><div class="kpi-label text-violet"><i class="fa-solid fa-right-left"></i> Enviado a Inversiones</div><p class="kpi-value tabular">' + esc(mCOP(summary.totalArqInvestment)) + '</p></div>' +
        '<div class="kpi-card"><div class="kpi-label text-muted">Flujo neto del mes</div><p class="kpi-value tabular ' + (summary.netFlow >= 0 ? 'text-emerald' : 'text-rose') + '">' + (hide ? '' : (summary.netFlow >= 0 ? '+' : '')) + esc(mCOP(summary.netFlow)) + '</p></div>' +
      '</section>';

    // 4. Obligaciones
    var obListHtml = state.obligationStatuses.map(function (st, idx) {
      var ob = st.obligation;
      var subText = st.isPaid
        ? 'Pagado: ' + mCOP(st.paidAmount)
        : (ob.estimatedAmount > 0 ? 'Estimado: ' + mCOP(ob.estimatedAmount) : 'Pendiente este mes');
      var isConfirmingDel = state.pendingDeleteObligationId === ob.id;
      var deleteCtrl = isConfirmingDel
        ? '<div class="inline-confirm">' +
            '<span class="text-rose" style="font-weight:500">¿Eliminar?</span>' +
            '<button type="button" class="inline-confirm-btn no" data-cancel-del-ob="' + esc(ob.id) + '">No</button>' +
            '<button type="button" class="inline-confirm-btn yes" data-confirm-del-ob="' + esc(ob.id) + '">Sí</button>' +
          '</div>'
        : '<button type="button" class="icon-delete-btn" data-ask-del-ob="' + esc(ob.id) + '" title="Eliminar obligación"><i class="fa-regular fa-trash-can"></i></button>';

      return (
        '<div class="obligation-item">' +
          '<div class="obligation-left">' +
            '<span class="dot-status ' + (st.isPaid ? 'paid' : '') + '"></span>' +
            '<div>' +
              '<p class="obligation-name">' + esc(ob.name) + '</p>' +
              '<p class="obligation-sub">' + esc(subText) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="obligation-actions">' +
            (st.isPaid ? '<span class="badge badge-emerald">Pagada</span>' : '') +
            '<button type="button" class="btn btn-secondary btn-ob-pay" data-ob-index="' + idx + '">' + (st.isPaid ? '+ Otro pago' : 'Registrar pago') + '</button>' +
            deleteCtrl +
          '</div>' +
        '</div>'
      );
    }).join('');

    // 5. Egresos por concepto
    var catMax = summary.expensesByCategory.length > 0 ? summary.expensesByCategory[0].amount : 1;
    var catHtml = summary.expensesByCategory.length === 0
      ? '<p class="text-dim" style="text-align:center;padding:2rem 0;font-size:0.875rem">Sin egresos registrados en este mes.</p>'
      : '<div class="cat-bar-list">' + summary.expensesByCategory.map(function (item) {
          var pct = Math.max(4, Math.round((item.amount / catMax) * 100));
          return (
            '<div>' +
              '<div class="cat-bar-head">' +
                '<span style="color:var(--text-main)">' + esc(item.category) + (item.isArq ? ' <span class="badge badge-violet">Inversión</span>' : '') + '</span>' +
                '<span class="tabular" style="font-weight:600;color:var(--text-strong)">' + esc(mCOP(item.amount)) + '</span>' +
              '</div>' +
              '<div class="cat-bar-track"><div class="cat-bar-fill ' + (item.isArq ? 'arq' : '') + '" style="width:' + pct + '%"></div></div>' +
            '</div>'
          );
        }).join('') + '</div>';

    var closedBadge = state.existingClose
      ? '<span class="badge badge-emerald"><i class="fa-solid fa-lock"></i> Mes cerrado</span>'
      : '';

    container.innerHTML =
      '<section>' +
        '<div class="section-header">' +
          '<h2 class="section-title-upper">Saldos al cierre de ' + esc(fmt.formatMonthLabel(state.selectedMonth)) + '</h2>' +
          closedBadge +
        '</div>' +
        '<div class="accounts-grid">' + accountsHtml + '</div>' +
      '</section>' +
      thermometerHtml +
      kpisHtml +
      '<section class="resumen-panels">' +
        '<div class="card">' +
          '<h3 class="section-title">Cuentas Pagadas / Obligaciones del Mes</h3>' +
          '<div class="obligation-list">' + obListHtml + '</div>' +
          '<form id="form-new-obligation" class="obligation-form">' +
            '<input type="text" id="new-ob-name" class="input" placeholder="Nueva cuenta fija (ej. Internet)" />' +
            '<input type="text" id="new-ob-amount" class="input input-amount" inputmode="numeric" placeholder="Estimado COP" />' +
            '<button type="submit" class="btn btn-primary">Agregar</button>' +
          '</form>' +
        '</div>' +
        '<div class="card">' +
          '<h3 class="section-title">Egresos por Concepto</h3>' +
          catHtml +
        '</div>' +
      '</section>';

    // Bind events
    var payBtn = document.getElementById('btn-quick-pay-cc');
    if (payBtn) {
      payBtn.addEventListener('click', function () {
        window.AppActions.openMoveModal({
          type: 'Traspaso',
          fromAccount: 'Tarjeta de Débito',
          toAccount: 'Tarjeta de Crédito',
          amount: Math.round(ccDebt),
          description: 'Pago Tarjeta de Crédito',
        });
      });
    }

    container.querySelectorAll('.btn-ob-pay').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-ob-index'));
        var st = state.obligationStatuses[idx];
        if (!st) return;
        var ob = st.obligation;
        if (ob.matchType === 'PagoTC') {
          window.AppActions.openMoveModal({
            type: 'Traspaso',
            fromAccount: 'Tarjeta de Débito',
            toAccount: 'Tarjeta de Crédito',
            amount: ccDebt > 0 ? Math.round(ccDebt) : undefined,
          });
        } else {
          window.AppActions.openMoveModal({
            type: 'Egreso',
            fromAccount: 'Tarjeta de Débito',
            category: ob.category,
            amount: st.isPaid ? undefined : (ob.estimatedAmount || undefined),
            description: ob.name,
          });
        }
      });
    });

    var obForm = document.getElementById('form-new-obligation');
    if (obForm) {
      obForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameEl = document.getElementById('new-ob-name');
        var amtEl = document.getElementById('new-ob-amount');
        window.AppActions.addObligation(nameEl.value, amtEl.value);
      });
    }

    container.querySelectorAll('[data-ask-del-ob]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.AppActions.askDeleteObligation(btn.getAttribute('data-ask-del-ob'));
      });
    });

    container.querySelectorAll('[data-cancel-del-ob]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.AppActions.askDeleteObligation(null);
      });
    });

    container.querySelectorAll('[data-confirm-del-ob]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.AppActions.deleteObligation(btn.getAttribute('data-confirm-del-ob'));
      });
    });
  }

  window.renderResumenView = renderResumenView;
})();

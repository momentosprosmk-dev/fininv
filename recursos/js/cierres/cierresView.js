(function () {
  function renderCierresView(state) {
    var container = document.getElementById('view-cierres');
    if (!container) return;

    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var summary = state.summary;
    var ccDebt = summary.totalDebt;
    var isSurplus = summary.ccSurplusOrDeficit >= 0;
    var closes = state.data.monthlyCloses || [];

    var historyHtml = closes.length === 0
      ? '<p class="text-dim" style="text-align:center;padding:2rem 0;font-size:0.875rem">Aún no has cerrado ningún mes.</p>'
      : '<div class="table-wrap" style="border:none;background:transparent">' +
          '<table class="data-table" style="min-width:680px;font-size:0.78rem">' +
            '<thead><tr>' +
              '<th>Mes</th><th class="text-right">Ingresos</th><th class="text-right">Consumo</th><th class="text-right">ARQ</th><th class="text-right">Liquidez</th><th class="text-right">Deuda TC</th><th class="text-right">Resultado TC</th><th>Notas</th>' +
            '</tr></thead>' +
            '<tbody>' + closes.map(function (c) {
              var resPos = c.ccSurplusOrDeficit >= 0;
              return (
                '<tr class="cierre-row-click" data-jump-month="' + esc(c.month) + '">' +
                  '<td style="font-weight:600;color:#fff">' + esc(fmt.formatMonthLabel(c.month)) + '</td>' +
                  '<td class="text-right text-emerald tabular">' + esc(fmt.formatCOP(c.totalIncome)) + '</td>' +
                  '<td class="text-right text-rose tabular">' + esc(fmt.formatCOP(c.totalConsumptionExpense)) + '</td>' +
                  '<td class="text-right text-violet tabular">' + esc(fmt.formatCOP(c.totalArqInvestment)) + '</td>' +
                  '<td class="text-right tabular">' + esc(fmt.formatCOP(c.liquidityTotal)) + '</td>' +
                  '<td class="text-right text-amber tabular">' + esc(fmt.formatCOP(c.ccDebt)) + '</td>' +
                  '<td class="text-right tabular ' + (resPos ? 'text-emerald' : 'text-rose') + '" style="font-weight:600">' + (resPos ? '+' : '') + esc(fmt.formatCOP(c.ccSurplusOrDeficit)) + '</td>' +
                  '<td class="text-muted">' + esc(c.notes || '—') + '</td>' +
                '</tr>'
              );
            }).join('') + '</tbody>' +
          '</table>' +
        '</div>';

    container.innerHTML =
      '<section class="card">' +
        '<h2 class="section-title" style="font-size:1rem;margin-bottom:0.25rem">Cierre Contable de ' + esc(fmt.formatMonthLabel(state.selectedMonth)) + '</h2>' +
        '<p class="text-muted" style="font-size:0.78rem;margin:0 0 1.25rem">Guarda una fotografía oficial del mes para tu historial y hoja Cierres_Mensuales.</p>' +
        '<div class="cierre-summary-grid">' +
          '<div class="cierre-stat"><p class="cierre-stat-label">Ingresos</p><p class="cierre-stat-val text-emerald tabular">' + esc(fmt.formatCOP(summary.totalIncome)) + '</p></div>' +
          '<div class="cierre-stat"><p class="cierre-stat-label">Egresos (Consumo + ARQ)</p><p class="cierre-stat-val text-rose tabular">' + esc(fmt.formatCOP(summary.totalExpense)) + '</p></div>' +
          '<div class="cierre-stat"><p class="cierre-stat-label">Liquidez Final</p><p class="cierre-stat-val tabular" style="color:#fff">' + esc(fmt.formatCOP(summary.liquidityTotal)) + '</p></div>' +
          '<div class="cierre-stat"><p class="cierre-stat-label">Deuda TC / Balance Pago</p><p class="cierre-stat-val tabular ' + (isSurplus ? 'text-emerald' : 'text-rose') + '">' + esc(fmt.formatCOP(ccDebt)) + ' (' + (isSurplus ? 'Sobra ' : 'Falta ') + esc(fmt.formatCOP(Math.abs(summary.ccSurplusOrDeficit))) + ')</p></div>' +
        '</div>' +
        '<div class="cierre-form-row">' +
          '<input type="text" id="close-notes-input" class="input" placeholder="Notas del cierre (ej. Se pagó TC completa, faltó cubrir $X...)" value="' + esc(state.closeNotes) + '" />' +
          '<button type="button" id="btn-close-month" class="btn btn-primary" style="white-space:nowrap">' +
            '<i class="fa-solid fa-lock"></i> ' + (state.existingClose ? 'Actualizar cierre del mes' : 'Cerrar mes contable') +
          '</button>' +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<h3 class="section-title">Historial de Meses Cerrados</h3>' +
        historyHtml +
      '</section>';

    var notesInput = document.getElementById('close-notes-input');
    if (notesInput) {
      notesInput.addEventListener('input', function (e) {
        window.AppActions.setCloseNotes(e.target.value);
      });
    }

    var closeBtn = document.getElementById('btn-close-month');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        window.AppActions.closeMonth();
      });
    }

    container.querySelectorAll('[data-jump-month]').forEach(function (row) {
      row.addEventListener('click', function () {
        window.AppActions.selectMonthAndResumen(row.getAttribute('data-jump-month'));
      });
    });
  }

  window.renderCierresView = renderCierresView;
})();

(function () {
  function renderCierresView(state) {
    var container = document.getElementById('view-cierres');
    if (!container) return;

    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var hide = Boolean(state.hideValues);
    var mCOP = function (v) { return fmt.maskCOP(v, hide); };
    var summary = state.summary;
    var ccDebt = summary.totalDebt;
    var isSurplus = summary.ccSurplusOrDeficit >= 0;
    var closes = state.data.monthlyCloses || [];
    var cierresQuery = String(state.cierresSearchTerm || '').trim().toLowerCase();
    var filteredCloses = !cierresQuery
      ? closes
      : closes.filter(function (c) {
          var monthLabel = String(fmt.formatMonthLabel(c.month) || '').toLowerCase();
          return (
            String(c.month || '').toLowerCase().indexOf(cierresQuery) !== -1 ||
            monthLabel.indexOf(cierresQuery) !== -1 ||
            String(c.notes || '').toLowerCase().indexOf(cierresQuery) !== -1 ||
            String(c.totalIncome || '').indexOf(cierresQuery) !== -1 ||
            String(c.totalConsumptionExpense || '').indexOf(cierresQuery) !== -1 ||
            String(c.totalArqInvestment || '').indexOf(cierresQuery) !== -1 ||
            String(c.liquidityTotal || '').indexOf(cierresQuery) !== -1 ||
            String(c.ccDebt || '').indexOf(cierresQuery) !== -1 ||
            String(c.ccSurplusOrDeficit || '').indexOf(cierresQuery) !== -1
          );
        });

    var closeRowsHtml = filteredCloses.length === 0
      ? '<tr><td colspan="8" class="text-dim" style="text-align:center;padding:2rem 1rem">' + (closes.length === 0 ? 'Aún no has cerrado ningún mes.' : 'No hay cierres que coincidan con la búsqueda.') + '</td></tr>'
      : filteredCloses.map(function (c) {
          var resPos = c.ccSurplusOrDeficit >= 0;
          return (
            '<tr class="cierre-row-click" data-jump-month="' + esc(c.month) + '">' +
              '<td style="font-weight:600;color:var(--text-strong)">' + esc(fmt.formatMonthLabel(c.month)) + '</td>' +
              '<td class="text-right text-emerald tabular">' + esc(mCOP(c.totalIncome)) + '</td>' +
              '<td class="text-right text-rose tabular">' + esc(mCOP(c.totalConsumptionExpense)) + '</td>' +
              '<td class="text-right text-violet tabular">' + esc(mCOP(c.totalArqInvestment)) + '</td>' +
              '<td class="text-right tabular">' + esc(mCOP(c.liquidityTotal)) + '</td>' +
              '<td class="text-right text-amber tabular">' + esc(mCOP(c.ccDebt)) + '</td>' +
              '<td class="text-right tabular ' + (resPos ? 'text-emerald' : 'text-rose') + '" style="font-weight:600">' + (hide ? '' : (resPos ? '+' : '')) + esc(mCOP(c.ccSurplusOrDeficit)) + '</td>' +
              '<td class="text-muted">' + esc(c.notes || '—') + '</td>' +
            '</tr>'
          );
        }).join('');

    var historyHtml =
      '<div class="table-wrap" style="border:none;background:transparent">' +
        '<table class="data-table" style="min-width:680px;font-size:0.78rem">' +
          '<thead><tr>' +
            '<th>Mes</th><th class="text-right">Ingresos</th><th class="text-right">Consumo</th><th class="text-right">Inversión</th><th class="text-right">Liquidez</th><th class="text-right">Deuda TC</th><th class="text-right">Resultado TC</th><th>Notas</th>' +
          '</tr></thead>' +
          '<tbody id="cierres-table-body">' + closeRowsHtml + '</tbody>' +
        '</table>' +
      '</div>';

    var closeDay = fmt.getMonthCloseDay();
    var periodRange = fmt.getAccountingPeriodRange(state.selectedMonth, closeDay);
    var closeDayLabel = closeDay > 0 ? 'Día ' + closeDay + ' de cada mes' : 'Fin de mes (calendario)';

    if (state.activeTab === 'cierre-mes') {
      var notesLen = String(state.closeNotes || '').trim().length;
      var canClose = notesLen > 10;
      container.innerHTML =
        '<h2 class="section-title-upper" style="margin:0 0 0.85rem">Cerrar Mes Contable</h2>' +
        '<div style="padding-bottom:5rem">' +
          '<section class="card">' +
            '<h2 class="section-title" style="font-size:1rem;margin-bottom:0.25rem">Cierre Contable de ' + esc(fmt.formatMonthLabel(state.selectedMonth)) + '</h2>' +
            '<p class="text-muted" style="font-size:0.78rem;margin:0 0 0.75rem">Guarda una fotografía oficial del mes para tu historial y hoja Cierres_Mensuales.</p>' +
            '<p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 1rem"><i class="fa-regular fa-calendar-check" style="margin-right:0.35rem;color:#818cf8"></i>Corte configurado: <strong style="color:var(--text-strong)">' + esc(closeDayLabel) + '</strong> · Periodo: <strong style="color:var(--text-strong)">' + esc(periodRange.label) + '</strong></p>' +
            '<div class="cierre-summary-grid">' +
              '<div class="cierre-stat"><p class="cierre-stat-label">Ingresos</p><p class="cierre-stat-val text-emerald tabular">' + esc(mCOP(summary.totalIncome)) + '</p></div>' +
              '<div class="cierre-stat"><p class="cierre-stat-label">Egresos (Consumo + Inversión)</p><p class="cierre-stat-val text-rose tabular">' + esc(mCOP(summary.totalExpense)) + '</p></div>' +
              '<div class="cierre-stat"><p class="cierre-stat-label">Liquidez Final</p><p class="cierre-stat-val tabular" style="color:var(--text-strong)">' + esc(mCOP(summary.liquidityTotal)) + '</p></div>' +
              '<div class="cierre-stat"><p class="cierre-stat-label">Deuda TC / Balance Pago</p><p class="cierre-stat-val tabular ' + (isSurplus ? 'text-emerald' : 'text-rose') + '">' + esc(mCOP(ccDebt)) + (hide ? '' : ' (' + (isSurplus ? 'Sobra ' : 'Falta ') + esc(mCOP(Math.abs(summary.ccSurplusOrDeficit))) + ')') + '</p></div>' +
            '</div>' +
            '<p id="close-notes-hint" style="margin:0.85rem 0 0.45rem;font-size:0.78rem;color:' + (canClose ? 'var(--emerald)' : 'var(--text-muted)') + '">' +
              (canClose ? 'Observaciones válidas (' + notesLen + ' caracteres).' : 'Ingresa más de 10 caracteres en observaciones para cerrar el mes (' + notesLen + ' / 11).') +
            '</p>' +
            '<div class="cierre-form-row" style="margin-top:0">' +
              '<input type="text" id="close-notes-input" class="input" placeholder="Observaciones del cierre (mín. 11 caracteres)..." value="' + esc(state.closeNotes) + '" />' +
            '</div>' +
          '</section>' +
        '</div>' +
        '<div style="position:fixed;bottom:0;left:0;right:0;z-index:30;padding:0.75rem 1rem;border-top:1px solid var(--border-subtle);background:var(--bg-card);box-shadow:0 -8px 24px rgba(0,0,0,0.28)">' +
          '<div style="max-width:72rem;margin:0 auto;display:flex;justify-content:center">' +
            '<button type="button" id="btn-close-month" class="btn btn-primary" style="width:100%;max-width:18rem;justify-content:center;white-space:nowrap" ' + (!canClose ? 'disabled' : '') + '>' +
              '<i class="fa-solid fa-lock"></i> ' + (state.existingClose ? 'Actualizar cierre del mes' : 'Cerrar mes contable') +
            '</button>' +
          '</div>' +
        '</div>';
    } else {
      var existingCierresSearch = container.querySelector('#cierres-search-input');
      var existingCierresTbody = container.querySelector('#cierres-table-body');
      if (existingCierresSearch && existingCierresTbody && document.activeElement === existingCierresSearch) {
        existingCierresTbody.innerHTML = closeRowsHtml;
        existingCierresTbody.querySelectorAll('[data-jump-month]').forEach(function (row) {
          row.addEventListener('click', function () {
            window.AppActions.selectMonthAndResumen(row.getAttribute('data-jump-month'));
          });
        });
        return;
      }

      container.innerHTML =
        '<h2 class="section-title-upper" style="margin:0 0 0.85rem">Historial de Meses Cerrados</h2>' +
        '<div class="movimientos-toolbar" style="margin-bottom:0.85rem">' +
          '<div class="search-box" style="margin-left:auto">' +
            '<i class="fa-solid fa-magnifying-glass"></i>' +
            '<input type="text" id="cierres-search-input" class="input" placeholder="Buscar por mes, notas o valores..." value="' + esc(state.cierresSearchTerm || '') + '" />' +
          '</div>' +
        '</div>' +
        '<section class="card" style="padding:0;overflow:hidden">' +
          historyHtml +
        '</section>';

      var cierresSearchInp = document.getElementById('cierres-search-input');
      if (cierresSearchInp) {
        cierresSearchInp.addEventListener('input', function (e) {
          window.AppActions.setCierresSearchTerm(e.target.value);
        });
      }
    }

    var notesInput = document.getElementById('close-notes-input');
    if (notesInput) {
      notesInput.addEventListener('input', function (e) {
        window.AppActions.setCloseNotes(e.target.value);
        var len = String(e.target.value || '').trim().length;
        var ok = len > 10;
        var btn = document.getElementById('btn-close-month');
        if (btn) btn.disabled = !ok;
        var hint = document.getElementById('close-notes-hint');
        if (hint) {
          hint.style.color = ok ? 'var(--emerald)' : 'var(--text-muted)';
          hint.textContent = ok
            ? 'Observaciones válidas (' + len + ' caracteres).'
            : 'Ingresa más de 10 caracteres en observaciones para cerrar el mes (' + len + ' / 11).';
        }
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

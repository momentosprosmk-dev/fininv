(function () {
  function downloadClosesCsv(closes, currency) {
    var headers = ['Mes', 'Ingresos (' + currency + ')', 'Consumo', 'Inversion', 'Liquidez Final', 'Deuda TC', 'Resultado TC', 'Notas'];
    var csvCell = function (val) {
      var s = String(val == null ? '' : val).replace(/"/g, '""');
      return '"' + s + '"';
    };
    var lines = [headers.map(csvCell).join(',')];
    (closes || []).forEach(function (c) {
      lines.push([
        c.month || '',
        Number(c.totalIncome || 0),
        Number(c.totalConsumptionExpense || 0),
        Number(c.totalArqInvestment || 0),
        Number(c.liquidityTotal || 0),
        Number(c.ccDebt || 0),
        Number(c.ccSurplusOrDeficit || 0),
        c.notes || '',
      ].map(csvCell).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'fininv-cierres-mensuales.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function buildClosesTrendHtml(closes, fmt, esc, hide, mCOP) {
    if (!closes || closes.length < 2) return '';
    var sortedAsc = closes.slice().sort(function (a, b) {
      return String(a.month || '').localeCompare(String(b.month || ''));
    });
    var recent = sortedAsc.slice(-6);
    var latest = recent[recent.length - 1];
    var prev = recent[recent.length - 2];

    var deltaBadge = function (curVal, prevVal, invertGood) {
      if (hide) return '<span class="text-dim" style="font-size:0.72rem">•••</span>';
      var diff = Number(curVal || 0) - Number(prevVal || 0);
      if (diff === 0) return '<span class="text-dim" style="font-size:0.72rem">Sin cambio</span>';
      var isPos = diff > 0;
      var good = invertGood ? !isPos : isPos;
      var cls = good ? 'text-emerald' : 'text-rose';
      var arrow = isPos ? '▲' : '▼';
      return '<span class="' + cls + '" style="font-size:0.72rem;font-weight:600">' + arrow + ' ' + (isPos ? '+' : '-') + esc(mCOP(Math.abs(diff))) + '</span>';
    };

    var maxFlow = 1;
    recent.forEach(function (c) {
      maxFlow = Math.max(maxFlow, Number(c.totalIncome || 0), Number(c.totalConsumptionExpense || 0), Number(c.liquidityTotal || 0));
    });

    var barsHtml = recent.map(function (c) {
      var incPct = Math.round((Math.max(0, Number(c.totalIncome || 0)) / maxFlow) * 100);
      var expPct = Math.round((Math.max(0, Number(c.totalConsumptionExpense || 0)) / maxFlow) * 100);
      var invPct = Math.round((Math.max(0, Number(c.totalArqInvestment || 0)) / maxFlow) * 100);
      var shortMonth = String(c.month || '');
      return (
        '<div style="flex:1 1 0;min-width:3.2rem;display:flex;flex-direction:column;align-items:center;gap:0.35rem">' +
          '<div style="height:4.5rem;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:0 0.25rem;border-bottom:1px solid var(--border-subtle)">' +
            '<span title="Ingresos: ' + esc(mCOP(c.totalIncome)) + '" style="width:8px;border-radius:3px 3px 0 0;background:var(--emerald);height:' + Math.max(4, incPct) + '%"></span>' +
            '<span title="Consumo: ' + esc(mCOP(c.totalConsumptionExpense)) + '" style="width:8px;border-radius:3px 3px 0 0;background:var(--rose);height:' + Math.max(4, expPct) + '%"></span>' +
            '<span title="Inversión: ' + esc(mCOP(c.totalArqInvestment)) + '" style="width:8px;border-radius:3px 3px 0 0;background:#a78bfa;height:' + Math.max(4, invPct) + '%"></span>' +
          '</div>' +
          '<span style="font-size:0.7rem;color:var(--text-muted);font-weight:600">' + esc(shortMonth) + '</span>' +
        '</div>'
      );
    }).join('');

    return (
      '<section class="card" style="margin-bottom:1rem">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem">' +
          '<div>' +
            '<h3 class="section-title" style="font-size:0.95rem;margin:0">Comparativa: ' + esc(fmt.formatMonthLabel(latest.month)) + ' vs ' + esc(fmt.formatMonthLabel(prev.month)) + '</h3>' +
            '<p class="text-muted" style="font-size:0.75rem;margin:0.15rem 0 0">Tendencia de tus últimos ' + recent.length + ' meses cerrados.</p>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.75rem;font-size:0.72rem;color:var(--text-muted)">' +
            '<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--emerald);margin-right:4px"></span>Ingresos</span>' +
            '<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--rose);margin-right:4px"></span>Consumo</span>' +
            '<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#a78bfa;margin-right:4px"></span>Inversión</span>' +
          '</div>' +
        '</div>' +
        '<div class="cierre-summary-grid" style="margin-bottom:0.9rem">' +
          '<div class="cierre-stat"><p class="cierre-stat-label">Ingresos</p><p class="cierre-stat-val text-emerald tabular">' + esc(mCOP(latest.totalIncome)) + '</p>' + deltaBadge(latest.totalIncome, prev.totalIncome, false) + '</div>' +
          '<div class="cierre-stat"><p class="cierre-stat-label">Consumo</p><p class="cierre-stat-val text-rose tabular">' + esc(mCOP(latest.totalConsumptionExpense)) + '</p>' + deltaBadge(latest.totalConsumptionExpense, prev.totalConsumptionExpense, true) + '</div>' +
          '<div class="cierre-stat"><p class="cierre-stat-label">Inversión</p><p class="cierre-stat-val text-violet tabular">' + esc(mCOP(latest.totalArqInvestment)) + '</p>' + deltaBadge(latest.totalArqInvestment, prev.totalArqInvestment, false) + '</div>' +
          '<div class="cierre-stat"><p class="cierre-stat-label">Liquidez Final</p><p class="cierre-stat-val tabular" style="color:var(--text-strong)">' + esc(mCOP(latest.liquidityTotal)) + '</p>' + deltaBadge(latest.liquidityTotal, prev.liquidityTotal, false) + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:flex-end;gap:0.4rem;overflow-x:auto;padding-top:0.25rem">' + barsHtml + '</div>' +
      '</section>'
    );
  }

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
        '<div class="view-sticky-header">' +
          '<h2 class="section-title-upper" style="margin:0">Cerrar Mes Contable</h2>' +
        '</div>' +
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
      container._csvCloses = filteredCloses;
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

      var trendHtml = buildClosesTrendHtml(closes, fmt, esc, hide, mCOP);

      container.innerHTML =
        '<div class="view-sticky-header">' +
          '<h2 class="section-title-upper" style="margin:0">Historial de Meses Cerrados</h2>' +
          '<div class="movimientos-toolbar">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;margin-left:auto;flex-wrap:wrap">' +
              '<div class="search-box">' +
                '<i class="fa-solid fa-magnifying-glass"></i>' +
                '<input type="text" id="cierres-search-input" class="input" placeholder="Buscar por mes, notas o valores..." value="' + esc(state.cierresSearchTerm || '') + '" />' +
              '</div>' +
              '<button type="button" id="btn-export-cierres-csv" class="btn btn-secondary" style="padding:0.42rem 0.7rem;font-size:0.78rem;white-space:nowrap" title="Exportar cierres a CSV">' +
                '<i class="fa-solid fa-file-csv"></i> CSV' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        trendHtml +
        '<section class="card" style="padding:0;overflow:hidden">' +
          historyHtml +
        '</section>';

      var cierresSearchInp = document.getElementById('cierres-search-input');
      if (cierresSearchInp) {
        cierresSearchInp.addEventListener('input', function (e) {
          window.AppActions.setCierresSearchTerm(e.target.value);
        });
      }

      var cierresCsvBtn = document.getElementById('btn-export-cierres-csv');
      if (cierresCsvBtn) {
        cierresCsvBtn.addEventListener('click', function () {
          downloadClosesCsv(container._csvCloses || [], fmt.getBaseCurrency());
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

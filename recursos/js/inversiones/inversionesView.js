(function () {
  function renderInversionesView(state) {
    var container = document.getElementById('view-inversiones');
    if (!container) return;

    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var inv = window.AppInvestments;
    var hide = Boolean(state.hideValues);
    var mCOP = function (v) { return fmt.maskCOP(v, hide); };
    var mCur = function (v, cur) { return fmt.maskCurrency(v, cur, hide); };

    var invSummary = state.investmentSummary;
    var legacyArq = inv.findUnimportedLegacyArqMovements(state.data);
    var rates = state.data.exchangeRates || {};
    var usdRate = rates.USD || { live: 4300, custom: null, updatedAt: null };
    var activeUsdRate = inv.getEffectiveRate('USD', rates);

    var legacyBanner = legacyArq.length > 0
      ? '<div class="alert-banner alert-indigo" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:0">' +
          '<span>Detectamos <strong>' + legacyArq.length + '</strong> movimiento(s) históricos de <strong>ARQ</strong> en Control Financiero que aún no están en tu portafolio de Inversiones.</span>' +
          '<button type="button" id="btn-import-legacy-arq" class="btn btn-primary" style="padding:0.4rem 0.85rem;font-size:0.75rem">Importar historial ARQ</button>' +
        '</div>'
      : '';

    // Barra superior
    var topBarHtml =
      '<div class="inv-top-bar">' +
        '<div>' +
          '<h2 class="section-title-upper" style="margin-bottom:0.2rem">Módulo de Inversiones</h2>' +
          '<p class="text-muted" style="margin:0;font-size:0.9rem">Fondos simples (BBVA, CDT) y fragmentados (ARQ, acciones) con soporte multi-moneda.</p>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">' +
          '<button type="button" id="btn-inv-new-fund" class="btn btn-secondary"><i class="fa-solid fa-folder-plus"></i> Nueva Cuenta</button>' +
          '<button type="button" id="btn-inv-new-op" class="btn btn-primary" ' + (invSummary.fundSummaries.length === 0 ? 'disabled' : '') + '><i class="fa-solid fa-right-left"></i> Registrar Operación</button>' +
        '</div>' +
      '</div>';

    // Barra de tasa USD/COP
    var fxBarHtml =
      '<div class="inv-fx-bar">' +
        '<div>' +
          '<span style="font-size:0.92rem;font-weight:600;color:var(--text-strong)"><i class="fa-solid fa-dollar-sign text-emerald"></i> Tasa USD / ' + esc(fmt.getBaseCurrency()) + ' activa: ' + esc(fmt.formatCOP(activeUsdRate)) + '</span>' +
          '<p class="text-muted" style="margin:0.15rem 0 0;font-size:0.84rem">En vivo: ' + esc(fmt.formatCOP(usdRate.live || 4300)) + (usdRate.custom ? ' &middot; Personalizada activa' : ' &middot; Usando tasa en vivo') + '</p>' +
        '</div>' +
        '<div class="inv-fx-controls">' +
          '<input type="text" inputmode="decimal" id="inv-custom-usd" class="input" style="width:10.5rem;padding:0.45rem 0.7rem;font-size:0.88rem" placeholder="Tasa manual (ARQ)" value="' + esc(usdRate.custom ? String(usdRate.custom) : '') + '" />' +
          '<button type="button" id="btn-save-custom-usd" class="btn btn-secondary" style="padding:0.46rem 0.8rem;font-size:0.85rem">Aplicar</button>' +
          '<button type="button" id="btn-fetch-fx" class="btn btn-secondary" style="padding:0.46rem 0.8rem;font-size:0.85rem"><i class="fa-solid fa-rotate"></i> TRM en vivo</button>' +
        '</div>' +
      '</div>';

    // KPIs globales en COP
    var gainPos = invSummary.totalGainLossCOP >= 0;
    var kpisHtml =
      '<section class="kpi-grid">' +
        '<div class="kpi-card"><div class="kpi-label text-sky"><i class="fa-solid fa-sack-dollar"></i> Capital Total Invertido</div><p class="kpi-value tabular">' + esc(mCOP(invSummary.totalPortfolioCOP)) + '</p></div>' +
        '<div class="kpi-card"><div class="kpi-label text-emerald"><i class="fa-solid fa-arrow-trend-up"></i> Total Aportado</div><p class="kpi-value tabular">' + esc(mCOP(invSummary.totalAportadoCOP)) + '</p></div>' +
        '<div class="kpi-card"><div class="kpi-label text-amber"><i class="fa-solid fa-arrow-trend-down"></i> Total Retirado</div><p class="kpi-value tabular">' + esc(mCOP(invSummary.totalRetiradoCOP)) + '</p></div>' +
        '<div class="kpi-card"><div class="kpi-label ' + (gainPos ? 'text-emerald' : 'text-rose') + '"><i class="fa-solid fa-chart-line"></i> Ganancia / Pérdida Neta</div><p class="kpi-value tabular ' + (gainPos ? 'text-emerald' : 'text-rose') + '">' + (hide ? '' : (gainPos ? '+' : '')) + esc(mCOP(invSummary.totalGainLossCOP)) + '</p></div>' +
      '</section>';

    // Tarjetas de fondos
    var fundsHtml = invSummary.fundSummaries.length === 0
      ? '<div class="card" style="text-align:center;padding:2.5rem 1rem">' +
          '<p class="text-muted" style="margin:0 0 0.85rem">Aún no tienes cuentas de inversión creadas (ej. ARQ, Fondo BBVA, Cajita Nu).</p>' +
          '<button type="button" id="btn-empty-new-fund" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Crear primera cuenta de inversión</button>' +
        '</div>'
      : '<div class="inv-funds-grid">' + invSummary.fundSummaries.map(function (f) {
          var acc = f.account;
          var cur = f.currency;
          var isFrag = f.mode === 'fragmentado';
          var fGainPos = f.gainLoss >= 0;
          var pctStr = (f.gainLoss >= 0 ? '+' : '') + f.gainLossPct.toFixed(1) + '%';

          var goalHtml = '';
          if (acc.goal > 0) {
            var goalPct = Math.min(100, Math.max(0, Math.round((f.totalValue / acc.goal) * 100)));
            goalHtml =
              '<div>' +
                '<div class="credit-meta" style="color:var(--text-muted)"><span>Meta: ' + esc(mCur(acc.goal, cur)) + '</span><span>' + goalPct + '%</span></div>' +
                '<div class="progress-track"><div class="progress-fill" style="width:' + goalPct + '%;background:var(--indigo)"></div></div>' +
              '</div>';
          }

          var subsHtml = '';
          if (isFrag) {
            var subRows = f.subSummaries.length === 0
              ? '<p class="text-dim" style="margin:0;font-size:0.85rem">Sin sub-inversiones aún. Crea posiciones como Microsoft, Apple o ETFs.</p>'
              : f.subSummaries.map(function (s) {
                  var sPos = s.gainLoss >= 0;
                  var isDelSub = state.pendingDeleteSubId === s.sub.id;
                  var delSubCtrl = isDelSub
                    ? '<div class="inline-confirm"><span class="text-rose">¿Eliminar?</span><button type="button" class="inline-confirm-btn no" data-cancel-del-sub="' + esc(s.sub.id) + '">No</button><button type="button" class="inline-confirm-btn yes" data-confirm-del-sub="' + esc(s.sub.id) + '">Sí</button></div>'
                    : '<button type="button" class="icon-delete-btn" data-ask-del-sub="' + esc(s.sub.id) + '" title="Eliminar sub-inversión"><i class="fa-regular fa-trash-can"></i></button>';

                  return (
                    '<div class="inv-sub-item">' +
                      '<div>' +
                        '<p class="obligation-name" style="font-size:0.92rem">' + esc(s.sub.name) + '</p>' +
                        '<p class="obligation-sub tabular">' +
                          'Actual: <strong style="color:var(--text-strong)">' + esc(mCur(s.currentValue, cur)) + '</strong>' +
                          ' &middot; Inv: ' + esc(mCur(s.netInvested, cur)) +
                          ' &middot; <span class="' + (sPos ? 'text-emerald' : 'text-rose') + '">' + (hide ? '' : (sPos ? '+' : '') + esc(mCur(s.gainLoss, cur)) + ' (' + s.gainLossPct.toFixed(1) + '%)') + '</span>' +
                        '</p>' +
                      '</div>' +
                      '<div style="display:flex;align-items:center;gap:0.35rem">' +
                        '<button type="button" class="btn btn-secondary btn-sub-update" data-fund="' + esc(acc.name) + '" data-sub="' + esc(s.sub.name) + '" style="padding:0.25rem 0.5rem;font-size:0.7rem" title="Actualizar valor actual"><i class="fa-solid fa-chart-line"></i> Valor</button>' +
                        '<button type="button" class="btn btn-secondary btn-sub-assign" data-fund="' + esc(acc.name) + '" data-sub="' + esc(s.sub.name) + '" style="padding:0.25rem 0.5rem;font-size:0.7rem">+ Invertir</button>' +
                        '<button type="button" class="btn btn-secondary btn-sub-release" data-fund="' + esc(acc.name) + '" data-sub="' + esc(s.sub.name) + '" style="padding:0.25rem 0.5rem;font-size:0.7rem">Liberar</button>' +
                        delSubCtrl +
                      '</div>' +
                    '</div>'
                  );
                }).join('');

            subsHtml =
              '<div class="inv-subs-box">' +
                '<div style="display:flex;align-items:center;justify-content:space-between">' +
                  '<span style="font-size:0.85rem;font-weight:600;color:var(--text-soft)">Sub-inversiones (' + f.subSummaries.length + ')</span>' +
                  '<button type="button" class="link-btn btn-add-sub" data-fund="' + esc(acc.name) + '" data-cur="' + esc(cur) + '">+ Nueva sub-inversión</button>' +
                '</div>' +
                subRows +
              '</div>';
          }

          var isDelFund = state.pendingDeleteFundId === acc.id;
          var delFundCtrl = isDelFund
            ? '<div class="inline-confirm"><span class="text-rose">¿Eliminar fondo?</span><button type="button" class="inline-confirm-btn no" data-cancel-del-fund="' + esc(acc.id) + '">No</button><button type="button" class="inline-confirm-btn yes" data-confirm-del-fund="' + esc(acc.id) + '">Sí</button></div>'
            : '<button type="button" class="icon-delete-btn" data-ask-del-fund="' + esc(acc.id) + '" title="Eliminar cuenta"><i class="fa-regular fa-trash-can"></i></button>';

          return (
            '<div class="inv-fund-card">' +
              '<div class="inv-fund-head">' +
                '<div>' +
                  '<h3 class="inv-fund-title">' + esc(acc.name) + '</h3>' +
                  '<div class="inv-fund-meta">' +
                    '<span class="badge ' + (isFrag ? 'badge-violet' : 'badge-sky') + '">' + (isFrag ? 'Fragmentado' : 'Simple') + '</span>' +
                    '<span class="badge badge-emerald">' + esc(cur) + '</span>' +
                  '</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:0.25rem">' +
                  '<button type="button" class="icon-delete-btn btn-edit-fund" data-fund-id="' + esc(acc.id) + '" title="Editar cuenta"><i class="fa-regular fa-pen-to-square"></i></button>' +
                  delFundCtrl +
                '</div>' +
              '</div>' +
              '<div>' +
                '<p class="inv-fund-balance tabular">' + esc(mCur(f.totalValue, cur)) + '</p>' +
                (cur !== 'COP' ? '<p class="inv-fund-subval tabular">&approx; ' + esc(mCOP(f.totalValueCOP)) + ' COP</p>' : '') +
              '</div>' +
              '<div class="inv-stats-row">' +
                (isFrag
                  ? '<div class="inv-mini-stat"><p class="inv-mini-label">Por invertir (Disp.)</p><p class="inv-mini-val tabular text-sky">' + esc(mCur(f.availableCash, cur)) + '</p></div>' +
                    '<div class="inv-mini-stat"><p class="inv-mini-label">En sub-inversiones</p><p class="inv-mini-val tabular">' + esc(mCur(f.investedInSubs, cur)) + '</p></div>'
                  : '<div class="inv-mini-stat"><p class="inv-mini-label">Aportado neto</p><p class="inv-mini-val tabular">' + esc(mCur(f.netContributed, cur)) + '</p></div>' +
                    '<div class="inv-mini-stat"><p class="inv-mini-label">Comisiones</p><p class="inv-mini-val tabular text-amber">' + esc(mCur(f.totalComisiones, cur)) + '</p></div>') +
                '<div class="inv-mini-stat"><p class="inv-mini-label">Ganancia / Pérdida</p><p class="inv-mini-val tabular ' + (fGainPos ? 'text-emerald' : 'text-rose') + '">' + (hide ? '' : (fGainPos ? '+' : '') + esc(mCur(f.gainLoss, cur)) + ' (' + pctStr + ')') + '</p></div>' +
              '</div>' +
              goalHtml +
              '<div class="inv-actions-row">' +
                '<button type="button" class="btn btn-secondary btn-fund-op" data-op="Aporte" data-fund="' + esc(acc.name) + '"><i class="fa-solid fa-plus"></i> Aportar</button>' +
                '<button type="button" class="btn btn-secondary btn-fund-op" data-op="Retiro" data-fund="' + esc(acc.name) + '"><i class="fa-solid fa-arrow-up-right-from-square"></i> Retirar</button>' +
                (!isFrag ? '<button type="button" class="btn btn-secondary btn-fund-update" data-fund="' + esc(acc.name) + '"><i class="fa-solid fa-chart-line"></i> Actualizar valor</button>' : '') +
              '</div>' +
              subsHtml +
            '</div>'
          );
        }).join('') + '</div>';

    // Si estamos en la pestaña Movimientos de Inversiones
    if (state.invActiveTab === 'movimientos') {
      var fundNames = ['Todas'].concat((state.data.investmentAccounts || []).map(function (a) { return a.name; }));
      var curFundFilter = state.invFilterFund || 'Todas';
      var curTypeFilter = state.invFilterType || 'Todos';
      var curSearch = state.invSearchTerm || '';

      var fundOptsHtml = fundNames.map(function (fn) {
        return '<option value="' + esc(fn) + '" ' + (curFundFilter === fn ? 'selected' : '') + '>' + (fn === 'Todas' ? 'Cuenta: Todas' : esc(fn)) + '</option>';
      }).join('');

      var invTypes = ['Todos', 'Aporte', 'Retiro', 'Rendimiento', 'AsignarSub', 'LiberarSub', 'TraspasoInv'];
      var typeOptsHtml = invTypes.map(function (t) {
        return '<option value="' + esc(t) + '" ' + (curTypeFilter === t ? 'selected' : '') + '>Tipo: ' + esc(t) + '</option>';
      }).join('');

      var filteredMovs = (state.data.investmentMovements || [])
        .filter(function (m) {
          if (curFundFilter !== 'Todas' && m.fundName !== curFundFilter && m.normalAccount !== curFundFilter) return false;
          if (curTypeFilter !== 'Todos' && m.type !== curTypeFilter) return false;
          if (curSearch.trim()) {
            var q = curSearch.toLowerCase();
            return (
              String(m.fundName || '').toLowerCase().indexOf(q) !== -1 ||
              String(m.subName || '').toLowerCase().indexOf(q) !== -1 ||
              String(m.normalAccount || '').toLowerCase().indexOf(q) !== -1 ||
              String(m.description || '').toLowerCase().indexOf(q) !== -1
            );
          }
          return true;
        })
        .sort(function (a, b) {
          return String(b.date || '').localeCompare(String(a.date || '')) ||
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });

      var movRows = filteredMovs.length === 0
        ? '<tr><td colspan="6" class="text-dim" style="text-align:center;padding:2.5rem 1rem">No hay operaciones de inversión con estos filtros.</td></tr>'
        : filteredMovs.map(function (m) {
            var fundObj = (state.data.investmentAccounts || []).find(function (a) { return a.name === m.fundName; });
            var cur = fundObj ? fundObj.currency : 'COP';
            var isDel = state.pendingDeleteInvMovId === m.id;
            var delCell = isDel
              ? '<div class="inline-confirm"><span class="text-rose">¿Eliminar?</span><button type="button" class="inline-confirm-btn no" data-cancel-del-im="' + esc(m.id) + '">No</button><button type="button" class="inline-confirm-btn yes" data-confirm-del-im="' + esc(m.id) + '">Sí</button></div>'
              : '<button type="button" class="icon-delete-btn" data-ask-del-im="' + esc(m.id) + '" title="Eliminar operación"><i class="fa-regular fa-trash-can"></i></button>';

            var detail = m.fundName + (m.subName ? ' → ' + m.subName : '') + (m.normalAccount ? ' (' + m.normalAccount + ')' : '');
            return (
              '<tr>' +
                '<td class="text-muted" style="white-space:nowrap">' + esc(m.date) + '</td>' +
                '<td><span class="badge badge-sky">' + esc(m.type) + '</span></td>' +
                '<td style="color:var(--text-strong);font-weight:500">' + esc(detail) + '</td>' +
                '<td class="text-muted">' + esc(m.description || '—') + '</td>' +
                '<td class="text-right tabular" style="font-weight:600;color:var(--text-strong);white-space:nowrap">' + esc(mCur(m.amount, cur)) + (m.commission > 0 ? '<br/><span class="text-amber" style="font-size:0.7rem">Com: ' + esc(mCur(m.commission, cur)) + '</span>' : '') + '</td>' +
                '<td class="text-right">' + delCell + '</td>' +
              '</tr>'
            );
          }).join('');

      container.innerHTML =
        '<div class="inv-top-bar">' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">' +
            '<select id="inv-mov-fund-filter" class="select" style="width:auto;padding:0.42rem 0.65rem;font-size:0.78rem">' + fundOptsHtml + '</select>' +
            '<select id="inv-mov-type-filter" class="select" style="width:auto;padding:0.42rem 0.65rem;font-size:0.78rem">' + typeOptsHtml + '</select>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">' +
            '<div class="search-box" style="width:14rem">' +
              '<i class="fa-solid fa-magnifying-glass"></i>' +
              '<input type="text" id="inv-mov-search" class="input" placeholder="Buscar fondo o detalle..." value="' + esc(curSearch) + '" />' +
            '</div>' +
            '<button type="button" id="btn-inv-new-op-tab" class="btn btn-primary" ' + (invSummary.fundSummaries.length === 0 ? 'disabled' : '') + '><i class="fa-solid fa-plus"></i> Operación</button>' +
          '</div>' +
        '</div>' +
        '<div class="table-wrap">' +
          '<table class="data-table">' +
            '<thead><tr><th>Fecha</th><th>Tipo</th><th>Fondo / Activo</th><th>Descripción</th><th class="text-right">Monto</th><th class="text-right">Acción</th></tr></thead>' +
            '<tbody>' + movRows + '</tbody>' +
          '</table>' +
        '</div>';

      document.getElementById('inv-mov-fund-filter').addEventListener('change', function (e) {
        window.AppActions.setInvFilterFund(e.target.value);
      });
      document.getElementById('inv-mov-type-filter').addEventListener('change', function (e) {
        window.AppActions.setInvFilterType(e.target.value);
      });
      var invSearchInp = document.getElementById('inv-mov-search');
      invSearchInp.addEventListener('input', function (e) {
        var pos = e.target.selectionStart;
        window.AppActions.setInvSearchTerm(e.target.value);
        var el = document.getElementById('inv-mov-search');
        if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (err) {} }
      });
      var newOpTabBtn = document.getElementById('btn-inv-new-op-tab');
      if (newOpTabBtn) newOpTabBtn.addEventListener('click', function () { window.AppActions.openInvOpModal({}); });

      container.querySelectorAll('[data-ask-del-im]').forEach(function (b) {
        b.addEventListener('click', function () { window.AppActions.askDeleteInvMov(b.getAttribute('data-ask-del-im')); });
      });
      container.querySelectorAll('[data-cancel-del-im]').forEach(function (b) {
        b.addEventListener('click', function () { window.AppActions.askDeleteInvMov(null); });
      });
      container.querySelectorAll('[data-confirm-del-im]').forEach(function (b) {
        b.addEventListener('click', function () { window.AppActions.deleteInvMov(b.getAttribute('data-confirm-del-im')); });
      });
      return;
    }

    container.innerHTML = topBarHtml + legacyBanner + fxBarHtml + kpisHtml + fundsHtml;

    // Bind events
    var openNewFund = function () { window.AppActions.openInvAccountModal(null); };
    document.getElementById('btn-inv-new-fund').addEventListener('click', openNewFund);
    var emptyBtn = document.getElementById('btn-empty-new-fund');
    if (emptyBtn) emptyBtn.addEventListener('click', openNewFund);

    var newOpBtn = document.getElementById('btn-inv-new-op');
    if (newOpBtn) newOpBtn.addEventListener('click', function () { window.AppActions.openInvOpModal({}); });

    var importBtn = document.getElementById('btn-import-legacy-arq');
    if (importBtn) importBtn.addEventListener('click', function () { window.AppActions.importLegacyArq(); });

    document.getElementById('btn-fetch-fx').addEventListener('click', function () { window.AppActions.refreshLiveFx(); });
    document.getElementById('btn-save-custom-usd').addEventListener('click', function () {
      var val = document.getElementById('inv-custom-usd').value;
      window.AppActions.setCustomFxRate('USD', val);
    });

    container.querySelectorAll('.btn-edit-fund').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-fund-id');
        var acc = (state.data.investmentAccounts || []).find(function (a) { return a.id === id; });
        if (acc) window.AppActions.openInvAccountModal(acc);
      });
    });

    container.querySelectorAll('.btn-fund-op').forEach(function (b) {
      b.addEventListener('click', function () {
        window.AppActions.openInvOpModal({
          initialType: b.getAttribute('data-op'),
          initialFund: b.getAttribute('data-fund'),
        });
      });
    });

    container.querySelectorAll('.btn-fund-update').forEach(function (b) {
      b.addEventListener('click', function () {
        window.AppActions.openUpdateValue(b.getAttribute('data-fund'), '');
      });
    });

    container.querySelectorAll('.btn-add-sub').forEach(function (b) {
      b.addEventListener('click', function () {
        window.AppActions.openSubModal(b.getAttribute('data-fund'), b.getAttribute('data-cur'));
      });
    });

    container.querySelectorAll('.btn-sub-update').forEach(function (b) {
      b.addEventListener('click', function () {
        window.AppActions.openUpdateValue(b.getAttribute('data-fund'), b.getAttribute('data-sub'));
      });
    });

    container.querySelectorAll('.btn-sub-assign').forEach(function (b) {
      b.addEventListener('click', function () {
        window.AppActions.openInvOpModal({
          initialType: 'AsignarSub',
          initialFund: b.getAttribute('data-fund'),
          initialSub: b.getAttribute('data-sub'),
        });
      });
    });

    container.querySelectorAll('.btn-sub-release').forEach(function (b) {
      b.addEventListener('click', function () {
        window.AppActions.openInvOpModal({
          initialType: 'LiberarSub',
          initialFund: b.getAttribute('data-fund'),
          initialSub: b.getAttribute('data-sub'),
        });
      });
    });

    // Inline deletes
    container.querySelectorAll('[data-ask-del-fund]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.askDeleteInvFund(b.getAttribute('data-ask-del-fund')); });
    });
    container.querySelectorAll('[data-cancel-del-fund]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.askDeleteInvFund(null); });
    });
    container.querySelectorAll('[data-confirm-del-fund]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.deleteInvFund(b.getAttribute('data-confirm-del-fund')); });
    });

    container.querySelectorAll('[data-ask-del-sub]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.askDeleteSub(b.getAttribute('data-ask-del-sub')); });
    });
    container.querySelectorAll('[data-cancel-del-sub]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.askDeleteSub(null); });
    });
    container.querySelectorAll('[data-confirm-del-sub]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.deleteSub(b.getAttribute('data-confirm-del-sub')); });
    });

    container.querySelectorAll('[data-ask-del-im]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.askDeleteInvMov(b.getAttribute('data-ask-del-im')); });
    });
    container.querySelectorAll('[data-cancel-del-im]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.askDeleteInvMov(null); });
    });
    container.querySelectorAll('[data-confirm-del-im]').forEach(function (b) {
      b.addEventListener('click', function () { window.AppActions.deleteInvMov(b.getAttribute('data-confirm-del-im')); });
    });
  }

  window.renderInversionesView = renderInversionesView;
})();

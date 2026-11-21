(function () {
  function typeBadgeClass(type) {
    if (type === 'Ingreso') return 'badge-emerald';
    if (type === 'Egreso') return 'badge-rose';
    return 'badge-sky';
  }

  function renderMovimientosView(state) {
    var container = document.getElementById('view-movimientos');
    if (!container) return;

    var esc = window.escapeHTML;
    var fmt = window.AppFormat;
    var hide = Boolean(state.hideValues);
    var mCOP = function (v) { return fmt.maskCOP(v, hide); };
    var filterTypes = ['Todos', 'Ingreso', 'Egreso', 'Traspaso'];

    var pillsHtml = filterTypes.map(function (t) {
      var active = state.filterType === t ? 'active' : '';
      return '<button type="button" class="filter-pill ' + active + '" data-filter="' + t + '">' + t + '</button>';
    }).join('');

    var rowsHtml = state.monthMovements.length === 0
      ? '<tr><td colspan="7" class="text-dim" style="text-align:center;padding:2.5rem 1rem">No hay movimientos registrados con estos filtros.</td></tr>'
      : state.monthMovements.map(function (m) {
          var isConfirming = state.pendingDeleteMovementId === m.id;
          var actionCell = isConfirming
            ? '<div class="inline-confirm">' +
                '<span class="text-rose" style="font-weight:500">¿Eliminar?</span>' +
                '<button type="button" class="inline-confirm-btn no" data-cancel-del="' + esc(m.id) + '">No</button>' +
                '<button type="button" class="inline-confirm-btn yes" data-confirm-del="' + esc(m.id) + '">Sí</button>' +
              '</div>'
            : '<button type="button" class="icon-delete-btn" data-ask-del="' + esc(m.id) + '" title="Eliminar movimiento"><i class="fa-regular fa-trash-can"></i></button>';

          var amountClass = m.type === 'Ingreso' ? 'text-emerald' : (m.type === 'Egreso' ? 'text-rose' : 'text-sky');
          var prefix = m.type === 'Ingreso' ? '+' : (m.type === 'Egreso' ? '-' : '');

          return (
            '<tr>' +
              '<td class="text-muted" style="white-space:nowrap">' + esc(m.date) + '</td>' +
              '<td><span class="badge ' + typeBadgeClass(m.type) + '">' + esc(m.type) + '</span></td>' +
              '<td style="font-weight:500;color:var(--text-strong)">' + esc(m.category) + '</td>' +
              '<td class="text-muted">' + esc(m.description) + '</td>' +
              '<td class="text-muted" style="font-size:0.75rem;white-space:nowrap">' + esc(m.fromAccount) + ' &rarr; ' + esc(m.toAccount) + '</td>' +
              '<td class="text-right tabular ' + amountClass + '" style="font-weight:600;white-space:nowrap">' + (hide ? '' : prefix) + esc(mCOP(m.amount)) + '</td>' +
              '<td class="text-right">' + actionCell + '</td>' +
            '</tr>'
          );
        }).join('');

    function bindRowDeleteActions(scope) {
      scope.querySelectorAll('[data-ask-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          window.AppActions.askDeleteMovement(btn.getAttribute('data-ask-del'));
        });
      });

      scope.querySelectorAll('[data-cancel-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          window.AppActions.askDeleteMovement(null);
        });
      });

      scope.querySelectorAll('[data-confirm-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          window.AppActions.deleteMovement(btn.getAttribute('data-confirm-del'));
        });
      });
    }

    var existingInput = container.querySelector('#mov-search-input');
    var existingTbody = container.querySelector('#mov-table-body');
    if (existingInput && existingTbody) {
      existingTbody.innerHTML = rowsHtml;
      container.querySelectorAll('.filter-pill').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === state.filterType);
      });
      if (document.activeElement !== existingInput && existingInput.value !== (state.searchTerm || '')) {
        existingInput.value = state.searchTerm || '';
      }
      bindRowDeleteActions(existingTbody);
      return;
    }

    container.innerHTML =
      '<div class="view-sticky-header">' +
        '<h2 class="section-title-upper" style="margin:0">Historial de Movimientos</h2>' +
        '<div class="movimientos-toolbar">' +
          '<div class="filter-pills">' + pillsHtml + '</div>' +
          '<div class="search-box">' +
            '<i class="fa-solid fa-magnifying-glass"></i>' +
            '<input type="text" id="mov-search-input" class="input" placeholder="Buscar concepto, cuenta o detalle..." value="' + esc(state.searchTerm) + '" />' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Descripción</th><th>Flujo (Origen &rarr; Destino)</th><th class="text-right">Monto (' + esc(fmt.getBaseCurrency()) + ')</th><th class="text-right">Acción</th>' +
          '</tr></thead>' +
          '<tbody id="mov-table-body">' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';

    container.querySelectorAll('.filter-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.AppActions.setFilterType(btn.getAttribute('data-filter'));
      });
    });

    var searchInput = document.getElementById('mov-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        window.AppActions.setSearchTerm(e.target.value);
      });
    }

    bindRowDeleteActions(container);
  }

  window.renderMovimientosView = renderMovimientosView;
})();

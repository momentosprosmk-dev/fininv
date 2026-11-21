(function () {
  var WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

  function parseISO(iso) {
    var parts = String(iso || '').split('-').map(Number);
    if (!parts[0] || !parts[1] || !parts[2]) {
      var now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
    }
    return { year: parts[0], month: parts[1], day: parts[2] };
  }

  function formatReadableDate(iso) {
    var p = parseISO(iso);
    var date = new Date(p.year, p.month - 1, p.day);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  function createDatePicker(container, initialValue, onChange) {
    var value = initialValue || window.AppFormat.getTodayISO();
    var selected = parseISO(value);
    var viewYear = selected.year;
    var viewMonth = selected.month;
    var isOpen = false;

    function render() {
      var todayISO = window.AppFormat.getTodayISO();
      var firstDay = new Date(viewYear, viewMonth - 1, 1);
      var startOffset = (firstDay.getDay() + 6) % 7;
      var daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

      var monthLabel = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(firstDay);
      monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

      var cellsHtml = '';
      for (var i = 0; i < startOffset; i++) cellsHtml += '<span></span>';
      for (var d = 1; d <= daysInMonth; d++) {
        var iso = viewYear + '-' + String(viewMonth).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var cls = 'dp-day';
        if (iso === value) cls += ' selected';
        else if (iso === todayISO) cls += ' today';
        cellsHtml += '<button type="button" class="' + cls + '" data-dp-iso="' + iso + '">' + d + '</button>';
      }

      var weekdaysHtml = WEEKDAYS.map(function (w) { return '<span class="dp-weekday">' + w + '</span>'; }).join('');

      container.innerHTML =
        '<div class="datepicker-wrap">' +
          '<button type="button" class="datepicker-trigger" id="dp-trigger">' +
            '<span>' + window.escapeHTML(formatReadableDate(value)) + '</span>' +
            '<i class="fa-regular fa-calendar" style="color:#818cf8"></i>' +
          '</button>' +
          (isOpen
            ? '<div class="datepicker-popover">' +
                '<div class="dp-head">' +
                  '<button type="button" class="dp-nav-btn" id="dp-prev" title="Mes anterior"><i class="fa-solid fa-chevron-left"></i></button>' +
                  '<span style="font-size:0.78rem;font-weight:600;color:var(--text-strong)">' + window.escapeHTML(monthLabel) + '</span>' +
                  '<button type="button" class="dp-nav-btn" id="dp-next" title="Mes siguiente"><i class="fa-solid fa-chevron-right"></i></button>' +
                '</div>' +
                '<div class="dp-grid">' + weekdaysHtml + '</div>' +
                '<div class="dp-grid" style="margin-top:0.25rem">' + cellsHtml + '</div>' +
                '<div class="dp-foot">' +
                  '<button type="button" class="link-btn" id="dp-today">Ir a hoy</button>' +
                  '<button type="button" class="link-btn" style="color:var(--text-muted)" id="dp-close">Cerrar</button>' +
                '</div>' +
              '</div>'
            : '') +
        '</div>';

      var trig = container.querySelector('#dp-trigger');
      if (trig) {
        trig.addEventListener('click', function () {
          if (!isOpen) {
            var s = parseISO(value);
            viewYear = s.year;
            viewMonth = s.month;
          }
          isOpen = !isOpen;
          render();
        });
      }

      var prevBtn = container.querySelector('#dp-prev');
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          if (viewMonth === 1) { viewYear--; viewMonth = 12; } else { viewMonth--; }
          render();
        });
      }

      var nextBtn = container.querySelector('#dp-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (viewMonth === 12) { viewYear++; viewMonth = 1; } else { viewMonth++; }
          render();
        });
      }

      container.querySelectorAll('[data-dp-iso]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          value = btn.getAttribute('data-dp-iso');
          isOpen = false;
          onChange(value);
          render();
        });
      });

      var todayBtn = container.querySelector('#dp-today');
      if (todayBtn) {
        todayBtn.addEventListener('click', function () {
          var tISO = window.AppFormat.getTodayISO();
          var t = parseISO(tISO);
          viewYear = t.year;
          viewMonth = t.month;
          value = tISO;
          isOpen = false;
          onChange(value);
          render();
        });
      }

      var closeBtn = container.querySelector('#dp-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          isOpen = false;
          render();
        });
      }
    }

    render();
  }

  window.createDatePicker = createDatePicker;
})();

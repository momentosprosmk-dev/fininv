(function () {
  var APPS_SCRIPT_URL_STORAGE = 'contabilidad_apps_script_url';
  var SHEET_WEB_URL_STORAGE = 'contabilidad_sheet_web_url';
  var AUTH_MODE_STORAGE = 'fininv_auth_mode';
  var AUTH_EMAIL_STORAGE = 'fininv_auth_email';
  var AUTH_USER_STORAGE = 'fininv_auth_user';
  var AUTH_PASS_HASH_STORAGE = 'fininv_auth_pass_hash';
  var THEME_STORAGE = 'contabilidad_theme';
  var HIDE_VALUES_STORAGE = 'contabilidad_hide_values';
  var PENDING_SYNC_STORAGE = 'contabilidad_pending_sync';

  var appState = {
    data: window.AppStorage.loadLocalData(),
    selectedMonth: window.AppFormat.getCurrentMonthKey(),
    activeModule: 'finanzas', // finanzas | inversiones
    activeTab: 'resumen',
    invActiveTab: 'resumen', // resumen | movimientos
    prestActiveTab: 'lista', // lista | estado | movimientos
    invFilterFund: 'Todas',
    invFilterType: 'Todos',
    invSearchTerm: '',
    filterType: 'Todos',
    searchTerm: '',
    pendingDeleteMovementId: null,
    pendingDeleteObligationId: null,
    pendingDeleteFundId: null,
    pendingDeleteSubId: null,
    pendingDeleteInvMovId: null,
    pendingDeleteLoanId: null,
    pendingDeleteLoanPayId: null,
    loanFilter: 'Todos',
    theme: localStorage.getItem(THEME_STORAGE) || 'dark',
    hideValues: localStorage.getItem(HIDE_VALUES_STORAGE) === 'true',
    closeNotes: '',
    scriptUrl: localStorage.getItem(APPS_SCRIPT_URL_STORAGE) || '',
    sheetWebUrl: localStorage.getItem(SHEET_WEB_URL_STORAGE) || null,
    authMode: localStorage.getItem(AUTH_MODE_STORAGE) || 'email',
    authEmail: localStorage.getItem(AUTH_EMAIL_STORAGE) || '',
    authUser: localStorage.getItem(AUTH_USER_STORAGE) || '',
    authPassHash: localStorage.getItem(AUTH_PASS_HASH_STORAGE) || '',
    isSyncing: false,
    pendingSync: localStorage.getItem(PENDING_SYNC_STORAGE) === 'true',
    syncError: null,
  };

  function setPendingSync(flag) {
    appState.pendingSync = Boolean(flag);
    if (appState.pendingSync) {
      localStorage.setItem(PENDING_SYNC_STORAGE, 'true');
    } else {
      localStorage.removeItem(PENDING_SYNC_STORAGE);
    }
  }

  function getConnectionMode() {
    if (appState.scriptUrl) return 'script';
    return 'none';
  }

  function getActiveAuth() {
    if (appState.authMode === 'credentials' && appState.authUser && appState.authPassHash) {
      return {
        username: appState.authUser,
        passwordHash: appState.authPassHash,
        email: appState.authEmail || '',
      };
    }
    if (appState.authMode === 'email' && appState.authEmail) {
      return {
        email: appState.authEmail,
      };
    }
    return null;
  }

  function computeDerived() {
    var availableMonths = window.AppAccounting.getAvailableMonths(appState.data, window.AppFormat.getCurrentMonthKey());
    var summary = window.AppAccounting.calculateMonthSummary(appState.data, appState.selectedMonth);
    var obligationStatuses = window.AppAccounting.getObligationsStatus(
      appState.data.obligations,
      appState.data.movements,
      appState.selectedMonth,
      appState.data.accounts
    );
    var monthMovements = (appState.data.movements || [])
      .filter(function (m) {
        var mm = m.date ? window.AppFormat.getAccountingMonthForDate(m.date) : m.month;
        return mm === appState.selectedMonth;
      })
      .filter(function (m) { return appState.filterType === 'Todos' ? true : m.type === appState.filterType; })
      .filter(function (m) {
        if (!appState.searchTerm.trim()) return true;
        var q = appState.searchTerm.toLowerCase();
        return (
          (m.description || '').toLowerCase().indexOf(q) !== -1 ||
          (m.category || '').toLowerCase().indexOf(q) !== -1 ||
          (m.fromAccount || '').toLowerCase().indexOf(q) !== -1 ||
          (m.toAccount || '').toLowerCase().indexOf(q) !== -1
        );
      })
      .sort(function (a, b) {
        return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
      });
    var existingClose = (appState.data.monthlyCloses || []).find(function (c) {
      return c.month === appState.selectedMonth;
    });
    var investmentSummary = window.AppInvestments.calculateInvestmentSummary(appState.data);

    return {
      availableMonths: availableMonths,
      summary: summary,
      obligationStatuses: obligationStatuses,
      monthMovements: monthMovements,
      existingClose: existingClose,
      investmentSummary: investmentSummary,
    };
  }

  function renderHeader(derived) {
    var monthSel = document.getElementById('month-selector');
    if (monthSel) {
      monthSel.innerHTML = derived.availableMonths.map(function (m) {
        return '<option value="' + window.escapeHTML(m) + '" ' + (m === appState.selectedMonth ? 'selected' : '') + '>' + window.escapeHTML(window.AppFormat.formatMonthLabel(m)) + '</option>';
      }).join('');
    }

    var movCount = (appState.data.movements || []).filter(function (m) {
      var mm = m.date ? window.AppFormat.getAccountingMonthForDate(m.date) : m.month;
      return mm === appState.selectedMonth;
    }).length;
    var badge = document.getElementById('tab-mov-badge');
    if (badge) badge.textContent = String(movCount);
    var labelPc = document.getElementById('tab-mov-label-pc');
    if (labelPc) labelPc.textContent = 'Movimientos (' + movCount + ')';

    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      var tab = btn.getAttribute('data-tab');
      btn.classList.toggle('active', tab === appState.activeTab);
    });

    var googleBtn = document.getElementById('btn-open-google');
    var googleLbl = document.getElementById('google-btn-label');
    var googlePill = document.getElementById('google-status-pill');
    var menuDot = document.getElementById('menu-sheet-dot');
    var mode = getConnectionMode();
    var isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    var syncBtn = document.getElementById('btn-sync-status');
    var syncIcon = document.getElementById('sync-status-icon');
    if (syncBtn && syncIcon) {
      if (mode === 'none') {
        syncIcon.className = 'fa-solid fa-link-slash';
        syncIcon.style.color = 'var(--text-dim)';
        syncBtn.title = 'Sin Sheet conectado (toca para conectar)';
      } else if (!isOnline) {
        syncIcon.className = 'fa-solid fa-wifi';
        syncIcon.style.color = 'var(--rose)';
        syncBtn.title = appState.pendingSync
          ? 'Sin señal: cambios guardados localmente, se sincronizarán al volver la señal'
          : 'Sin señal de internet';
      } else if (appState.isSyncing) {
        syncIcon.className = 'fa-solid fa-rotate fa-spin';
        syncIcon.style.color = 'var(--indigo-hover)';
        syncBtn.title = 'Sincronizando con Google Sheet...';
      } else if (appState.pendingSync || appState.syncError) {
        syncIcon.className = 'fa-solid fa-cloud-arrow-up';
        syncIcon.style.color = 'var(--amber)';
        syncBtn.title = 'Cambios pendientes de sincronizar (toca para reintentar)';
      } else {
        syncIcon.className = 'fa-solid fa-signal';
        syncIcon.style.color = 'var(--emerald)';
        syncBtn.title = 'Conectado y sincronizado con Google Sheet';
      }
    }
    if (googleBtn && googleLbl) {
      googleBtn.classList.toggle('is-connected', mode !== 'none');
      if (mode !== 'none') {
        googleLbl.textContent = appState.isSyncing ? 'Sincronizando...' : 'Sheet Conectado';
        if (googlePill) googlePill.classList.remove('hidden');
        if (menuDot) menuDot.classList.remove('hidden');
      } else {
        googleLbl.textContent = 'Conectar Gmail';
        if (googlePill) googlePill.classList.add('hidden');
        if (menuDot) menuDot.classList.add('hidden');
      }
    }

    var closeDayPill = document.getElementById('close-day-pill');
    if (closeDayPill) {
      var curCloseDay = window.AppFormat.getMonthCloseDay();
      if (curCloseDay > 0) {
        closeDayPill.textContent = 'Día ' + curCloseDay;
        closeDayPill.classList.remove('hidden');
      } else {
        closeDayPill.classList.add('hidden');
      }
    }

    var privIcon = document.getElementById('privacy-icon');
    var privBtn = document.getElementById('btn-toggle-privacy');
    if (privIcon && privBtn) {
      privIcon.className = appState.hideValues ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      privBtn.title = appState.hideValues ? 'Mostrar valores' : 'Ocultar valores';
    }

    var themeIcon = document.getElementById('theme-icon');
    var themeBtn = document.getElementById('btn-toggle-theme');
    if (themeIcon && themeBtn) {
      var isLight = appState.theme === 'light';
      themeBtn.classList.toggle('is-light', isLight);
      themeBtn.setAttribute('aria-checked', String(isLight));
      themeIcon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      themeBtn.title = isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    }

    var isInv = appState.activeModule === 'inversiones';
    var isPrest = appState.activeModule === 'prestamos';
    var isFin = appState.activeModule === 'finanzas';
    var subEl = document.getElementById('brand-subtitle');
    if (subEl) subEl.textContent = isInv ? 'Inversiones' : (isPrest ? 'Préstamos' : 'Finanzas');
    var brandIconEl = document.getElementById('brand-module-icon');
    if (brandIconEl) brandIconEl.className = isInv ? 'fa-solid fa-arrow-trend-up' : (isPrest ? 'fa-solid fa-hand-holding-dollar' : 'fa-solid fa-wallet');
    var brandIconBox = document.getElementById('brand-icon-box');
    if (brandIconBox) brandIconBox.classList.toggle('is-inv', isInv || isPrest);
    var tabsEl = document.querySelector('.header-tabs:not(#inv-tabs):not(#prest-tabs)');
    if (tabsEl) tabsEl.classList.toggle('hidden', !isFin);
    var invTabsEl = document.getElementById('inv-tabs');
    if (invTabsEl) invTabsEl.classList.toggle('hidden', !isInv);
    var prestTabsEl = document.getElementById('prest-tabs');
    if (prestTabsEl) prestTabsEl.classList.toggle('hidden', !isPrest);
    var prestCount = (appState.data.loans || []).length;
    var prestBadge = document.getElementById('prest-tab-count-badge');
    if (prestBadge) prestBadge.textContent = String(prestCount);
    var prestLabelPc = document.getElementById('prest-tab-count-label-pc');
    if (prestLabelPc) prestLabelPc.textContent = 'Préstamos (' + prestCount + ')';
    var prestMovCount = prestCount + (appState.data.loanPayments || []).length;
    var prestMovBadge = document.getElementById('prest-tab-mov-badge');
    if (prestMovBadge) prestMovBadge.textContent = String(prestMovCount);
    var prestMovLabelPc = document.getElementById('prest-tab-mov-label-pc');
    if (prestMovLabelPc) prestMovLabelPc.textContent = 'Movimientos (' + prestMovCount + ')';
    document.querySelectorAll('[data-prest-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-prest-tab') === appState.prestActiveTab);
    });
    var invMovCount = (appState.data.investmentMovements || []).length;
    var invBadge = document.getElementById('inv-tab-mov-badge');
    if (invBadge) invBadge.textContent = String(invMovCount);
    var invLabelPc = document.getElementById('inv-tab-mov-label-pc');
    if (invLabelPc) invLabelPc.textContent = 'Movimientos (' + invMovCount + ')';
    document.querySelectorAll('[data-inv-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-inv-tab') === appState.invActiveTab);
    });
    var actionsEl = document.querySelector('.header-actions');
    if (actionsEl) actionsEl.classList.toggle('hidden', !isFin);
    document.querySelectorAll('[data-module-switch]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-module-switch') === appState.activeModule);
    });
  }

  function renderApp() {
    var scrollBody = document.querySelector('.app-scroll-body');
    var savedScrollTop = scrollBody ? scrollBody.scrollTop : 0;
    var activeWrap = document.querySelector('.tab-view:not(.hidden) .table-wrap');
    var savedScrollLeft = activeWrap ? activeWrap.scrollLeft : 0;

    var derived = computeDerived();
    renderHeader(derived);

    var viewRes = document.getElementById('view-resumen');
    var viewMov = document.getElementById('view-movimientos');
    var viewCie = document.getElementById('view-cierres');
    var viewInv = document.getElementById('view-inversiones');
    var viewPrest = document.getElementById('view-prestamos');

    var isFin = appState.activeModule === 'finanzas';
    var isInv = appState.activeModule === 'inversiones';
    var isPrest = appState.activeModule === 'prestamos';
    viewRes.classList.toggle('hidden', !isFin || appState.activeTab !== 'resumen');
    viewMov.classList.toggle('hidden', !isFin || appState.activeTab !== 'movimientos');
    viewCie.classList.toggle('hidden', !isFin || appState.activeTab !== 'cierres');
    if (viewInv) viewInv.classList.toggle('hidden', !isInv);
    if (viewPrest) viewPrest.classList.toggle('hidden', !isPrest);

    var viewState = Object.assign({}, appState, derived);
    if (isInv) {
      window.renderInversionesView(viewState);
    } else if (isPrest) {
      window.renderPrestamosView(viewState);
    } else if (appState.activeTab === 'resumen') {
      window.renderResumenView(viewState);
    } else if (appState.activeTab === 'movimientos') {
      window.renderMovimientosView(viewState);
    } else if (appState.activeTab === 'cierres') {
      window.renderCierresView(viewState);
    }

    if (scrollBody) scrollBody.scrollTop = savedScrollTop;
    var nextWrap = document.querySelector('.tab-view:not(.hidden) .table-wrap');
    if (nextWrap && savedScrollLeft > 0) nextWrap.scrollLeft = savedScrollLeft;
    syncStickyTableHeaders();
  }

  function syncStickyTableHeaders() {
    var scrollBody = document.querySelector('.app-scroll-body');
    if (!scrollBody) return;
    var scrollTop = scrollBody.getBoundingClientRect().top;
    document.querySelectorAll('.tab-view:not(.hidden) .table-wrap').forEach(function (wrap) {
      var thead = wrap.querySelector('thead');
      if (!thead) return;
      var view = wrap.closest('.tab-view');
      var toolbar = view ? view.querySelector('.movimientos-toolbar') : null;
      var stickyBottom = (toolbar ? toolbar.getBoundingClientRect().bottom : scrollTop) - 2;
      var wrapRect = wrap.getBoundingClientRect();
      var theadH = thead.offsetHeight || 40;
      if (wrapRect.top < stickyBottom && wrapRect.bottom > stickyBottom + theadH) {
        var offset = Math.round(Math.max(0, Math.min(wrapRect.bottom - stickyBottom - theadH, stickyBottom - wrapRect.top)));
        thead.style.position = 'relative';
        thead.style.zIndex = '6';
        thead.style.transform = 'translate3d(0,' + offset + 'px,0)';
        thead.classList.toggle('thead-stuck', offset > 0);
      } else {
        thead.style.transform = '';
        thead.classList.remove('thead-stuck');
      }
    });
  }

  function clearSessionAndPrompt(errMsg) {
    appState.scriptUrl = '';
    appState.sheetWebUrl = null;
    appState.authMode = 'email';
    appState.authEmail = '';
    appState.authUser = '';
    appState.authPassHash = '';
    setPendingSync(false);
    localStorage.removeItem(APPS_SCRIPT_URL_STORAGE);
    localStorage.removeItem(SHEET_WEB_URL_STORAGE);
    localStorage.removeItem(AUTH_MODE_STORAGE);
    localStorage.removeItem(AUTH_EMAIL_STORAGE);
    localStorage.removeItem(AUTH_USER_STORAGE);
    localStorage.removeItem(AUTH_PASS_HASH_STORAGE);
    appState.syncError = errMsg || 'Tu sesión expiró o las credenciales cambiaron. Vuelve a conectarte.';
    renderHeader(computeDerived());
    openGoogleConnect();
  }

  async function syncDataToCloud(nextData) {
    if (!appState.scriptUrl) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPendingSync(true);
      renderHeader(computeDerived());
      return;
    }
    appState.isSyncing = true;
    appState.syncError = null;
    renderHeader(computeDerived());
    try {
      var res = await window.GoogleSheetsService.writeToAppsScript(appState.scriptUrl, nextData, getActiveAuth());
      if (res.spreadsheetUrl) {
        appState.sheetWebUrl = res.spreadsheetUrl;
        localStorage.setItem(SHEET_WEB_URL_STORAGE, res.spreadsheetUrl);
      }
      setPendingSync(false);
    } catch (err) {
      if (err && err.isAuthOrLinkError) {
        appState.isSyncing = false;
        clearSessionAndPrompt(err.message);
        return;
      }
      setPendingSync(true);
      appState.syncError = err && err.message ? err.message : 'Error al sincronizar con Apps Script';
    } finally {
      appState.isSyncing = false;
      renderHeader(computeDerived());
    }
  }

  async function pullFromAppsScript(url, initializeIfEmpty, customAuth) {
    appState.isSyncing = true;
    appState.syncError = null;
    renderHeader(computeDerived());
    var authToUse = customAuth !== undefined ? customAuth : getActiveAuth();
    try {
      if (initializeIfEmpty) {
        var clean = window.AppStorage.getCleanAppData();
        appState.data = clean;
        window.AppStorage.saveLocalData(clean);
        var writeRes = authToUse
          ? await window.GoogleSheetsService.registerAppsScriptUser(url, authToUse, clean)
          : await window.GoogleSheetsService.writeToAppsScript(url, clean, null);
        if (writeRes && writeRes.spreadsheetUrl) {
          appState.sheetWebUrl = writeRes.spreadsheetUrl;
          localStorage.setItem(SHEET_WEB_URL_STORAGE, writeRes.spreadsheetUrl);
        }
      } else {
        var remote = authToUse
          ? await window.GoogleSheetsService.loginAppsScriptUser(url, authToUse)
          : await window.GoogleSheetsService.readFromAppsScript(url, null);
        if (remote.spreadsheetUrl) {
          appState.sheetWebUrl = remote.spreadsheetUrl;
          localStorage.setItem(SHEET_WEB_URL_STORAGE, remote.spreadsheetUrl);
        }
        var mergedRemote = Object.assign({}, remote.data, {
          exchangeRates: (appState.data && appState.data.exchangeRates) || { USD: { live: 4300, custom: null, updatedAt: null } },
        });
        appState.data = mergedRemote;
        window.AppStorage.saveLocalData(mergedRemote);
      }
      renderApp();
      return true;
    } catch (err) {
      appState.syncError = err && err.message ? err.message : 'No se pudo conectar. Verifica tus credenciales y la URL /exec.';
      if (err && err.isAuthOrLinkError && appState.scriptUrl && appState.scriptUrl === url) {
        appState.isSyncing = false;
        clearSessionAndPrompt(appState.syncError);
      }
      return false;
    } finally {
      appState.isSyncing = false;
      renderHeader(computeDerived());
    }
  }

  function updateData(updater) {
    appState.data = updater(appState.data);
    window.AppStorage.saveLocalData(appState.data);
    if (appState.scriptUrl) setPendingSync(true);
    renderApp();
    syncDataToCloud(appState.data);
  }

  function openGoogleConnect() {
    window.openGoogleModal({
      scriptUrl: appState.scriptUrl,
      authMode: appState.authMode,
      authEmail: appState.authEmail,
      authUser: appState.authUser,
      authPassHash: appState.authPassHash,
      connectionMode: getConnectionMode(),
      baseCurrency: window.AppFormat.getBaseCurrency(),
      onChangeCurrency: function (code) {
        window.AppFormat.setBaseCurrency(code);
        renderApp();
        window.AppActions.refreshLiveFx();
      },
      sheetWebUrl: appState.sheetWebUrl,
      isSyncing: appState.isSyncing,
      syncError: appState.syncError,
      onConnectScript: async function (params) {
        var url = params.url;
        var isNew = params.sheetMode === 'new';
        var mode = params.authMode || 'email';
        var pwdHash = mode === 'credentials' ? window.GoogleSheetsService.hashPassword(params.password) : '';
        var authPayload = mode === 'credentials'
          ? { username: params.username, passwordHash: pwdHash, rawPassword: params.password, email: params.email || '' }
          : (params.email ? { email: params.email } : null);

        var ok = await pullFromAppsScript(url, isNew, authPayload);
        if (ok) {
          appState.scriptUrl = url;
          appState.authMode = mode;
          appState.authEmail = params.email || '';
          appState.authUser = mode === 'credentials' ? params.username : '';
          appState.authPassHash = mode === 'credentials' ? pwdHash : '';
          setPendingSync(false);
          appState.isSyncing = false;
          localStorage.setItem(APPS_SCRIPT_URL_STORAGE, url);
          localStorage.setItem(AUTH_MODE_STORAGE, appState.authMode);
          localStorage.setItem(AUTH_EMAIL_STORAGE, appState.authEmail);
          localStorage.setItem(AUTH_USER_STORAGE, appState.authUser);
          localStorage.setItem(AUTH_PASS_HASH_STORAGE, appState.authPassHash);
          renderHeader(computeDerived());
          openGoogleConnect();
          return { ok: true };
        }
        return { ok: false, error: appState.syncError || 'No se pudo conectar con Google Sheets.' };
      },
      onSetupCredentials: async function (username, password) {
        if (!appState.scriptUrl) return { ok: false, error: 'No hay URL configurada.' };
        var pwdHash = window.GoogleSheetsService.hashPassword(password);
        var authPayload = { username: username, passwordHash: pwdHash, email: appState.authEmail || '' };
        appState.isSyncing = true;
        appState.syncError = null;
        try {
          await window.GoogleSheetsService.registerAppsScriptUser(appState.scriptUrl, authPayload, appState.data);
          appState.authMode = 'credentials';
          appState.authUser = username;
          appState.authPassHash = pwdHash;
          localStorage.setItem(AUTH_MODE_STORAGE, 'credentials');
          localStorage.setItem(AUTH_USER_STORAGE, username);
          localStorage.setItem(AUTH_PASS_HASH_STORAGE, pwdHash);
          openGoogleConnect();
          return { ok: true };
        } catch (err) {
          appState.syncError = err && err.message ? err.message : 'No se pudo registrar la contraseña. Asegúrate de haber actualizado Code.gs en tu Sheet.';
          return { ok: false, error: appState.syncError };
        } finally {
          appState.isSyncing = false;
          renderHeader(computeDerived());
        }
      },
      onDisconnect: function () {
        appState.scriptUrl = '';
        appState.sheetWebUrl = null;
        appState.authMode = 'email';
        appState.authEmail = '';
        appState.authUser = '';
        appState.authPassHash = '';
        localStorage.removeItem(APPS_SCRIPT_URL_STORAGE);
        localStorage.removeItem(SHEET_WEB_URL_STORAGE);
        localStorage.removeItem(AUTH_MODE_STORAGE);
        localStorage.removeItem(AUTH_EMAIL_STORAGE);
        localStorage.removeItem(AUTH_USER_STORAGE);
        localStorage.removeItem(AUTH_PASS_HASH_STORAGE);
        appState.syncError = null;
        renderHeader(computeDerived());
      },
      onForceSync: async function () {
        await syncDataToCloud(appState.data);
        return { ok: !appState.syncError, error: appState.syncError };
      },
      onPullFromSheet: async function () {
        var ok = await pullFromAppsScript(appState.scriptUrl, false);
        return { ok: ok, error: appState.syncError };
      },
    });
  }

  window.AppActions = {
    openMoveModal: function (preset) {
      var derived = computeDerived();
      window.openMovementModal({
        accounts: appState.data.accounts,
        accountBalances: derived.summary.endBalances,
        movements: appState.data.movements || [],
        categories: appState.data.categories,
        investmentAccounts: appState.data.investmentAccounts || [],
        exchangeRates: appState.data.exchangeRates || {},
        preset: preset || {},
        currentCcDebt: derived.summary.totalDebt,
        onAddCategory: function (cat) {
          var newCat = Object.assign({}, cat, {
            id: 'cat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
          });
          updateData(function (prev) {
            return Object.assign({}, prev, { categories: (prev.categories || []).concat([newCat]) });
          });
          return newCat;
        },
        onSave: function (mov, invPayload) {
          var effMonth = mov.date ? window.AppFormat.getAccountingMonthForDate(mov.date) : mov.month;
          var newMov = Object.assign({}, mov, {
            id: 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            month: effMonth,
            createdAt: new Date().toISOString(),
          });
          appState.selectedMonth = effMonth;
          updateData(function (prev) {
            var nextInvMovs = (prev.investmentMovements || []).slice();
            if (invPayload) {
              nextInvMovs.push(Object.assign({}, invPayload, {
                id: 'invmov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                linkedMovementId: newMov.id,
                createdAt: newMov.createdAt,
              }));
            }
            return Object.assign({}, prev, {
              movements: prev.movements.concat([newMov]),
              investmentMovements: nextInvMovs,
            });
          });
        },
      });
    },
    addObligation: function (name, amountRaw) {
      var trimmed = String(name || '').trim();
      if (!trimmed) return;
      var est = Number(String(amountRaw || '').replace(/[^0-9]/g, '')) || 0;
      var newOb = {
        id: 'ob-' + Date.now(),
        name: trimmed,
        category: trimmed,
        estimatedAmount: est,
        matchType: 'Egreso',
      };
      updateData(function (prev) {
        return Object.assign({}, prev, { obligations: prev.obligations.concat([newOb]) });
      });
    },
    askDeleteObligation: function (id) {
      appState.pendingDeleteObligationId = id;
      renderApp();
    },
    deleteObligation: function (id) {
      appState.pendingDeleteObligationId = null;
      updateData(function (prev) {
        return Object.assign({}, prev, {
          obligations: (prev.obligations || []).filter(function (o) { return o.id !== id; }),
        });
      });
    },
    setFilterType: function (type) {
      appState.filterType = type;
      renderApp();
    },
    setSearchTerm: function (term) {
      appState.searchTerm = term;
      renderApp();
    },
    askDeleteMovement: function (id) {
      appState.pendingDeleteMovementId = id;
      renderApp();
    },
    deleteMovement: function (id) {
      appState.pendingDeleteMovementId = null;
      updateData(function (prev) {
        var delLoan = (prev.loans || []).find(function (l) { return l.linkedMovementId === id; });
        var extraPayMovIds = new Set();
        if (delLoan) {
          (prev.loanPayments || []).forEach(function (p) {
            if (p.loanId === delLoan.id && p.linkedMovementId) extraPayMovIds.add(p.linkedMovementId);
          });
        }
        return Object.assign({}, prev, {
          movements: prev.movements.filter(function (m) { return m.id !== id && !extraPayMovIds.has(m.id); }),
          investmentMovements: (prev.investmentMovements || []).filter(function (im) { return im.linkedMovementId !== id; }),
          loans: delLoan ? (prev.loans || []).filter(function (l) { return l.id !== delLoan.id; }) : (prev.loans || []),
          loanPayments: (prev.loanPayments || []).filter(function (p) {
            return p.linkedMovementId !== id && (!delLoan || p.loanId !== delLoan.id);
          }),
        });
      });
    },
    openInvAccountModal: function (existingAcc) {
      window.InvestmentModals.openAccountModal({
        account: existingAcc,
        onSave: function (acc) {
          updateData(function (prev) {
            var list = (prev.investmentAccounts || []).slice();
            var idx = list.findIndex(function (x) { return x.id === acc.id; });
            if (idx !== -1) list[idx] = acc;
            else if (!list.some(function (x) { return x.name.toLowerCase() === acc.name.toLowerCase(); })) list.push(acc);
            return Object.assign({}, prev, { investmentAccounts: list });
          });
        },
      });
    },
    openSubModal: function (fundName, currency) {
      window.InvestmentModals.openSubModal({
        fundName: fundName,
        currency: currency,
        onSave: function (sub) {
          updateData(function (prev) {
            return Object.assign({}, prev, { subInvestments: (prev.subInvestments || []).concat([sub]) });
          });
        },
      });
    },
    openUpdateValue: function (fundName, subName) {
      var invSummary = window.AppInvestments.calculateInvestmentSummary(appState.data);
      var f = invSummary.fundSummaries.find(function (x) { return x.account.name === fundName; });
      if (!f) return;
      var bookVal = f.totalValue;
      var netContrib = f.netContributed;
      if (subName) {
        var s = f.subSummaries.find(function (x) { return x.sub.name === subName; });
        if (!s) return;
        bookVal = s.currentValue;
        netContrib = s.netInvested;
      }
      window.InvestmentModals.openUpdateValueModal({
        fundName: fundName,
        subName: subName,
        currency: f.currency,
        currentBookValue: bookVal,
        netContributed: netContrib,
        onSave: function (diff) {
          var newInvMov = {
            id: 'invmov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            date: window.AppFormat.getTodayISO(),
            type: 'Rendimiento',
            fundName: fundName,
            subName: subName || '',
            normalAccount: '',
            description: 'Actualización de valor' + (subName ? ' (' + subName + ')' : ''),
            amount: diff,
            commission: 0,
            commissionApply: 'moved',
            exchangeRate: f.rate,
            amountCOP: Math.round(diff * f.rate),
            linkedMovementId: '',
            createdAt: new Date().toISOString(),
          };
          updateData(function (prev) {
            return Object.assign({}, prev, { investmentMovements: (prev.investmentMovements || []).concat([newInvMov]) });
          });
        },
      });
    },
    openInvOpModal: function (preset) {
      var derived = computeDerived();
      var liquidAccounts = (appState.data.accounts || []).filter(function (a) { return a.kind === 'liquidez'; });
      window.InvestmentModals.openOpModal({
        fundSummaries: derived.investmentSummary.fundSummaries,
        liquidAccounts: liquidAccounts,
        accountBalances: derived.summary.endBalances,
        exchangeRates: appState.data.exchangeRates || {},
        initialType: preset.initialType,
        initialFund: preset.initialFund,
        initialSub: preset.initialSub,
        onSave: function (op) {
          var nowIso = new Date().toISOString();
          var invId = 'invmov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          var linkedMov = null;
          if (op.type === 'Aporte' && op.normalAccount) {
            linkedMov = {
              id: 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              date: op.date,
              month: window.AppFormat.getAccountingMonthForDate(op.date),
              type: 'Egreso',
              fromAccount: op.normalAccount,
              toAccount: op.fundName,
              category: 'Aporte a Inversión',
              description: op.description || ('Aporte a ' + op.fundName),
              amount: op.amountCOP,
              createdAt: nowIso,
            };
          } else if (op.type === 'Retiro' && op.normalAccount) {
            linkedMov = {
              id: 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              date: op.date,
              month: window.AppFormat.getAccountingMonthForDate(op.date),
              type: 'Ingreso',
              fromAccount: op.fundName,
              toAccount: op.normalAccount,
              category: 'Retiro de Inversión',
              description: op.description || ('Retiro de ' + op.fundName),
              amount: op.amountCOP,
              createdAt: nowIso,
            };
          }
          var newInvMov = Object.assign({}, op, {
            id: invId,
            linkedMovementId: linkedMov ? linkedMov.id : '',
            createdAt: nowIso,
          });
          updateData(function (prev) {
            return Object.assign({}, prev, {
              movements: linkedMov ? prev.movements.concat([linkedMov]) : prev.movements,
              investmentMovements: (prev.investmentMovements || []).concat([newInvMov]),
            });
          });
        },
      });
    },
    importLegacyArq: function () {
      updateData(function (prev) { return window.AppInvestments.importLegacyArqMovements(prev); });
    },
    refreshLiveFx: async function () {
      try {
        var nextRates = await window.AppInvestments.fetchLiveRates(appState.data.exchangeRates || {});
        appState.data = Object.assign({}, appState.data, { exchangeRates: nextRates });
        window.AppStorage.saveLocalData(appState.data);
        renderApp();
      } catch (e) { /* ignore offline */ }
    },
    setCustomFxRate: function (currencyCode, rawVal) {
      var parsed = window.AppFormat.parseDecimalInput(rawVal);
      var rates = Object.assign({}, appState.data.exchangeRates || {});
      var cur = rates[currencyCode] || { live: 4300, custom: null, updatedAt: null };
      rates[currencyCode] = Object.assign({}, cur, { custom: parsed > 0 ? parsed : null });
      appState.data = Object.assign({}, appState.data, { exchangeRates: rates });
      window.AppStorage.saveLocalData(appState.data);
      renderApp();
    },
    askDeleteInvFund: function (id) { appState.pendingDeleteFundId = id; renderApp(); },
    deleteInvFund: function (id) {
      appState.pendingDeleteFundId = null;
      updateData(function (prev) {
        var fund = (prev.investmentAccounts || []).find(function (a) { return a.id === id; });
        var fname = fund ? fund.name : '';
        return Object.assign({}, prev, {
          investmentAccounts: (prev.investmentAccounts || []).filter(function (a) { return a.id !== id; }),
          subInvestments: (prev.subInvestments || []).filter(function (s) { return s.fundName !== fname; }),
          investmentMovements: (prev.investmentMovements || []).filter(function (m) { return m.fundName !== fname; }),
        });
      });
    },
    askDeleteSub: function (id) { appState.pendingDeleteSubId = id; renderApp(); },
    deleteSub: function (id) {
      appState.pendingDeleteSubId = null;
      updateData(function (prev) {
        return Object.assign({}, prev, {
          subInvestments: (prev.subInvestments || []).filter(function (s) { return s.id !== id; }),
        });
      });
    },
    askDeleteInvMov: function (id) { appState.pendingDeleteInvMovId = id; renderApp(); },
    setInvFilterFund: function (fund) { appState.invFilterFund = fund; renderApp(); },
    setInvFilterType: function (type) { appState.invFilterType = type; renderApp(); },
    setInvSearchTerm: function (term) { appState.invSearchTerm = term; renderApp(); },
    deleteInvMov: function (id) {
      appState.pendingDeleteInvMovId = null;
      updateData(function (prev) {
        var target = (prev.investmentMovements || []).find(function (m) { return m.id === id; });
        var linkedId = target ? target.linkedMovementId : '';
        return Object.assign({}, prev, {
          investmentMovements: (prev.investmentMovements || []).filter(function (m) { return m.id !== id; }),
          movements: linkedId ? prev.movements.filter(function (m) { return m.id !== linkedId; }) : prev.movements,
        });
      });
    },
    setCloseNotes: function (notes) {
      appState.closeNotes = notes;
    },
    closeMonth: function () {
      var summary = window.AppAccounting.calculateMonthSummary(appState.data, appState.selectedMonth);
      var record = {
        month: appState.selectedMonth,
        closedAt: new Date().toISOString(),
        totalIncome: summary.totalIncome,
        totalConsumptionExpense: summary.totalConsumptionExpense,
        totalArqInvestment: summary.totalArqInvestment,
        debitBalance: summary.endBalances['Tarjeta de Débito'] || 0,
        nequiBalance: summary.endBalances.Nequi || 0,
        cashBalance: summary.endBalances.Efectivo || 0,
        ccDebt: summary.totalDebt,
        liquidityTotal: summary.liquidityTotal,
        ccSurplusOrDeficit: summary.ccSurplusOrDeficit,
        notes: appState.closeNotes.trim(),
      };
      appState.closeNotes = '';
      updateData(function (prev) {
        var others = (prev.monthlyCloses || []).filter(function (c) { return c.month !== appState.selectedMonth; });
        return Object.assign({}, prev, {
          monthlyCloses: others.concat([record]).sort(function (a, b) { return b.month.localeCompare(a.month); }),
        });
      });
    },
    selectMonthAndResumen: function (month) {
      appState.selectedMonth = month;
      appState.activeTab = 'resumen';
      renderApp();
    },
    setMonthCloseDay: function (day) {
      window.AppFormat.setMonthCloseDay(day);
      appState.selectedMonth = window.AppFormat.getCurrentMonthKey();
      updateData(function (prev) { return Object.assign({}, prev); });
    },
    setLoanFilter: function (f) {
      appState.loanFilter = f;
      renderApp();
    },
    openNewLoan: function () {
      var derived = computeDerived();
      var liquidAccounts = (appState.data.accounts || []).filter(function (a) { return a.kind === 'liquidez'; }).map(function (a) { return a.name; });
      window.openLoanModal({
        liquidAccounts: liquidAccounts,
        accountBalances: derived.summary.endBalances,
        onSave: function (loanInput) {
          var nowIso = new Date().toISOString();
          var loanId = 'loan-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          var movId = loanInput.isHistorical ? '' : ('mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
          var linkedMov = loanInput.isHistorical
            ? null
            : {
                id: movId,
                date: loanInput.startDate,
                month: window.AppFormat.getAccountingMonthForDate(loanInput.startDate),
                type: 'Egreso',
                fromAccount: loanInput.fromAccount,
                toAccount: 'Externo',
                category: 'Préstamo otorgado',
                description: 'Préstamo a ' + loanInput.borrower + (loanInput.notes ? ' - ' + loanInput.notes : ''),
                amount: loanInput.principal,
                createdAt: nowIso,
              };
          var newLoan = Object.assign({}, loanInput, {
            id: loanId,
            linkedMovementId: movId,
            createdAt: nowIso,
          });
          updateData(function (prev) {
            return Object.assign({}, prev, {
              movements: linkedMov ? (prev.movements || []).concat([linkedMov]) : (prev.movements || []),
              loans: (prev.loans || []).concat([newLoan]),
            });
          });
        },
      });
    },
    openNewLoanPayment: function (loanStat) {
      var liquidAccounts = (appState.data.accounts || []).filter(function (a) { return a.kind === 'liquidez'; }).map(function (a) { return a.name; });
      window.openLoanPaymentModal({
        loan: loanStat.loan,
        remainingTotal: loanStat.remainingTotal,
        suggestedAmount: loanStat.remainingInCurrentQuota,
        liquidAccounts: liquidAccounts,
        onSave: function (payInput) {
          var nowIso = new Date().toISOString();
          var payId = 'lp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          var movId = 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          var linkedMov = {
            id: movId,
            date: payInput.date,
            month: window.AppFormat.getAccountingMonthForDate(payInput.date),
            type: 'Ingreso',
            fromAccount: 'Externo',
            toAccount: payInput.toAccount,
            category: 'Cobro de préstamo',
            description: 'Cobro préstamo ' + loanStat.loan.borrower + (payInput.notes ? ' - ' + payInput.notes : ''),
            amount: payInput.amount,
            createdAt: nowIso,
          };
          var newPay = Object.assign({}, payInput, {
            id: payId,
            linkedMovementId: movId,
            createdAt: nowIso,
          });
          updateData(function (prev) {
            return Object.assign({}, prev, {
              movements: (prev.movements || []).concat([linkedMov]),
              loanPayments: (prev.loanPayments || []).concat([newPay]),
            });
          });
        },
      });
    },
    askDeleteLoan: function (id) {
      appState.pendingDeleteLoanId = id;
      renderApp();
    },
    deleteLoan: function (id) {
      appState.pendingDeleteLoanId = null;
      updateData(function (prev) {
        var target = (prev.loans || []).find(function (l) { return l.id === id; });
        var payMovIds = new Set(
          (prev.loanPayments || []).filter(function (p) { return p.loanId === id && p.linkedMovementId; }).map(function (p) { return p.linkedMovementId; })
        );
        if (target && target.linkedMovementId) payMovIds.add(target.linkedMovementId);
        return Object.assign({}, prev, {
          loans: (prev.loans || []).filter(function (l) { return l.id !== id; }),
          loanPayments: (prev.loanPayments || []).filter(function (p) { return p.loanId !== id; }),
          movements: (prev.movements || []).filter(function (m) { return !payMovIds.has(m.id); }),
        });
      });
    },
    askDeleteLoanPayment: function (payId) {
      appState.pendingDeleteLoanPayId = payId;
      renderApp();
    },
    deleteLoanPayment: function (payId) {
      appState.pendingDeleteLoanPayId = null;
      updateData(function (prev) {
        var target = (prev.loanPayments || []).find(function (p) { return p.id === payId; });
        var linkedId = target ? target.linkedMovementId : '';
        return Object.assign({}, prev, {
          loanPayments: (prev.loanPayments || []).filter(function (p) { return p.id !== payId; }),
          movements: linkedId ? (prev.movements || []).filter(function (m) { return m.id !== linkedId; }) : prev.movements,
        });
      });
    },
  };

  async function initApp() {
    document.documentElement.setAttribute('data-theme', appState.theme);
    await window.loadHTMLFragment('/recursos/html/global/header.html', 'header-root');
    if (document.getElementById('footer-root')) {
      await window.loadHTMLFragment('/recursos/html/global/footer.html', 'footer-root');
    }
    window.initFooter();

    var syncStatusBtn = document.getElementById('btn-sync-status');
    if (syncStatusBtn) {
      syncStatusBtn.addEventListener('click', function () {
        if (!appState.scriptUrl) {
          openGoogleConnect();
        } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          renderHeader(computeDerived());
        } else {
          syncDataToCloud(appState.data);
        }
      });
    }

    document.getElementById('btn-toggle-privacy').addEventListener('click', function () {
      appState.hideValues = !appState.hideValues;
      localStorage.setItem(HIDE_VALUES_STORAGE, String(appState.hideValues));
      renderApp();
    });

    document.getElementById('btn-toggle-theme').addEventListener('click', function () {
      appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_STORAGE, appState.theme);
      document.documentElement.setAttribute('data-theme', appState.theme);
      renderHeader(computeDerived());
    });

    document.getElementById('month-selector').addEventListener('change', function (e) {
      appState.selectedMonth = e.target.value;
      renderApp();
    });

    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        appState.activeTab = btn.getAttribute('data-tab');
        renderApp();
      });
    });

    document.getElementById('btn-new-movement').addEventListener('click', function () {
      window.AppActions.openMoveModal();
    });

    var burgerBtn = document.getElementById('btn-hamburger-menu');
    var dropdownMenu = document.getElementById('header-dropdown-menu');
    function closeDropdown() {
      if (dropdownMenu) dropdownMenu.classList.add('hidden');
      if (burgerBtn) burgerBtn.setAttribute('aria-expanded', 'false');
    }

    if (burgerBtn && dropdownMenu) {
      burgerBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isHidden = dropdownMenu.classList.toggle('hidden');
        burgerBtn.setAttribute('aria-expanded', String(!isHidden));
      });

      document.addEventListener('click', function (e) {
        if (!dropdownMenu.classList.contains('hidden') && !dropdownMenu.contains(e.target) && !burgerBtn.contains(e.target)) {
          closeDropdown();
        }
      });
    }

    document.querySelectorAll('[data-inv-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        appState.invActiveTab = btn.getAttribute('data-inv-tab');
        renderApp();
      });
    });

    document.querySelectorAll('[data-prest-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        appState.prestActiveTab = btn.getAttribute('data-prest-tab');
        renderApp();
      });
    });

    document.querySelectorAll('[data-module-switch]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        appState.activeModule = btn.getAttribute('data-module-switch');
        appState.activeTab = 'resumen';
        appState.invActiveTab = 'resumen';
        appState.prestActiveTab = 'lista';
        closeDropdown();
        renderApp();
      });
    });

    document.getElementById('btn-open-accounts').addEventListener('click', function () {
      closeDropdown();
      window.openAccountsModal({
        accounts: appState.data.accounts,
        categories: appState.data.categories,
        onSave: function (accounts, categories) {
          updateData(function (prev) {
            return Object.assign({}, prev, { accounts: accounts, categories: categories });
          });
        },
        onResetClean: function () {
          appState.selectedMonth = window.AppFormat.getCurrentMonthKey();
          updateData(function () { return window.AppStorage.getCleanAppData(); });
        },
      });
    });

    document.getElementById('btn-open-close-day').addEventListener('click', function () {
      closeDropdown();
      var root = document.getElementById('modales-root');
      if (!root) return;
      var fmt = window.AppFormat;
      var esc = window.escapeHTML;
      var currentDay = fmt.getMonthCloseDay();
      var dayOpts = '<option value="0"' + (currentDay === 0 ? ' selected' : '') + '>Fin de mes (calendario)</option>';
      for (var d = 2; d <= 28; d++) {
        dayOpts += '<option value="' + d + '"' + (currentDay === d ? ' selected' : '') + '>Día ' + d + ' de cada mes</option>';
      }
      var previewMonth = fmt.getAccountingMonthForDate(fmt.getTodayISO(), currentDay);
      var previewRange = fmt.getAccountingPeriodRange(previewMonth, currentDay);

      root.innerHTML =
        '<div class="modal-backdrop" id="cdm-backdrop">' +
          '<div class="modal-box" style="max-width:440px">' +
            '<div class="modal-header">' +
              '<h2 class="modal-title"><i class="fa-regular fa-calendar-check" style="margin-right:0.45rem;color:#818cf8"></i>Cierres Mensuales</h2>' +
              '<button type="button" class="modal-close" id="cdm-close"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="field-group">' +
              '<label class="field-label" for="cdm-day-select">Día de cierre mensual</label>' +
              '<select id="cdm-day-select" class="select">' + dayOpts + '</select>' +
              '<p class="text-muted" style="font-size:0.78rem;margin:0.45rem 0 0">Al llegar este día comienza automáticamente el siguiente mes contable, renovando tus pagos pendientes de tarjetas y créditos.</p>' +
            '</div>' +
            '<div class="config-box" style="margin-bottom:1rem">' +
              '<p style="margin:0;font-size:0.8rem;color:var(--text-muted)">Mes activo hoy: <strong id="cdm-preview-month" style="color:var(--text-strong)">' + esc(fmt.formatMonthLabel(previewMonth)) + '</strong></p>' +
              '<p style="margin:0.25rem 0 0;font-size:0.8rem;color:var(--text-muted)">Periodo: <strong id="cdm-preview-range" style="color:#818cf8">' + esc(previewRange.label) + '</strong></p>' +
            '</div>' +
            '<div class="modal-footer">' +
              '<button type="button" class="btn btn-secondary" id="cdm-cancel">Cancelar</button>' +
              '<button type="button" class="btn btn-primary" id="cdm-save">Guardar</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var closeModal = function () { root.innerHTML = ''; };
      document.getElementById('cdm-close').addEventListener('click', closeModal);
      document.getElementById('cdm-cancel').addEventListener('click', closeModal);
      document.getElementById('cdm-day-select').addEventListener('change', function (e) {
        var val = Number(e.target.value);
        var pm = fmt.getAccountingMonthForDate(fmt.getTodayISO(), val);
        var pr = fmt.getAccountingPeriodRange(pm, val);
        document.getElementById('cdm-preview-month').textContent = fmt.formatMonthLabel(pm);
        document.getElementById('cdm-preview-range').textContent = pr.label;
      });
      document.getElementById('cdm-save').addEventListener('click', function () {
        var val = Number(document.getElementById('cdm-day-select').value);
        closeModal();
        window.AppActions.setMonthCloseDay(val);
      });
    });

    var usersBtn = document.getElementById('btn-open-users');
    if (usersBtn) {
      usersBtn.addEventListener('click', function () {
        closeDropdown();
        window.openUsersModal({
          isConnected: getConnectionMode() !== 'none',
          currentUsername: appState.authUser || '',
          currentEmail: appState.authEmail || '',
          onListUsers: async function () {
            try {
              var res = await window.GoogleSheetsService.manageAppsScriptUsers(appState.scriptUrl, 'users_list', getActiveAuth());
              return { ok: true, users: res.users || [] };
            } catch (err) {
              return { ok: false, error: err && err.message ? err.message : 'No se pudieron cargar los usuarios.' };
            }
          },
          onAddUser: async function (u) {
            try {
              var pwdHash = window.GoogleSheetsService.hashPassword(u.password);
              var res = await window.GoogleSheetsService.manageAppsScriptUsers(
                appState.scriptUrl,
                'users_add',
                getActiveAuth(),
                { newUser: { username: u.username, email: u.email, passwordHash: pwdHash } }
              );
              return { ok: true, users: res.users || [] };
            } catch (err) {
              return { ok: false, error: err && err.message ? err.message : 'No se pudo agregar el usuario.' };
            }
          },
          onUpdateUser: async function (u) {
            try {
              var pwdHash = u.password ? window.GoogleSheetsService.hashPassword(u.password) : '';
              var res = await window.GoogleSheetsService.manageAppsScriptUsers(
                appState.scriptUrl,
                'users_update',
                getActiveAuth(),
                {
                  rowIndex: u.rowIndex,
                  newUser: { username: u.username, email: u.email, passwordHash: pwdHash },
                }
              );
              if (appState.authUser && u.oldUsername && appState.authUser.toLowerCase() === u.oldUsername.toLowerCase()) {
                appState.authUser = u.username;
                appState.authEmail = u.email;
                localStorage.setItem(AUTH_USER_STORAGE, u.username);
                localStorage.setItem(AUTH_EMAIL_STORAGE, u.email);
                if (pwdHash) {
                  appState.authPassHash = pwdHash;
                  localStorage.setItem(AUTH_PASS_HASH_STORAGE, pwdHash);
                }
                renderHeader(computeDerived());
              }
              return { ok: true, users: res.users || [] };
            } catch (err) {
              return { ok: false, error: err && err.message ? err.message : 'No se pudo actualizar el usuario.' };
            }
          },
          onDeleteUser: async function (rowIndex) {
            try {
              var res = await window.GoogleSheetsService.manageAppsScriptUsers(
                appState.scriptUrl,
                'users_delete',
                getActiveAuth(),
                { rowIndex: rowIndex }
              );
              return { ok: true, users: res.users || [] };
            } catch (err) {
              return { ok: false, error: err && err.message ? err.message : 'No se pudo eliminar el usuario.' };
            }
          },
        });
      });
    }

    document.getElementById('btn-open-google').addEventListener('click', function () {
      closeDropdown();
      openGoogleConnect();
    });

    var resetBtn = document.getElementById('btn-open-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        closeDropdown();
        window.openResetModal({
          currentUser: appState.authUser || '',
          onResetSelected: function (keys) {
            var clean = window.AppStorage.getCleanAppData();
            if (keys.indexOf('default_all') !== -1) {
              appState.selectedMonth = window.AppFormat.getCurrentMonthKey();
              updateData(function () { return clean; });
              return;
            }
            updateData(function (prev) {
              var next = Object.assign({}, prev);
              if (keys.indexOf('cuentas') !== -1) next.accounts = clean.accounts;
              if (keys.indexOf('conceptos') !== -1) next.categories = clean.categories;
              if (keys.indexOf('egresos') !== -1) {
                next.movements = (next.movements || []).filter(function (m) { return m.type !== 'Egreso'; });
                next.investmentMovements = (next.investmentMovements || []).filter(function (im) { return im.type !== 'Aporte'; });
                next.loans = [];
                next.loanPayments = [];
              }
              if (keys.indexOf('ingresos') !== -1) {
                next.movements = (next.movements || []).filter(function (m) { return m.type !== 'Ingreso'; });
                next.investmentMovements = (next.investmentMovements || []).filter(function (im) { return im.type !== 'Retiro'; });
                next.loanPayments = [];
              }
              if (keys.indexOf('traspasos') !== -1) {
                next.movements = (next.movements || []).filter(function (m) { return m.type !== 'Traspaso'; });
              }
              if (keys.indexOf('cuentas_inversion') !== -1) {
                next.investmentAccounts = [];
                next.subInvestments = [];
              }
              if (keys.indexOf('movimientos_inversion') !== -1) {
                next.investmentMovements = [];
              }
              if (keys.indexOf('prestamos') !== -1) {
                var loanMovIds = new Set();
                (next.loans || []).forEach(function (l) { if (l.linkedMovementId) loanMovIds.add(l.linkedMovementId); });
                (next.loanPayments || []).forEach(function (p) { if (p.linkedMovementId) loanMovIds.add(p.linkedMovementId); });
                next.loans = [];
                next.loanPayments = [];
                next.movements = (next.movements || []).filter(function (m) { return !loanMovIds.has(m.id); });
              }
              return next;
            });
          },
          onUpdateCredentials: async function (newUsername, newPassword) {
            var nextUser = newUsername || appState.authUser || '';
            var nextHash = newPassword ? window.GoogleSheetsService.hashPassword(newPassword) : (appState.authPassHash || '');
            if (appState.scriptUrl) {
              try {
                await window.GoogleSheetsService.updateAppsScriptUser(
                  appState.scriptUrl,
                  getActiveAuth(),
                  { username: nextUser, passwordHash: nextHash, email: appState.authEmail || '' }
                );
              } catch (err) {
                return { ok: false, error: err && err.message ? err.message : 'No se pudo actualizar en el Sheet.' };
              }
            }
            if (nextUser) {
              appState.authUser = nextUser;
              localStorage.setItem(AUTH_USER_STORAGE, nextUser);
            }
            if (nextHash) {
              appState.authPassHash = nextHash;
              appState.authMode = 'credentials';
              localStorage.setItem(AUTH_PASS_HASH_STORAGE, nextHash);
              localStorage.setItem(AUTH_MODE_STORAGE, 'credentials');
            }
            return { ok: true };
          },
        });
      });
    }

    renderApp();

    var scrollBodyEl = document.querySelector('.app-scroll-body');
    if (scrollBodyEl) {
      scrollBodyEl.addEventListener('scroll', syncStickyTableHeaders, { passive: true });
    }
    window.addEventListener('resize', syncStickyTableHeaders, { passive: true });

    // Actualizar TRM oficial automáticamente al iniciar si no hay tasa reciente (< 1 hora)
    var usdRateInfo = (appState.data.exchangeRates && appState.data.exchangeRates.USD) || null;
    var rateAgeMs = usdRateInfo && usdRateInfo.updatedAt ? (Date.now() - new Date(usdRateInfo.updatedAt).getTime()) : Infinity;
    if (!Number.isFinite(rateAgeMs) || rateAgeMs > 3600000) {
      window.AppActions.refreshLiveFx();
    }

    window.addEventListener('online', function () {
      renderHeader(computeDerived());
      if (appState.scriptUrl && appState.pendingSync) {
        syncDataToCloud(appState.data);
      }
    });
    window.addEventListener('offline', function () {
      renderHeader(computeDerived());
    });

    if (appState.scriptUrl) {
      if (appState.pendingSync && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        syncDataToCloud(appState.data).then(function () {
          pullFromAppsScript(appState.scriptUrl, false);
        });
      } else if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        pullFromAppsScript(appState.scriptUrl, false);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();

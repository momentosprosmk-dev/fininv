(function () {
  var CLIENT_ID_STORAGE = 'contabilidad_google_client_id';
  var SPREADSHEET_ID_STORAGE = 'contabilidad_spreadsheet_id';
  var APPS_SCRIPT_URL_STORAGE = 'contabilidad_apps_script_url';
  var SHEET_WEB_URL_STORAGE = 'contabilidad_sheet_web_url';
  var THEME_STORAGE = 'contabilidad_theme';
  var HIDE_VALUES_STORAGE = 'contabilidad_hide_values';

  var appState = {
    data: window.AppStorage.loadLocalData(),
    selectedMonth: window.AppFormat.getCurrentMonthKey(),
    activeModule: 'finanzas', // finanzas | inversiones
    activeTab: 'resumen',
    invActiveTab: 'resumen', // resumen | movimientos
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
    theme: localStorage.getItem(THEME_STORAGE) || 'dark',
    hideValues: localStorage.getItem(HIDE_VALUES_STORAGE) === 'true',
    closeNotes: '',
    scriptUrl: localStorage.getItem(APPS_SCRIPT_URL_STORAGE) || '',
    sheetWebUrl: localStorage.getItem(SHEET_WEB_URL_STORAGE) || null,
    clientId: localStorage.getItem(CLIENT_ID_STORAGE) || '',
    accessToken: null,
    spreadsheetId: localStorage.getItem(SPREADSHEET_ID_STORAGE) || null,
    isSyncing: false,
    syncError: null,
  };

  function getConnectionMode() {
    if (appState.scriptUrl) return 'script';
    if (appState.accessToken) return 'oauth';
    return 'none';
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
      .filter(function (m) { return m.month === appState.selectedMonth; })
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

    var movCount = (appState.data.movements || []).filter(function (m) { return m.month === appState.selectedMonth; }).length;
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
    var subEl = document.getElementById('brand-subtitle');
    if (subEl) subEl.textContent = isInv ? 'Módulo de Inversiones' : 'Control financiero';
    var brandIconEl = document.getElementById('brand-module-icon');
    if (brandIconEl) brandIconEl.className = isInv ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-wallet';
    var brandIconBox = document.getElementById('brand-icon-box');
    if (brandIconBox) brandIconBox.classList.toggle('is-inv', isInv);
    var tabsEl = document.querySelector('.header-tabs:not(#inv-tabs)');
    if (tabsEl) tabsEl.classList.toggle('hidden', isInv);
    var invTabsEl = document.getElementById('inv-tabs');
    if (invTabsEl) invTabsEl.classList.toggle('hidden', !isInv);
    var invMovCount = (appState.data.investmentMovements || []).length;
    var invBadge = document.getElementById('inv-tab-mov-badge');
    if (invBadge) invBadge.textContent = String(invMovCount);
    var invLabelPc = document.getElementById('inv-tab-mov-label-pc');
    if (invLabelPc) invLabelPc.textContent = 'Movimientos (' + invMovCount + ')';
    document.querySelectorAll('[data-inv-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-inv-tab') === appState.invActiveTab);
    });
    var actionsEl = document.querySelector('.header-actions');
    if (actionsEl) actionsEl.classList.toggle('hidden', isInv);
    document.querySelectorAll('[data-module-switch]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-module-switch') === appState.activeModule);
    });
  }

  function renderApp() {
    var derived = computeDerived();
    renderHeader(derived);

    var viewRes = document.getElementById('view-resumen');
    var viewMov = document.getElementById('view-movimientos');
    var viewCie = document.getElementById('view-cierres');
    var viewInv = document.getElementById('view-inversiones');

    var isFin = appState.activeModule === 'finanzas';
    viewRes.classList.toggle('hidden', !isFin || appState.activeTab !== 'resumen');
    viewMov.classList.toggle('hidden', !isFin || appState.activeTab !== 'movimientos');
    viewCie.classList.toggle('hidden', !isFin || appState.activeTab !== 'cierres');
    if (viewInv) viewInv.classList.toggle('hidden', isFin);

    var viewState = Object.assign({}, appState, derived);
    if (!isFin) {
      window.renderInversionesView(viewState);
    } else if (appState.activeTab === 'resumen') {
      window.renderResumenView(viewState);
    } else if (appState.activeTab === 'movimientos') {
      window.renderMovimientosView(viewState);
    } else if (appState.activeTab === 'cierres') {
      window.renderCierresView(viewState);
    }
  }

  async function syncDataToCloud(nextData) {
    if (appState.scriptUrl) {
      appState.isSyncing = true;
      appState.syncError = null;
      renderHeader(computeDerived());
      try {
        var res = await window.GoogleSheetsService.writeToAppsScript(appState.scriptUrl, nextData);
        if (res.spreadsheetUrl) {
          appState.sheetWebUrl = res.spreadsheetUrl;
          localStorage.setItem(SHEET_WEB_URL_STORAGE, res.spreadsheetUrl);
        }
      } catch (err) {
        appState.syncError = err && err.message ? err.message : 'Error al sincronizar con Apps Script';
      } finally {
        appState.isSyncing = false;
        renderHeader(computeDerived());
      }
      return;
    }

    if (!appState.accessToken || !appState.spreadsheetId) return;
    appState.isSyncing = true;
    appState.syncError = null;
    renderHeader(computeDerived());
    try {
      await window.GoogleSheetsService.writeAllToSpreadsheet(appState.accessToken, appState.spreadsheetId, nextData);
    } catch (err) {
      appState.syncError = err && err.message ? err.message : 'Error al sincronizar con Google Sheets';
    } finally {
      appState.isSyncing = false;
      renderHeader(computeDerived());
    }
  }

  async function pullFromAppsScript(url, initializeIfEmpty) {
    appState.isSyncing = true;
    appState.syncError = null;
    renderHeader(computeDerived());
    try {
      var remote = await window.GoogleSheetsService.readFromAppsScript(url);
      if (remote.spreadsheetUrl) {
        appState.sheetWebUrl = remote.spreadsheetUrl;
        localStorage.setItem(SHEET_WEB_URL_STORAGE, remote.spreadsheetUrl);
      }
      if (initializeIfEmpty) {
        var clean = window.AppStorage.getCleanAppData();
        appState.data = clean;
        window.AppStorage.saveLocalData(clean);
        await window.GoogleSheetsService.writeToAppsScript(url, clean);
      } else {
        appState.data = remote.data;
        window.AppStorage.saveLocalData(remote.data);
      }
      renderApp();
      return true;
    } catch (err) {
      appState.syncError = err && err.message ? err.message : 'No se pudo conectar. Verifica la URL /exec.';
      return false;
    } finally {
      appState.isSyncing = false;
      renderHeader(computeDerived());
    }
  }

  function updateData(updater) {
    appState.data = updater(appState.data);
    window.AppStorage.saveLocalData(appState.data);
    renderApp();
    syncDataToCloud(appState.data);
  }

  function openGoogleConnect() {
    window.openGoogleModal({
      scriptUrl: appState.scriptUrl,
      clientId: appState.clientId,
      connectionMode: getConnectionMode(),
      sheetWebUrl: appState.sheetWebUrl || (appState.spreadsheetId ? 'https://docs.google.com/spreadsheets/d/' + appState.spreadsheetId + '/edit' : null),
      isSyncing: appState.isSyncing,
      syncError: appState.syncError,
      onConnectScript: async function (url, sheetMode) {
        var ok = await pullFromAppsScript(url, sheetMode === 'new');
        if (ok) {
          appState.scriptUrl = url;
          localStorage.setItem(APPS_SCRIPT_URL_STORAGE, url);
        }
        openGoogleConnect();
      },
      onSaveClientId: function (id) {
        appState.clientId = id;
        localStorage.setItem(CLIENT_ID_STORAGE, id);
      },
      onConnectOAuth: function (sheetMode) {
        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
          appState.syncError = 'El script de Google aún está cargando. Intenta en unos segundos.';
          openGoogleConnect();
          return;
        }
        var tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: appState.clientId.trim(),
          scope: window.GoogleSheetsService.GOOGLE_SCOPES,
          callback: async function (resp) {
            if (resp.error || !resp.access_token) {
              appState.syncError = resp.error || 'No se pudo obtener autorización de Google.';
              openGoogleConnect();
              return;
            }
            appState.accessToken = resp.access_token;
            appState.isSyncing = true;
            openGoogleConnect();
            try {
              var res = await window.GoogleSheetsService.findOrCreateSpreadsheet(resp.access_token, appState.spreadsheetId || undefined);
              appState.spreadsheetId = res.spreadsheetId;
              localStorage.setItem(SPREADSHEET_ID_STORAGE, res.spreadsheetId);
              if (sheetMode === 'new' || res.isNew) {
                var clean = window.AppStorage.getCleanAppData();
                appState.data = clean;
                window.AppStorage.saveLocalData(clean);
                await window.GoogleSheetsService.writeAllToSpreadsheet(resp.access_token, res.spreadsheetId, clean);
              } else {
                var remoteData = await window.GoogleSheetsService.readAllFromSpreadsheet(resp.access_token, res.spreadsheetId);
                appState.data = remoteData;
                window.AppStorage.saveLocalData(remoteData);
              }
              renderApp();
            } catch (err) {
              appState.syncError = err && err.message ? err.message : 'Error conectando con Google Sheets';
            } finally {
              appState.isSyncing = false;
              openGoogleConnect();
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      },
      onDisconnect: function () {
        appState.accessToken = null;
        appState.scriptUrl = '';
        appState.sheetWebUrl = null;
        localStorage.removeItem(APPS_SCRIPT_URL_STORAGE);
        localStorage.removeItem(SHEET_WEB_URL_STORAGE);
        appState.syncError = null;
        renderHeader(computeDerived());
      },
      onForceSync: async function () {
        await syncDataToCloud(appState.data);
        openGoogleConnect();
      },
      onPullFromSheet: async function () {
        await pullFromAppsScript(appState.scriptUrl, false);
        openGoogleConnect();
      },
    });
  }

  window.AppActions = {
    openMoveModal: function (preset) {
      var derived = computeDerived();
      window.openMovementModal({
        accounts: appState.data.accounts,
        accountBalances: derived.summary.endBalances,
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
          var newMov = Object.assign({}, mov, {
            id: 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            createdAt: new Date().toISOString(),
          });
          appState.selectedMonth = mov.month;
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
        return Object.assign({}, prev, {
          movements: prev.movements.filter(function (m) { return m.id !== id; }),
          investmentMovements: (prev.investmentMovements || []).filter(function (im) { return im.linkedMovementId !== id; }),
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
              month: op.date.slice(0, 7),
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
              month: op.date.slice(0, 7),
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
  };

  async function initApp() {
    document.documentElement.setAttribute('data-theme', appState.theme);
    await window.loadHTMLFragment('recursos/html/global/header.html', 'header-root');
    await window.loadHTMLFragment('recursos/html/global/footer.html', 'footer-root');
    window.initFooter();

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

    document.querySelectorAll('[data-module-switch]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        appState.activeModule = btn.getAttribute('data-module-switch');
        appState.activeTab = 'resumen';
        appState.invActiveTab = 'resumen';
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

    document.getElementById('btn-open-google').addEventListener('click', function () {
      closeDropdown();
      openGoogleConnect();
    });

    renderApp();

    if (appState.scriptUrl) {
      pullFromAppsScript(appState.scriptUrl, false);
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();

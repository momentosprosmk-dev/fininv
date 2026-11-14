(function () {
  var CLIENT_ID_STORAGE = 'contabilidad_google_client_id';
  var SPREADSHEET_ID_STORAGE = 'contabilidad_spreadsheet_id';
  var APPS_SCRIPT_URL_STORAGE = 'contabilidad_apps_script_url';
  var SHEET_WEB_URL_STORAGE = 'contabilidad_sheet_web_url';

  var appState = {
    data: window.AppStorage.loadLocalData(),
    selectedMonth: window.AppFormat.getCurrentMonthKey(),
    activeTab: 'resumen',
    filterType: 'Todos',
    searchTerm: '',
    pendingDeleteMovementId: null,
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

    return {
      availableMonths: availableMonths,
      summary: summary,
      obligationStatuses: obligationStatuses,
      monthMovements: monthMovements,
      existingClose: existingClose,
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

    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      var tab = btn.getAttribute('data-tab');
      btn.classList.toggle('active', tab === appState.activeTab);
    });

    var googleBtn = document.getElementById('btn-open-google');
    var googleLbl = document.getElementById('google-btn-label');
    var mode = getConnectionMode();
    if (googleBtn && googleLbl) {
      googleBtn.classList.remove('btn-secondary', 'btn-emerald-outline');
      if (mode !== 'none') {
        googleBtn.classList.add('btn-emerald-outline');
        googleLbl.textContent = appState.isSyncing ? 'Sincronizando...' : 'Sheet Conectado';
      } else {
        googleBtn.classList.add('btn-secondary');
        googleLbl.textContent = 'Conectar Gmail';
      }
    }
  }

  function renderApp() {
    var derived = computeDerived();
    renderHeader(derived);

    var viewRes = document.getElementById('view-resumen');
    var viewMov = document.getElementById('view-movimientos');
    var viewCie = document.getElementById('view-cierres');

    viewRes.classList.toggle('hidden', appState.activeTab !== 'resumen');
    viewMov.classList.toggle('hidden', appState.activeTab !== 'movimientos');
    viewCie.classList.toggle('hidden', appState.activeTab !== 'cierres');

    var viewState = Object.assign({}, appState, derived);
    if (appState.activeTab === 'resumen') {
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
        onSave: function (mov) {
          var newMov = Object.assign({}, mov, {
            id: 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            createdAt: new Date().toISOString(),
          });
          appState.selectedMonth = mov.month;
          updateData(function (prev) {
            return Object.assign({}, prev, { movements: prev.movements.concat([newMov]) });
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
    await window.loadHTMLFragment('recursos/html/global/header.html', 'header-root');
    await window.loadHTMLFragment('recursos/html/global/footer.html', 'footer-root');
    window.initFooter();

    document.getElementById('month-selector').addEventListener('change', function (e) {
      appState.selectedMonth = e.target.value;
      renderApp();
    });

    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        appState.activeTab = btn.getAttribute('data-tab');
        renderApp();
      });
    });

    document.getElementById('btn-new-movement').addEventListener('click', function () {
      window.AppActions.openMoveModal();
    });

    document.getElementById('btn-open-accounts').addEventListener('click', function () {
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

    document.getElementById('btn-open-google').addEventListener('click', openGoogleConnect);

    renderApp();

    if (appState.scriptUrl) {
      pullFromAppsScript(appState.scriptUrl, false);
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();

(function () {
  function getBaseCur() {
    return window.AppFormat && window.AppFormat.getBaseCurrency ? window.AppFormat.getBaseCurrency() : 'COP';
  }

  function getEffectiveRate(currencyCode, exchangeRates) {
    var baseCur = getBaseCur();
    if (!currencyCode || currencyCode === baseCur) return 1;
    var entry = (exchangeRates && exchangeRates[currencyCode]) || {};
    if (Number(entry.custom) > 0) return Number(entry.custom);
    if (Number(entry.live) > 0) return Number(entry.live);
    return currencyCode === 'USD' ? 4300 : 1;
  }

  async function fetchLiveRates(currentRates) {
    var baseCur = getBaseCur();
    var res = await fetch('https://open.er-api.com/v6/latest/' + encodeURIComponent(baseCur));
    if (!res.ok) throw new Error('No se pudo consultar la tasa de cambio (' + res.status + ')');
    var json = await res.json();
    if (!json || !json.rates) throw new Error('Respuesta de tasa inválida');

    var nextRates = Object.assign({}, currentRates || {});
    var nowIso = new Date().toISOString();
    window.AppFormat.getSupportedCurrencies().forEach(function (cur) {
      if (cur.code === baseCur) return;
      var copPerUnit = json.rates[cur.code] ? 1 / Number(json.rates[cur.code]) : null;
      if (copPerUnit && Number.isFinite(copPerUnit)) {
        var prev = nextRates[cur.code] || {};
        nextRates[cur.code] = {
          live: Math.round(copPerUnit * 100) / 100,
          custom: prev.custom || null,
          updatedAt: nowIso,
        };
      }
    });

    // Si la moneda principal es COP, consultar TRM oficial (Superintendencia Financiera / Datos Abiertos)
    if (baseCur === 'COP') {
      try {
        var trmRes = await fetch('https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC');
        if (trmRes.ok) {
          var trmRows = await trmRes.json();
          var officialVal = trmRows && trmRows[0] ? Number(trmRows[0].valor) : 0;
          if (officialVal > 0 && Number.isFinite(officialVal)) {
            var prevUsd = nextRates.USD || {};
            nextRates.USD = {
              live: Math.round(officialVal * 100) / 100,
              custom: prevUsd.custom || null,
              updatedAt: nowIso,
            };
          }
        }
      } catch (e) { /* mantiene el valor de open.er-api si Datos Abiertos no responde */ }
    }
    return nextRates;
  }

  /**
   * Calcula montos netos con comisión:
   * - commApply === 'moved': se resta del monto que viaja (ej. 100 -> 96 netos).
   * - commApply === 'fund': el monto de la operación queda exacto (100) y la comisión (4) se descuenta del saldo previo del fondo.
   */
  function computeCommissionSplit(amount, commType, commValue, commApply) {
    var amt = Math.max(0, Number(amount) || 0);
    var rawVal = Math.max(0, Number(commValue) || 0);
    var commission = 0;

    if (commType === 'percent') {
      commission = amt * (rawVal / 100);
    } else if (commType === 'fixed') {
      commission = rawVal;
    }
    commission = Math.round(commission * 100) / 100;

    var applyTo = commApply === 'fund' ? 'fund' : 'moved';
    if (commission <= 0) {
      return { grossAmount: amt, commission: 0, netToDest: amt, fundExtraFee: 0, applyTo: applyTo };
    }

    if (applyTo === 'moved') {
      return {
        grossAmount: amt,
        commission: commission,
        netToDest: Math.max(0, Math.round((amt - commission) * 100) / 100),
        fundExtraFee: 0,
        applyTo: 'moved',
      };
    }

    return {
      grossAmount: amt,
      commission: commission,
      netToDest: amt,
      fundExtraFee: commission,
      applyTo: 'fund',
    };
  }

  function calculateInvestmentSummary(data) {
    var accounts = data.investmentAccounts || [];
    var subs = data.subInvestments || [];
    var movs = (data.investmentMovements || []).slice().sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || '')) ||
        String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    var rates = data.exchangeRates || {};

    var fundMap = {};
    var fundIdByName = {};
    accounts.forEach(function (acc, idx) {
      var fid = acc.id || ('inv-' + (idx + 1));
      var initBal = Number(acc.initialBalance) || 0;
      fundIdByName[acc.name] = fid;
      fundMap[fid] = {
        account: acc,
        mode: acc.mode === 'fragmentado' ? 'fragmentado' : 'simple',
        currency: acc.currency || 'COP',
        rate: getEffectiveRate(acc.currency || 'COP', rates),
        availableCash: initBal,
        netContributed: initBal,
        totalAportado: initBal,
        totalRetirado: 0,
        totalComisiones: 0,
        totalRendimientos: 0,
        subsMap: {},
        subIdByName: {},
      };
    });

    function resolveFund(fundId, fundName) {
      if (fundId && fundMap[fundId]) return fundMap[fundId];
      var byName = fundName ? fundIdByName[fundName] : '';
      return byName ? fundMap[byName] : null;
    }

    function resolveSub(f, subId, subName) {
      if (!f) return null;
      if (subId && f.subsMap[subId]) return f.subsMap[subId];
      var byName = subName ? f.subIdByName[subName] : '';
      return byName ? f.subsMap[byName] : null;
    }

    subs.forEach(function (sub, idx) {
      var f = resolveFund(sub.fundId, sub.fundName);
      if (!f) return;
      var sid = sub.id || ('sub-' + (idx + 1));
      var initSub = Number(sub.initialBalance) || 0;
      f.subIdByName[sub.name] = sid;
      f.subsMap[sid] = {
        sub: sub,
        currentValue: initSub,
        netInvested: initSub,
        totalRendimientos: 0,
      };
      f.netContributed += initSub;
      f.totalAportado += initSub;
    });

    movs.forEach(function (m) {
      var f = resolveFund(m.fundId, m.fundName);
      if (!f) return;
      var amt = Number(m.amount) || 0;
      var comm = Number(m.commission) || 0;
      var apply = m.commissionApply === 'fund' ? 'fund' : 'moved';
      f.totalComisiones += comm;

      if (m.type === 'Aporte') {
        if (apply === 'moved') {
          var netIn = Math.max(0, amt - comm);
          f.availableCash += netIn;
          f.netContributed += netIn;
          f.totalAportado += netIn;
        } else {
          f.availableCash += amt - comm;
          f.netContributed += amt;
          f.totalAportado += amt;
        }
      } else if (m.type === 'Retiro') {
        if (apply === 'moved') {
          f.availableCash -= amt;
          f.netContributed -= amt;
          f.totalRetirado += Math.max(0, amt - comm);
        } else {
          f.availableCash -= (amt + comm);
          f.netContributed -= amt;
          f.totalRetirado += amt;
        }
      } else if (m.type === 'AsignarSub') {
        var s = resolveSub(f, m.subId, m.subName);
        if (apply === 'moved') {
          var netSub = Math.max(0, amt - comm);
          f.availableCash -= amt;
          if (s) {
            s.currentValue += netSub;
            s.netInvested += netSub;
          }
        } else {
          f.availableCash -= (amt + comm);
          if (s) {
            s.currentValue += amt;
            s.netInvested += amt;
          }
        }
      } else if (m.type === 'LiberarSub') {
        var sRel = resolveSub(f, m.subId, m.subName);
        if (sRel) {
          sRel.currentValue -= amt;
          sRel.netInvested -= amt;
        }
        if (apply === 'moved') {
          f.availableCash += Math.max(0, amt - comm);
        } else {
          f.availableCash += amt - comm;
        }
      } else if (m.type === 'Rendimiento') {
        var sRend = resolveSub(f, m.subId, m.subName);
        if (sRend) {
          sRend.currentValue += amt;
          sRend.totalRendimientos += amt;
        } else {
          f.availableCash += amt;
        }
        f.totalRendimientos += amt;
      } else if (m.type === 'TraspasoInv') {
        // Sale del fondo origen
        if (apply === 'moved') {
          f.availableCash -= amt;
          f.netContributed -= amt;
        } else {
          f.availableCash -= (amt + comm);
          f.netContributed -= amt;
        }
        // Entra al fondo destino (normalName guarda el fondo destino en TraspasoInv)
        var dest = resolveFund(m.destFundId, m.normalAccount);
        if (dest) {
          var destAmt = apply === 'moved' ? Math.max(0, amt - comm) : amt;
          var convertedDest = destAmt * (f.rate / dest.rate);
          dest.availableCash += convertedDest;
          dest.netContributed += convertedDest;
        }
      }
    });

    var totalPortfolioCOP = 0;
    var totalAportadoCOP = 0;
    var totalRetiradoCOP = 0;
    var totalGainLossCOP = 0;
    var totalComisionesCOP = 0;

    var fundSummaries = accounts.map(function (acc, idx) {
      var f = fundMap[acc.id || ('inv-' + (idx + 1))];
      var subList = Object.keys(f.subsMap).map(function (k) {
        var item = f.subsMap[k];
        var gain = item.currentValue - item.netInvested;
        var pct = item.netInvested > 0 ? (gain / item.netInvested) * 100 : 0;
        return {
          sub: item.sub,
          currentValue: item.currentValue,
          netInvested: item.netInvested,
          gainLoss: gain,
          gainLossPct: pct,
          currentValueCOP: item.currentValue * f.rate,
        };
      });

      var investedInSubs = subList.reduce(function (s, x) { return s + x.currentValue; }, 0);
      var totalValue = f.availableCash + investedInSubs;
      var gainLoss = totalValue - f.netContributed;
      var gainLossPct = f.netContributed > 0 ? (gainLoss / f.netContributed) * 100 : 0;

      var totalValueCOP = totalValue * f.rate;
      totalPortfolioCOP += totalValueCOP;
      totalAportadoCOP += f.totalAportado * f.rate;
      totalRetiradoCOP += f.totalRetirado * f.rate;
      totalGainLossCOP += gainLoss * f.rate;
      totalComisionesCOP += f.totalComisiones * f.rate;

      return {
        account: acc,
        mode: f.mode,
        currency: f.currency,
        rate: f.rate,
        availableCash: f.availableCash,
        investedInSubs: investedInSubs,
        totalValue: totalValue,
        netContributed: f.netContributed,
        totalAportado: f.totalAportado,
        totalRetirado: f.totalRetirado,
        totalComisiones: f.totalComisiones,
        totalRendimientos: f.totalRendimientos,
        gainLoss: gainLoss,
        gainLossPct: gainLossPct,
        totalValueCOP: totalValueCOP,
        subSummaries: subList,
      };
    });

    return {
      fundSummaries: fundSummaries,
      totalPortfolioCOP: totalPortfolioCOP,
      totalAportadoCOP: totalAportadoCOP,
      totalRetiradoCOP: totalRetiradoCOP,
      totalGainLossCOP: totalGainLossCOP,
      totalComisionesCOP: totalComisionesCOP,
    };
  }

  function findUnimportedLegacyArqMovements(data) {
    var linkedIds = new Set(
      (data.investmentMovements || [])
        .map(function (m) { return m.linkedMovementId; })
        .filter(Boolean)
    );

    return (data.movements || []).filter(function (m) {
      if (String(m.id || '').indexOf('demo-') === 0) return false;
      if (linkedIds.has(m.id)) return false;
      return (
        m.toAccount === 'ARQ' ||
        m.fromAccount === 'ARQ' ||
        String(m.category || '').toLowerCase().indexOf('arq') !== -1
      );
    });
  }

  function importLegacyArqMovements(data) {
    var legacy = findUnimportedLegacyArqMovements(data);
    if (legacy.length === 0) return data;

    var hasArqAcc = (data.investmentAccounts || []).some(function (a) {
      return a.name.toLowerCase() === 'arq';
    });
    var nextAccounts = (data.investmentAccounts || []).slice();
    if (!hasArqAcc) {
      nextAccounts.push({
        id: 'inv-arq-legacy',
        name: 'ARQ',
        mode: 'fragmentado',
        currency: 'COP',
        initialBalance: 0,
        goal: 0,
        notes: 'Importado desde historial previo de Control Financiero',
      });
    }

    var newInvMovs = legacy.map(function (m) {
      var isWithdraw = m.type === 'Ingreso';
      return {
        id: 'invmov-leg-' + m.id,
        date: m.date,
        type: isWithdraw ? 'Retiro' : 'Aporte',
        fundName: 'ARQ',
        subName: '',
        normalAccount: isWithdraw ? m.toAccount : m.fromAccount,
        description: m.description || m.category,
        amount: Number(m.amount) || 0,
        commission: 0,
        commissionApply: 'moved',
        exchangeRate: 1,
        amountCOP: Number(m.amount) || 0,
        linkedMovementId: m.id,
        createdAt: m.createdAt || new Date().toISOString(),
      };
    });

    return Object.assign({}, data, {
      investmentAccounts: nextAccounts,
      investmentMovements: (data.investmentMovements || []).concat(newInvMovs),
    });
  }

  window.AppInvestments = {
    getEffectiveRate: getEffectiveRate,
    fetchLiveRates: fetchLiveRates,
    computeCommissionSplit: computeCommissionSplit,
    calculateInvestmentSummary: calculateInvestmentSummary,
    findUnimportedLegacyArqMovements: findUnimportedLegacyArqMovements,
    importLegacyArqMovements: importLegacyArqMovements,
  };
})();

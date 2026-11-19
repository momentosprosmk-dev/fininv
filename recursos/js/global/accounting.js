(function () {
  function isDebtAccount(accounts, name) {
    return accounts.some(function (a) {
      return a.name === name && a.kind === 'deuda';
    });
  }

  function isDebtLikeAccount(accounts, name) {
    return accounts.some(function (a) {
      return a.name === name && (a.kind === 'deuda' || a.kind === 'credito');
    });
  }

  function applyMovementToBalances(balances, accounts, mov) {
    var amount = Number(mov.amount) || 0;

    if (mov.type === 'Ingreso') {
      if (mov.toAccount in balances) {
        if (isDebtLikeAccount(accounts, mov.toAccount)) {
          balances[mov.toAccount] -= amount;
        } else {
          balances[mov.toAccount] += amount;
        }
      }
      return;
    }

    if (mov.type === 'Egreso') {
      if (mov.fromAccount in balances) {
        if (isDebtLikeAccount(accounts, mov.fromAccount)) {
          balances[mov.fromAccount] += amount;
        } else {
          balances[mov.fromAccount] -= amount;
        }
      }
      return;
    }

    if (mov.type === 'Traspaso') {
      if (mov.fromAccount in balances) {
        if (isDebtLikeAccount(accounts, mov.fromAccount)) {
          balances[mov.fromAccount] += amount;
        } else {
          balances[mov.fromAccount] -= amount;
        }
      }
      if (mov.toAccount in balances) {
        if (isDebtLikeAccount(accounts, mov.toAccount)) {
          balances[mov.toAccount] -= amount;
        } else {
          balances[mov.toAccount] += amount;
        }
      }
    }
  }

  function getMovMonth(mov) {
    if (mov && mov.date && window.AppFormat && window.AppFormat.getAccountingMonthForDate) {
      return window.AppFormat.getAccountingMonthForDate(mov.date);
    }
    return mov ? mov.month : '';
  }

  function calculateMonthSummary(data, targetMonth) {
    var balances = {};
    (data.accounts || []).forEach(function (acc) {
      balances[acc.name] = Number(acc.initialBalance) || 0;
    });

    var arqCategoryNames = new Set(
      (data.categories || []).filter(function (c) { return c.isArq; }).map(function (c) { return c.name; })
    );
    arqCategoryNames.add(window.AppStorage.ARQ_CATEGORY);

    var relevantMovements = (data.movements || [])
      .filter(function (m) { return getMovMonth(m) <= targetMonth; })
      .sort(function (a, b) {
        return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
      });

    var totalIncome = 0;
    var totalConsumptionExpense = 0;
    var totalArqInvestment = 0;
    var ccExpensesInMonth = 0;
    var ccPaymentsInMonth = 0;
    var categoryTotals = new Map();
    var investmentFundTotals = new Map();
    var creditPaidCounts = {};
    var creditMonthInfo = {};
    var creditFirstMovMonth = {};
    (data.accounts || []).forEach(function (a) {
      if (a.kind === 'credito') {
        creditPaidCounts[a.name] = 0;
        creditMonthInfo[a.name] = {};
        creditFirstMovMonth[a.name] = '';
      }
    });

    relevantMovements.forEach(function (mov) {
      applyMovementToBalances(balances, data.accounts || [], mov);
      var movMonth = getMovMonth(mov);
      if (mov.type === 'Traspaso' && (mov.toAccount in creditPaidCounts)) {
        if (!creditMonthInfo[mov.toAccount][movMonth]) {
          creditMonthInfo[mov.toAccount][movMonth] = { paid: 0, required: 0 };
        }
        creditMonthInfo[mov.toAccount][movMonth].paid += (Number(mov.amount) || 0);
        if (Number(mov.creditRequiredAmount) > 0) {
          creditMonthInfo[mov.toAccount][movMonth].required = Number(mov.creditRequiredAmount);
        }
        if (!creditFirstMovMonth[mov.toAccount] || movMonth < creditFirstMovMonth[mov.toAccount]) {
          creditFirstMovMonth[mov.toAccount] = movMonth;
        }
      }
      if (movMonth !== targetMonth) return;

      var amt = Number(mov.amount) || 0;
      if (mov.type === 'Ingreso') {
        totalIncome += amt;
      } else if (mov.type === 'Egreso') {
        var isArq = arqCategoryNames.has(mov.category);
        if (isArq) {
          totalArqInvestment += amt;
          var fundName = (mov.toAccount && mov.toAccount !== 'Externo')
            ? mov.toAccount
            : (mov.category === window.AppStorage.ARQ_CATEGORY ? 'ARQ' : mov.category);
          investmentFundTotals.set(fundName, (investmentFundTotals.get(fundName) || 0) + amt);
        } else {
          totalConsumptionExpense += amt;
          categoryTotals.set(mov.category, (categoryTotals.get(mov.category) || 0) + amt);
        }
        if (isDebtAccount(data.accounts || [], mov.fromAccount)) {
          ccExpensesInMonth += amt;
        }
      } else if (mov.type === 'Traspaso') {
        if (isDebtAccount(data.accounts || [], mov.toAccount)) {
          ccPaymentsInMonth += amt;
        }
      }
    });

    var totalExpense = totalConsumptionExpense + totalArqInvestment;
    var liquidityTotal = (data.accounts || [])
      .filter(function (a) { return a.kind === 'liquidez'; })
      .reduce(function (sum, a) { return sum + (balances[a.name] || 0); }, 0);

    var totalDebt = (data.accounts || [])
      .filter(function (a) { return a.kind === 'deuda'; })
      .reduce(function (sum, a) { return sum + (balances[a.name] || 0); }, 0);

    var totalCreditDebt = (data.accounts || [])
      .filter(function (a) { return a.kind === 'credito'; })
      .reduce(function (sum, a) { return sum + Math.max(0, balances[a.name] || 0); }, 0);

    var now = new Date();
    var closeDay = (window.AppFormat && window.AppFormat.getMonthCloseDay) ? window.AppFormat.getMonthCloseDay() : 0;
    var currentMonthKey = (window.AppFormat && window.AppFormat.getCurrentMonthKey)
      ? window.AppFormat.getCurrentMonthKey()
      : (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
    var todayDay = now.getDate();
    var creditStatusByAccount = {};
    var totalPendingCreditInstallments = 0;

    function listMonthsRange(fromMonth, toMonth, maxCount) {
      var out = [];
      if (!fromMonth || !toMonth || fromMonth > toMonth) return [toMonth];
      var p1 = fromMonth.split('-').map(Number);
      var y = p1[0], m = p1[1];
      while (out.length < maxCount) {
        var key = y + '-' + String(m).padStart(2, '0');
        out.push(key);
        if (key === toMonth) break;
        m += 1;
        if (m > 12) { m = 1; y += 1; }
      }
      return out;
    }

    (data.accounts || []).filter(function (a) { return a.kind === 'credito'; }).forEach(function (a) {
      var bal = Math.max(0, balances[a.name] || 0);
      var cuota = Number(a.monthlyInstallment) || 0;
      var totalMonths = Number(a.totalMonths) || 12;
      var monthMap = creditMonthInfo[a.name] || {};
      var paidMonthsKeys = Object.keys(monthMap).filter(function (mk) { return monthMap[mk] && monthMap[mk].paid > 0; }).sort();
      var latestPaidMonth = paidMonthsKeys.length > 0 ? paidMonthsKeys[paidMonthsKeys.length - 1] : '';
      var paidInstallmentsCount = 0;
      Object.keys(monthMap).forEach(function (mk) {
        var mInfo = monthMap[mk];
        var mReq = (mInfo && mInfo.required > 0) ? mInfo.required : cuota;
        var mPaid = mInfo ? mInfo.paid : 0;
        if (mPaid > 0 && (mReq <= 0 || mPaid >= mReq || (bal <= 0 && mk === latestPaidMonth))) {
          paidInstallmentsCount += 1;
        }
      });
      creditPaidCounts[a.name] = paidInstallmentsCount;
      var startM = a.startMonth || creditFirstMovMonth[a.name] || targetMonth;
      var monthsSpan = listMonthsRange(startM, targetMonth, totalMonths);
      var totalUnpaid = 0;
      var pastUnpaid = 0;

      monthsSpan.forEach(function (mk) {
        var info = monthMap[mk];
        var reqForM = (info && info.required > 0) ? info.required : cuota;
        var paidForM = info ? info.paid : 0;
        var diff = Math.max(0, reqForM - paidForM);
        totalUnpaid += diff;
        if (mk < targetMonth && diff > 0) pastUnpaid += diff;
      });

      var pendingInstallment = bal > 0 ? Math.min(bal, totalUnpaid) : 0;
      var targetInfo = monthMap[targetMonth];
      var targetReq = (targetInfo && targetInfo.required > 0) ? targetInfo.required : cuota;
      var targetPaid = targetInfo ? targetInfo.paid : 0;
      var isPaidThisMonth = bal <= 0 || (pendingInstallment <= 0 && (targetPaid > 0 || targetReq <= 0));
      var dueDay = Number(a.dueDay) || 0;
      var isTodayPastDueInCurrentPeriod = false;
      if (dueDay > 0) {
        if (!closeDay || closeDay <= 0 || closeDay >= 31) {
          isTodayPastDueInCurrentPeriod = todayDay > dueDay;
        } else if (dueDay >= closeDay) {
          isTodayPastDueInCurrentPeriod = (todayDay >= closeDay && todayDay > dueDay) || (todayDay < closeDay);
        } else {
          isTodayPastDueInCurrentPeriod = (todayDay < closeDay && todayDay > dueDay);
        }
      }
      var pastDueDate = !isPaidThisMonth && dueDay > 0 && (
        targetMonth < currentMonthKey || (targetMonth === currentMonthKey && isTodayPastDueInCurrentPeriod)
      );
      var isOverdue = bal > 0 && pendingInstallment > 0 && (Boolean(a.inMora) || pastUnpaid > 0 || pastDueDate);

      totalPendingCreditInstallments += pendingInstallment;
      creditStatusByAccount[a.name] = {
        balance: bal,
        cuota: targetReq,
        pendingInstallment: pendingInstallment,
        isPaidThisMonth: isPaidThisMonth,
        dueDay: dueDay,
        isOverdue: isOverdue,
      };
    });

    var expensesByCategory = Array.from(categoryTotals.entries())
      .map(function (entry) {
        return {
          category: entry[0],
          amount: entry[1],
          isArq: false,
        };
      })
      .sort(function (a, b) { return b.amount - a.amount; });

    var investmentsByFund = Array.from(investmentFundTotals.entries())
      .map(function (entry) {
        return {
          fund: entry[0],
          amount: entry[1],
        };
      })
      .sort(function (a, b) { return b.amount - a.amount; });

    return {
      month: targetMonth,
      totalIncome: totalIncome,
      totalConsumptionExpense: totalConsumptionExpense,
      totalArqInvestment: totalArqInvestment,
      totalExpense: totalExpense,
      netFlow: totalIncome - totalExpense,
      ccExpensesInMonth: ccExpensesInMonth,
      ccPaymentsInMonth: ccPaymentsInMonth,
      endBalances: balances,
      liquidityTotal: liquidityTotal,
      totalDebt: totalDebt,
      totalCreditDebt: totalCreditDebt,
      totalPendingCreditInstallments: totalPendingCreditInstallments,
      creditStatusByAccount: creditStatusByAccount,
      creditPaidCounts: creditPaidCounts,
      ccSurplusOrDeficit: liquidityTotal - (totalDebt + totalPendingCreditInstallments),
      expensesByCategory: expensesByCategory,
      investmentsByFund: investmentsByFund,
    };
  }

  function getObligationsStatus(obligations, movements, month, accounts) {
    var monthMovs = (movements || []).filter(function (m) { return getMovMonth(m) === month; });
    var debtNames = new Set(
      (accounts || []).filter(function (a) { return a.kind === 'deuda'; }).map(function (a) { return a.name; })
    );
    if (debtNames.size === 0) debtNames.add('Tarjeta de Crédito');

    return (obligations || []).map(function (ob) {
      var paidAmount = 0;
      if (ob.matchType === 'PagoTC') {
        paidAmount = monthMovs
          .filter(function (m) { return m.type === 'Traspaso' && debtNames.has(m.toAccount); })
          .reduce(function (acc, m) { return acc + (Number(m.amount) || 0); }, 0);
      } else {
        paidAmount = monthMovs
          .filter(function (m) { return m.type === 'Egreso' && m.category === ob.category; })
          .reduce(function (acc, m) { return acc + (Number(m.amount) || 0); }, 0);
      }
      return {
        obligation: ob,
        paidAmount: paidAmount,
        isPaid: paidAmount > 0,
      };
    });
  }

  function getAvailableMonths(data, currentMonth) {
    var set = new Set([currentMonth]);
    (data.movements || []).forEach(function (m) {
      var mm = getMovMonth(m);
      if (mm) set.add(mm);
    });
    (data.monthlyCloses || []).forEach(function (c) { if (c.month) set.add(c.month); });
    return Array.from(set).sort(function (a, b) { return b.localeCompare(a); });
  }

  window.AppAccounting = {
    calculateMonthSummary: calculateMonthSummary,
    getObligationsStatus: getObligationsStatus,
    getAvailableMonths: getAvailableMonths,
  };
})();

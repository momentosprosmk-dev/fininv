(function () {
  function isDebtAccount(accounts, name) {
    return accounts.some(function (a) {
      return a.name === name && a.kind === 'deuda';
    });
  }

  function applyMovementToBalances(balances, accounts, mov) {
    var amount = Number(mov.amount) || 0;

    if (mov.type === 'Ingreso') {
      if (mov.toAccount in balances) {
        if (isDebtAccount(accounts, mov.toAccount)) {
          balances[mov.toAccount] -= amount;
        } else {
          balances[mov.toAccount] += amount;
        }
      }
      return;
    }

    if (mov.type === 'Egreso') {
      if (mov.fromAccount in balances) {
        if (isDebtAccount(accounts, mov.fromAccount)) {
          balances[mov.fromAccount] += amount;
        } else {
          balances[mov.fromAccount] -= amount;
        }
      }
      return;
    }

    if (mov.type === 'Traspaso') {
      if (mov.fromAccount in balances) {
        if (isDebtAccount(accounts, mov.fromAccount)) {
          balances[mov.fromAccount] += amount;
        } else {
          balances[mov.fromAccount] -= amount;
        }
      }
      if (mov.toAccount in balances) {
        if (isDebtAccount(accounts, mov.toAccount)) {
          balances[mov.toAccount] -= amount;
        } else {
          balances[mov.toAccount] += amount;
        }
      }
    }
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
      .filter(function (m) { return m.month <= targetMonth; })
      .sort(function (a, b) {
        return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
      });

    var totalIncome = 0;
    var totalConsumptionExpense = 0;
    var totalArqInvestment = 0;
    var ccExpensesInMonth = 0;
    var ccPaymentsInMonth = 0;
    var categoryTotals = new Map();

    relevantMovements.forEach(function (mov) {
      applyMovementToBalances(balances, data.accounts || [], mov);
      if (mov.month !== targetMonth) return;

      var amt = Number(mov.amount) || 0;
      if (mov.type === 'Ingreso') {
        totalIncome += amt;
      } else if (mov.type === 'Egreso') {
        var isArq = arqCategoryNames.has(mov.category);
        if (isArq) {
          totalArqInvestment += amt;
        } else {
          totalConsumptionExpense += amt;
        }
        if (isDebtAccount(data.accounts || [], mov.fromAccount)) {
          ccExpensesInMonth += amt;
        }
        categoryTotals.set(mov.category, (categoryTotals.get(mov.category) || 0) + amt);
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

    var expensesByCategory = Array.from(categoryTotals.entries())
      .map(function (entry) {
        return {
          category: entry[0],
          amount: entry[1],
          isArq: arqCategoryNames.has(entry[0]),
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
      ccSurplusOrDeficit: liquidityTotal - totalDebt,
      expensesByCategory: expensesByCategory,
    };
  }

  function getObligationsStatus(obligations, movements, month, accounts) {
    var monthMovs = (movements || []).filter(function (m) { return m.month === month; });
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
    (data.movements || []).forEach(function (m) { if (m.month) set.add(m.month); });
    (data.monthlyCloses || []).forEach(function (c) { if (c.month) set.add(c.month); });
    return Array.from(set).sort(function (a, b) { return b.localeCompare(a); });
  }

  window.AppAccounting = {
    calculateMonthSummary: calculateMonthSummary,
    getObligationsStatus: getObligationsStatus,
    getAvailableMonths: getAvailableMonths,
  };
})();

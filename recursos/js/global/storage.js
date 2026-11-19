(function () {
  var LOCAL_STORAGE_KEY = 'contabilidad_personal_cop_v1';
  var ARQ_CATEGORY = 'Inversión / Aporte ARQ';

  var DEFAULT_CATEGORIES = [
    { id: 'cat-e1', name: 'Arriendo', type: 'Egreso' },
    { id: 'cat-e2', name: 'Alimentación', type: 'Egreso' },
    { id: 'cat-e3', name: 'Transporte', type: 'Egreso' },
    { id: 'cat-e4', name: 'Auxilio para mamá', type: 'Egreso' },
    { id: 'cat-e5', name: 'Corte de cabello', type: 'Egreso' },
    { id: 'cat-e6', name: 'Gustos y entretenimiento', type: 'Egreso' },
    { id: 'cat-e7', name: 'Aporte a Inversión', type: 'Egreso', isArq: true },
    { id: 'cat-e8', name: 'Servicios / Suscripciones', type: 'Egreso' },
    { id: 'cat-e9', name: 'Salud / Otros', type: 'Egreso' },
    { id: 'cat-i1', name: 'Salario / Nómina', type: 'Ingreso' },
    { id: 'cat-i2', name: 'Freelance / Ventas', type: 'Ingreso' },
    { id: 'cat-i3', name: 'Retiro de Inversión', type: 'Ingreso' },
    { id: 'cat-i4', name: 'Reembolso / Otros', type: 'Ingreso' },
    { id: 'cat-t1', name: 'Pago TC', type: 'Traspaso' },
    { id: 'cat-t2', name: 'Recarga Billetera Digital', type: 'Traspaso' },
    { id: 'cat-t3', name: 'Retiro a Efectivo', type: 'Traspaso' },
    { id: 'cat-t4', name: 'Movimiento entre Cuentas', type: 'Traspaso' },
  ];

  function getCleanAppData() {
    return {
      categories: DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); }),
      accounts: [
        { name: 'Tarjeta de Débito', kind: 'liquidez', initialBalance: 0 },
        { name: 'Nequi', kind: 'liquidez', initialBalance: 0 },
        { name: 'Efectivo', kind: 'liquidez', initialBalance: 0 },
        { name: 'Tarjeta de Crédito', kind: 'deuda', initialBalance: 0, creditLimit: 2400000 },
      ],
      obligations: [
        { id: 'ob-1', name: 'Arriendo', category: 'Arriendo', estimatedAmount: 0, matchType: 'Egreso' },
        { id: 'ob-2', name: 'Auxilio para mamá', category: 'Auxilio para mamá', estimatedAmount: 0, matchType: 'Egreso' },
        { id: 'ob-3', name: 'Pago Tarjeta de Crédito', category: 'Pago TC', estimatedAmount: 0, matchType: 'PagoTC' },
      ],
      movements: [],
      monthlyCloses: [],
      investmentAccounts: [],
      subInvestments: [],
      investmentMovements: [],
      loans: [],
      loanPayments: [],
      exchangeRates: { USD: { live: 4300, custom: null, updatedAt: null } },
    };
  }

  function getDefaultAppData() {
    var currentMonth = window.AppFormat.getCurrentMonthKey();
    var parts = currentMonth.split('-').map(Number);
    var prevDate = new Date(parts[0], parts[1] - 2, 1);
    var prevMonth = prevDate.getFullYear() + '-' + String(prevDate.getMonth() + 1).padStart(2, '0');

    return {
      categories: DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); }),
      accounts: [
        { name: 'Tarjeta de Débito', kind: 'liquidez', initialBalance: 1200000 },
        { name: 'Nequi', kind: 'liquidez', initialBalance: 500000 },
        { name: 'Efectivo', kind: 'liquidez', initialBalance: 150000 },
        { name: 'Tarjeta de Crédito', kind: 'deuda', initialBalance: 0, creditLimit: 2400000 },
        { name: 'Crédito Libre Inversión', kind: 'credito', initialBalance: 6000000, totalMonths: 24, monthlyInstallment: 300000, dueDay: 15, startMonth: currentMonth, inMora: false },
      ],
      obligations: [
        { id: 'ob-1', name: 'Arriendo', category: 'Arriendo', estimatedAmount: 1350000, matchType: 'Egreso' },
        { id: 'ob-2', name: 'Auxilio para mamá', category: 'Auxilio para mamá', estimatedAmount: 400000, matchType: 'Egreso' },
        { id: 'ob-3', name: 'Pago Tarjeta de Crédito', category: 'Pago TC', estimatedAmount: 0, matchType: 'PagoTC' },
      ],
      movements: [
        { id: 'demo-1', date: prevMonth + '-01', month: prevMonth, type: 'Ingreso', fromAccount: 'Externo', toAccount: 'Tarjeta de Débito', category: 'Salario / Nómina', description: 'Nómina mensual', amount: 4200000, createdAt: prevMonth + '-01T09:00:00Z' },
        { id: 'demo-2', date: prevMonth + '-03', month: prevMonth, type: 'Egreso', fromAccount: 'Tarjeta de Débito', toAccount: 'Externo', category: 'Arriendo', description: 'Arriendo apartamento', amount: 1350000, createdAt: prevMonth + '-03T10:00:00Z' },
        { id: 'demo-3', date: prevMonth + '-05', month: prevMonth, type: 'Egreso', fromAccount: 'Nequi', toAccount: 'Externo', category: 'Auxilio para mamá', description: 'Transferencia mensual mamá', amount: 400000, createdAt: prevMonth + '-05T11:00:00Z' },
        { id: 'demo-4', date: prevMonth + '-10', month: prevMonth, type: 'Egreso', fromAccount: 'Tarjeta de Crédito', toAccount: 'Externo', category: 'Alimentación', description: 'Mercado del mes', amount: 680000, createdAt: prevMonth + '-10T16:00:00Z' },
        { id: 'demo-5', date: prevMonth + '-15', month: prevMonth, type: 'Egreso', fromAccount: 'Tarjeta de Débito', toAccount: 'ARQ', category: ARQ_CATEGORY, description: 'Inversión bolsa ARQ', amount: 800000, createdAt: prevMonth + '-15T14:00:00Z' },
        { id: 'demo-6', date: prevMonth + '-28', month: prevMonth, type: 'Traspaso', fromAccount: 'Tarjeta de Débito', toAccount: 'Tarjeta de Crédito', category: 'Pago TC', description: 'Pago total tarjeta de crédito', amount: 680000, createdAt: prevMonth + '-28T18:00:00Z' },
        { id: 'demo-7', date: currentMonth + '-01', month: currentMonth, type: 'Ingreso', fromAccount: 'Externo', toAccount: 'Tarjeta de Débito', category: 'Salario / Nómina', description: 'Nómina mensual', amount: 4200000, createdAt: currentMonth + '-01T09:00:00Z' },
        { id: 'demo-8', date: currentMonth + '-02', month: currentMonth, type: 'Traspaso', fromAccount: 'Tarjeta de Débito', toAccount: 'Nequi', category: 'Traspaso', description: 'Recarga Nequi para gastos diarios', amount: 500000, createdAt: currentMonth + '-02T10:00:00Z' },
        { id: 'demo-9', date: currentMonth + '-03', month: currentMonth, type: 'Egreso', fromAccount: 'Tarjeta de Débito', toAccount: 'Externo', category: 'Arriendo', description: 'Arriendo mes actual', amount: 1350000, createdAt: currentMonth + '-03T11:00:00Z' },
        { id: 'demo-10', date: currentMonth + '-06', month: currentMonth, type: 'Egreso', fromAccount: 'Tarjeta de Crédito', toAccount: 'Externo', category: 'Alimentación', description: 'Supermercado + restaurantes', amount: 520000, createdAt: currentMonth + '-06T17:00:00Z' },
        { id: 'demo-11', date: currentMonth + '-08', month: currentMonth, type: 'Egreso', fromAccount: 'Tarjeta de Crédito', toAccount: 'Externo', category: 'Gustos y entretenimiento', description: 'Cine y salida fin de semana', amount: 190000, createdAt: currentMonth + '-08T21:00:00Z' },
        { id: 'demo-12', date: currentMonth + '-10', month: currentMonth, type: 'Egreso', fromAccount: 'Efectivo', toAccount: 'Externo', category: 'Corte de cabello', description: 'Barbería', amount: 35000, createdAt: currentMonth + '-10T15:00:00Z' },
        { id: 'demo-13', date: currentMonth + '-12', month: currentMonth, type: 'Traspaso', fromAccount: 'Tarjeta de Débito', toAccount: 'Crédito Libre Inversión', category: 'Movimiento entre Cuentas', description: 'Cuota mensual crédito', amount: 300000, createdAt: currentMonth + '-12T10:00:00Z' },
      ],
      monthlyCloses: [
        {
          month: prevMonth,
          closedAt: prevMonth + '-30T20:00:00Z',
          totalIncome: 4200000,
          totalConsumptionExpense: 2430000,
          totalArqInvestment: 800000,
          debitBalance: 1490000,
          nequiBalance: 100000,
          cashBalance: 150000,
          ccDebt: 0,
          liquidityTotal: 1740000,
          ccSurplusOrDeficit: 1740000,
          notes: 'Mes cerrado con pago total de TC y aporte a ARQ.',
        },
      ],
    };
  }

  function loadLocalData() {
    try {
      var raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return getDefaultAppData();
      var parsed = JSON.parse(raw);
      return Object.assign({}, parsed, {
        categories:
          parsed.categories && parsed.categories.length > 0
            ? parsed.categories
            : DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); }),
        investmentAccounts: parsed.investmentAccounts || [],
        subInvestments: parsed.subInvestments || [],
        investmentMovements: parsed.investmentMovements || [],
        loans: parsed.loans || [],
        loanPayments: parsed.loanPayments || [],
        exchangeRates: parsed.exchangeRates || { USD: { live: 4300, custom: null, updatedAt: null } },
      });
    } catch (e) {
      return getDefaultAppData();
    }
  }

  function saveLocalData(data) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // ignore storage quota errors
    }
  }

  window.AppStorage = {
    ARQ_CATEGORY: ARQ_CATEGORY,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    getCleanAppData: getCleanAppData,
    getDefaultAppData: getDefaultAppData,
    loadLocalData: loadLocalData,
    saveLocalData: saveLocalData,
  };
})();

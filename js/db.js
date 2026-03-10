/**
 * FinTrack DB - localStorage engine
 * All data operations go through this module
 */

const DB = (() => {
  const PREFIX = 'fintrack_';

  const keys = {
    transactions: PREFIX + 'transactions',
    categories:   PREFIX + 'categories',
    wallets:      PREFIX + 'wallets',
    budgets:      PREFIX + 'budgets',
    recurring:    PREFIX + 'recurring',
    settings:     PREFIX + 'settings',
  };

  // --- Generic CRUD ---
  function _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- Settings ---
  const defaultSettings = {
    appName:    'Ditz Money',
    currency:   'IDR',
    locale:     'id-ID',
    pinEnabled: false,
    pin:        '',
    activeWallet: null,
    theme:      'dark',
    firstDay:   1, // 1=Monday, 0=Sunday
  };
  function getSettings() {
    return Object.assign({}, defaultSettings, _get(keys.settings) || {});
  }
  function saveSettings(data) {
    _set(keys.settings, Object.assign(getSettings(), data));
  }

  // --- Wallets ---
  const defaultWallets = [
    { id: 'w1', name: 'Kas',  type: 'cash',  balance: 0, color: '#00e5ff', icon: 'fa-wallet',    createdAt: Date.now() },
    { id: 'w2', name: 'Bank', type: 'bank',  balance: 0, color: '#2979ff', icon: 'fa-building-columns', createdAt: Date.now() },
  ];
  function getWallets() {
    const data = _get(keys.wallets);
    return data && data.length ? data : defaultWallets;
  }
  function saveWallets(wallets) { _set(keys.wallets, wallets); }
  function addWallet(w) {
    const wallets = getWallets();
    w.id = 'w' + Date.now();
    w.createdAt = Date.now();
    wallets.push(w);
    saveWallets(wallets);
    return w;
  }
  function updateWallet(id, data) {
    const wallets = getWallets().map(w => w.id === id ? Object.assign({}, w, data) : w);
    saveWallets(wallets);
  }
  function deleteWallet(id) {
    saveWallets(getWallets().filter(w => w.id !== id));
  }
  function getActiveWallet() {
    const settings = getSettings();
    const wallets  = getWallets();
    return wallets.find(w => w.id === settings.activeWallet) || wallets[0];
  }

  // --- Categories ---
  const defaultCategories = [
    // Expense
    { id: 'c1',  name: 'Makanan',     type: 'expense', color: '#ff6d00', icon: 'fa-utensils' },
    { id: 'c2',  name: 'Transport',   type: 'expense', color: '#2979ff', icon: 'fa-car' },
    { id: 'c3',  name: 'Belanja',     type: 'expense', color: '#f50057', icon: 'fa-bag-shopping' },
    { id: 'c4',  name: 'Hiburan',     type: 'expense', color: '#d500f9', icon: 'fa-gamepad' },
    { id: 'c5',  name: 'Kesehatan',   type: 'expense', color: '#00e676', icon: 'fa-heart-pulse' },
    { id: 'c6',  name: 'Pendidikan',  type: 'expense', color: '#ffd740', icon: 'fa-graduation-cap' },
    { id: 'c7',  name: 'Tagihan',     type: 'expense', color: '#ff1744', icon: 'fa-file-invoice' },
    { id: 'c8',  name: 'Lainnya',     type: 'expense', color: '#8b92b3', icon: 'fa-ellipsis' },
    // Income
    { id: 'c9',  name: 'Gaji',        type: 'income',  color: '#00e676', icon: 'fa-money-bill-wave' },
    { id: 'c10', name: 'Freelance',   type: 'income',  color: '#00e5ff', icon: 'fa-laptop-code' },
    { id: 'c11', name: 'Investasi',   type: 'income',  color: '#ffd740', icon: 'fa-chart-line' },
    { id: 'c12', name: 'Bonus',       type: 'income',  color: '#1de9b6', icon: 'fa-gift' },
    { id: 'c13', name: 'Lainnya',     type: 'income',  color: '#8b92b3', icon: 'fa-ellipsis' },
  ];
  function getCategories() {
    const data = _get(keys.categories);
    return data && data.length ? data : defaultCategories;
  }
  function saveCategories(cats) { _set(keys.categories, cats); }
  function addCategory(cat) {
    const cats = getCategories();
    cat.id = 'cat' + Date.now();
    cats.push(cat);
    saveCategories(cats);
    return cat;
  }
  function updateCategory(id, data) {
    saveCategories(getCategories().map(c => c.id === id ? Object.assign({}, c, data) : c));
  }
  function deleteCategory(id) {
    saveCategories(getCategories().filter(c => c.id !== id));
  }

  // --- Transactions ---
  function getTransactions() { return _get(keys.transactions) || []; }
  function saveTransactions(txns) { _set(keys.transactions, txns); }
  function addTransaction(txn) {
    const txns = getTransactions();
    txn.id = 'txn' + Date.now() + Math.random().toString(36).slice(2, 6);
    txn.createdAt = Date.now();
    txns.unshift(txn);
    saveTransactions(txns);
    // update wallet balance
    _updateWalletBalance(txn.walletId, txn.type === 'income' ? txn.amount : -txn.amount);
    return txn;
  }
  function updateTransaction(id, data) {
    const txns = getTransactions();
    const idx  = txns.findIndex(t => t.id === id);
    if (idx === -1) return;
    const old = txns[idx];
    // reverse old effect
    _updateWalletBalance(old.walletId, old.type === 'income' ? -old.amount : old.amount);
    const updated = Object.assign({}, old, data);
    txns[idx] = updated;
    saveTransactions(txns);
    // apply new effect
    _updateWalletBalance(updated.walletId, updated.type === 'income' ? updated.amount : -updated.amount);
    return updated;
  }
  function deleteTransaction(id) {
    const txns = getTransactions();
    const txn  = txns.find(t => t.id === id);
    if (!txn) return;
    _updateWalletBalance(txn.walletId, txn.type === 'income' ? -txn.amount : txn.amount);
    saveTransactions(txns.filter(t => t.id !== id));
  }
  function _updateWalletBalance(walletId, delta) {
    const wallets = getWallets();
    const w = wallets.find(x => x.id === walletId);
    if (w) { w.balance = (w.balance || 0) + delta; saveWallets(wallets); }
  }

  // --- Budgets ---
  function getBudgets() { return _get(keys.budgets) || []; }
  function saveBudgets(b) { _set(keys.budgets, b); }
  function addBudget(b) {
    const budgets = getBudgets();
    b.id = 'bgt' + Date.now();
    b.createdAt = Date.now();
    budgets.push(b);
    saveBudgets(budgets);
    return b;
  }
  function updateBudget(id, data) {
    saveBudgets(getBudgets().map(b => b.id === id ? Object.assign({}, b, data) : b));
  }
  function deleteBudget(id) {
    saveBudgets(getBudgets().filter(b => b.id !== id));
  }

  // --- Recurring ---
  function getRecurring() { return _get(keys.recurring) || []; }
  function saveRecurring(r) { _set(keys.recurring, r); }
  function addRecurring(r) {
    const list = getRecurring();
    r.id = 'rec' + Date.now();
    r.createdAt = Date.now();
    r.lastRun = null;
    list.push(r);
    saveRecurring(list);
    return r;
  }
  function updateRecurring(id, data) {
    saveRecurring(getRecurring().map(r => r.id === id ? Object.assign({}, r, data) : r));
  }
  function deleteRecurring(id) {
    saveRecurring(getRecurring().filter(r => r.id !== id));
  }

  // --- Backup & Restore ---
  function exportBackup() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      appName: 'Ditz Money',
      data: {
        transactions: getTransactions(),
        categories:   getCategories(),
        wallets:      getWallets(),
        budgets:      getBudgets(),
        recurring:    getRecurring(),
        settings:     getSettings(),
      }
    };
  }
  function importBackup(backup) {
    if (!backup || !backup.data) throw new Error('Format backup tidak valid');
    const d = backup.data;
    if (d.transactions) saveTransactions(d.transactions);
    if (d.categories)   saveCategories(d.categories);
    if (d.wallets)      saveWallets(d.wallets);
    if (d.budgets)      saveBudgets(d.budgets);
    if (d.recurring)    saveRecurring(d.recurring);
    if (d.settings)     saveSettings(d.settings);
  }
  function clearAll() {
    Object.values(keys).forEach(k => localStorage.removeItem(k));
  }

  // --- Aggregates ---
  function getTransactionsByPeriod(year, month) {
    return getTransactions().filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }
  function getSummary(year, month) {
    const txns = getTransactionsByPeriod(year, month);
    const income  = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense, count: txns.length };
  }
  function getCategoryTotals(year, month, type) {
    const txns = getTransactionsByPeriod(year, month).filter(t => t.type === type);
    const cats = getCategories();
    const map  = {};
    txns.forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([catId, total]) => {
      const cat = cats.find(c => c.id === catId) || { name: 'Lainnya', color: '#8b92b3', icon: 'fa-ellipsis' };
      return { catId, name: cat.name, color: cat.color, icon: cat.icon, total };
    }).sort((a, b) => b.total - a.total);
  }
  function getMonthlyTrend(year) {
    const result = [];
    for (let m = 0; m < 12; m++) {
      const s = getSummary(year, m);
      result.push({ month: m, ...s });
    }
    return result;
  }
  function getBudgetSpending(budget, year, month) {
    const txns = getTransactionsByPeriod(year, month)
      .filter(t => t.type === 'expense' && t.categoryId === budget.categoryId);
    return txns.reduce((s, t) => s + t.amount, 0);
  }

  // --- Recurring engine ---
  function processRecurring() {
    const list  = getRecurring();
    const today = new Date();
    today.setHours(0,0,0,0);
    list.forEach(rec => {
      if (!rec.active) return;
      const last = rec.lastRun ? new Date(rec.lastRun) : null;
      let due = false;
      if (!last) {
        due = new Date(rec.startDate) <= today;
      } else {
        const next = new Date(last);
        if (rec.frequency === 'daily')   next.setDate(next.getDate() + 1);
        if (rec.frequency === 'weekly')  next.setDate(next.getDate() + 7);
        if (rec.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
        if (rec.frequency === 'yearly')  next.setFullYear(next.getFullYear() + 1);
        due = next <= today;
      }
      if (due) {
        addTransaction({
          type:       rec.type,
          amount:     rec.amount,
          categoryId: rec.categoryId,
          walletId:   rec.walletId,
          note:       rec.name + ' (otomatis)',
          date:       today.toISOString().slice(0, 10),
        });
        updateRecurring(rec.id, { lastRun: today.toISOString().slice(0, 10) });
      }
    });
  }

  return {
    getSettings, saveSettings,
    getWallets, saveWallets, addWallet, updateWallet, deleteWallet, getActiveWallet,
    getCategories, saveCategories, addCategory, updateCategory, deleteCategory,
    getTransactions, saveTransactions, addTransaction, updateTransaction, deleteTransaction,
    getBudgets, addBudget, updateBudget, deleteBudget,
    getRecurring, addRecurring, updateRecurring, deleteRecurring,
    exportBackup, importBackup, clearAll,
    getTransactionsByPeriod, getSummary, getCategoryTotals, getMonthlyTrend, getBudgetSpending,
    processRecurring,
  };
})();
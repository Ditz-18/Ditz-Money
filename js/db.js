

const DB = (() => {
  const PREFIX = 'fintrack_';

  const keys = {
    transactions:  PREFIX + 'transactions',
    categories:    PREFIX + 'categories',
    wallets:       PREFIX + 'wallets',
    budgets:       PREFIX + 'budgets',
    recurring:     PREFIX + 'recurring',
    settings:      PREFIX + 'settings',
    notes:         PREFIX + 'notes',
    goals:         PREFIX + 'goals',
    installments:  PREFIX + 'installments',
    networth:      PREFIX + 'networth',
    receipts:      PREFIX + 'receipts',
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
        transactions:  getTransactions(),
        categories:    getCategories(),
        wallets:       getWallets(),
        budgets:       getBudgets(),
        recurring:     getRecurring(),
        notes:         getNotes(),
        goals:         getGoals(),
        installments:  getInstallments(),
        networthItems: getNetworthItems(),
        networthSnaps: getNetworthSnaps(),
        receipts:      getReceipts(),
        settings:      getSettings(),
      }
    };
  }
  function importBackup(backup) {
    if (!backup || !backup.data) throw new Error('Format backup tidak valid');
    const d = backup.data;
    if (d.transactions)  saveTransactions(d.transactions);
    if (d.categories)    saveCategories(d.categories);
    if (d.wallets)       saveWallets(d.wallets);
    if (d.budgets)       saveBudgets(d.budgets);
    if (d.recurring)     saveRecurring(d.recurring);
    if (d.notes)         saveNotes(d.notes);
    if (d.goals)         saveGoals(d.goals);
    if (d.installments)  saveInstallments(d.installments);
    if (d.networthItems) saveNetworthItems(d.networthItems);
    if (d.networthSnaps) saveNetworthSnaps(d.networthSnaps);
    if (d.receipts)      saveReceipts(d.receipts);
    if (d.settings)      saveSettings(d.settings);
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

  // --- Transfer Antar Dompet ---
  function addTransfer({ fromWalletId, toWalletId, amount, date, note }) {
    const transferId = 'trf' + Date.now();
    const txns = getTransactions();

    const out = {
      id: 'txn' + Date.now() + 'a',
      type: 'expense',
      amount,
      categoryId: '__transfer__',
      walletId: fromWalletId,
      note: note || 'Transfer ke ' + (getWallets().find(w => w.id === toWalletId)?.name || ''),
      date,
      isTransfer: true,
      transferId,
      transferTo: toWalletId,
      createdAt: Date.now(),
    };
    const inn = {
      id: 'txn' + (Date.now() + 1) + 'b',
      type: 'income',
      amount,
      categoryId: '__transfer__',
      walletId: toWalletId,
      note: note || 'Transfer dari ' + (getWallets().find(w => w.id === fromWalletId)?.name || ''),
      date,
      isTransfer: true,
      transferId,
      transferFrom: fromWalletId,
      createdAt: Date.now() + 1,
    };

    txns.unshift(inn);
    txns.unshift(out);
    saveTransactions(txns);
    _updateWalletBalance(fromWalletId, -amount);
    _updateWalletBalance(toWalletId,   +amount);
    return { out, inn };
  }

  function deleteTransfer(transferId) {
    const txns = getTransactions();
    const pair = txns.filter(t => t.transferId === transferId);
    pair.forEach(t => {
      _updateWalletBalance(t.walletId, t.type === 'income' ? -t.amount : t.amount);
    });
    saveTransactions(txns.filter(t => t.transferId !== transferId));
  }

  // --- Notes / Catatan Keuangan ---
  const NOTE_COLORS = ['#00e5ff','#00e676','#ffd740','#ff6d00','#f50057','#d500f9','#2979ff','#1de9b6'];

  function getNotes() { return _get(keys.notes) || []; }
  function saveNotes(notes) { _set(keys.notes, notes); }

  function addNote(note) {
    const notes = getNotes();
    note.id        = 'note' + Date.now();
    note.createdAt = Date.now();
    note.updatedAt = Date.now();
    notes.unshift(note);
    saveNotes(notes);
    return note;
  }

  function updateNote(id, data) {
    const notes = getNotes().map(n =>
      n.id === id ? Object.assign({}, n, data, { updatedAt: Date.now() }) : n
    );
    saveNotes(notes);
  }

  function deleteNote(id) {
    saveNotes(getNotes().filter(n => n.id !== id));
  }

  function pinNote(id, pinned) {
    updateNote(id, { pinned });
  }

  // --- Goals / Target Tabungan ---
  function getGoals() { return _get(keys.goals) || []; }
  function saveGoals(g) { _set(keys.goals, g); }

  function addGoal(goal) {
    const goals = getGoals();
    goal.id        = 'goal' + Date.now();
    goal.createdAt = Date.now();
    goal.savedAmount = goal.savedAmount || 0;
    goals.push(goal);
    saveGoals(goals);
    return goal;
  }

  function updateGoal(id, data) {
    saveGoals(getGoals().map(g => g.id === id ? Object.assign({}, g, data) : g));
  }

  function deleteGoal(id) {
    saveGoals(getGoals().filter(g => g.id !== id));
  }

  // Tambah tabungan ke goal (kurangi dari wallet)
  function addSavingToGoal(goalId, amount, walletId) {
    const goal = getGoals().find(g => g.id === goalId);
    if (!goal) return;
    const newSaved = (goal.savedAmount || 0) + amount;
    updateGoal(goalId, {
      savedAmount: newSaved,
      completedAt: newSaved >= goal.targetAmount ? Date.now() : null,
    });
    // Kurangi dari wallet sebagai pengeluaran
    if (walletId) {
      _updateWalletBalance(walletId, -amount);
      // Catat sebagai transaksi tabungan
      addTransaction({
        type: 'expense',
        amount,
        categoryId: '__saving__',
        walletId,
        note: 'Tabungan: ' + goal.name,
        date: new Date().toISOString().slice(0, 10),
        isGoalSaving: true,
        goalId,
      });
    }
  }

  // Tarik tabungan dari goal (kembalikan ke wallet)
  function withdrawFromGoal(goalId, amount, walletId) {
    const goal = getGoals().find(g => g.id === goalId);
    if (!goal) return;
    const newSaved = Math.max(0, (goal.savedAmount || 0) - amount);
    updateGoal(goalId, { savedAmount: newSaved, completedAt: null });
    if (walletId) {
      _updateWalletBalance(walletId, +amount);
      addTransaction({
        type: 'income',
        amount,
        categoryId: '__saving__',
        walletId,
        note: 'Penarikan tabungan: ' + goal.name,
        date: new Date().toISOString().slice(0, 10),
        isGoalSaving: true,
        goalId,
      });
    }
  }

  // --- Installments / Cicilan ---
  function getInstallments() { return _get(keys.installments) || []; }
  function saveInstallments(data) { _set(keys.installments, data); }

  function addInstallment(inst) {
    const list = getInstallments();
    inst.id         = 'inst' + Date.now();
    inst.createdAt  = Date.now();
    inst.paidCount  = 0;
    inst.payments   = []; // [{date, amount, note, walletId}]
    list.push(inst);
    saveInstallments(list);
    return inst;
  }

  function updateInstallment(id, data) {
    saveInstallments(getInstallments().map(i =>
      i.id === id ? Object.assign({}, i, data) : i
    ));
  }

  function deleteInstallment(id) {
    saveInstallments(getInstallments().filter(i => i.id !== id));
  }

  // Catat pembayaran cicilan bulan ini
  function payInstallment(id, walletId, customAmount, note) {
    const list = getInstallments();
    const inst = list.find(i => i.id === id);
    if (!inst) return;

    const amount = customAmount || inst.monthlyAmount;
    const date   = new Date().toISOString().slice(0, 10);

    // Tambah ke riwayat pembayaran cicilan
    const payments = inst.payments || [];
    payments.push({ date, amount, walletId, note: note || inst.name });
    const paidCount = payments.length;
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const isDone    = paidCount >= inst.totalMonths || totalPaid >= inst.totalAmount;

    updateInstallment(id, {
      payments,
      paidCount,
      totalPaid,
      completedAt: isDone ? Date.now() : null,
      active: !isDone,
    });

    // Kurangi saldo dompet & catat transaksi
    _updateWalletBalance(walletId, -amount);
    addTransaction({
      type:        'expense',
      amount,
      categoryId:  '__installment__',
      walletId,
      note:        `Cicilan: ${inst.name} (${paidCount}/${inst.totalMonths})`,
      date,
      isInstallment: true,
      installmentId: id,
    });

    return { isDone, paidCount, totalPaid };
  }

  // Hitung info cicilan
  function getInstallmentInfo(inst) {
    const payments   = inst.payments || [];
    const totalPaid  = payments.reduce((s, p) => s + p.amount, 0);
    const paidCount  = payments.length;
    const remaining  = Math.max(0, inst.totalAmount - totalPaid);
    const monthsLeft = Math.max(0, inst.totalMonths - paidCount);
    const pct        = inst.totalAmount > 0 ? Math.min(100, (totalPaid / inst.totalAmount) * 100) : 0;

    // Next payment date
    let nextDate = null;
    if (inst.startDate && paidCount < inst.totalMonths) {
      const d = new Date(inst.startDate);
      d.setMonth(d.getMonth() + paidCount);
      nextDate = d.toISOString().slice(0, 10);
    }

    // Overdue check
    const today     = new Date(); today.setHours(0,0,0,0);
    const isOverdue = nextDate && new Date(nextDate) < today && paidCount < inst.totalMonths;

    return { totalPaid, paidCount, remaining, monthsLeft, pct, nextDate, isOverdue };
  }

  // --- Net Worth ---
  // items: manual aset/hutang di luar dompet app
  // snapshots: rekam riwayat net worth per waktu

  function getNetworthItems()  { return _get(keys.networth + '_items')     || []; }
  function saveNetworthItems(d){ _set(keys.networth + '_items', d); }
  function getNetworthSnaps()  { return _get(keys.networth + '_snaps')     || []; }
  function saveNetworthSnaps(d){ _set(keys.networth + '_snaps', d); }

  function addNetworthItem(item) {
    const list = getNetworthItems();
    item.id        = 'nwi' + Date.now();
    item.createdAt = Date.now();
    list.push(item);
    saveNetworthItems(list);
    return item;
  }
  function updateNetworthItem(id, data) {
    saveNetworthItems(getNetworthItems().map(i => i.id === id ? Object.assign({}, i, data) : i));
  }
  function deleteNetworthItem(id) {
    saveNetworthItems(getNetworthItems().filter(i => i.id !== id));
  }

  // Rekam snapshot net worth saat ini
  function recordNetworthSnapshot() {
    const snaps = getNetworthSnaps();
    const nw    = calcNetWorth();
    snaps.push({ date: new Date().toISOString().slice(0,10), ...nw, recordedAt: Date.now() });
    // Keep max 36 snapshots (3 years monthly)
    if (snaps.length > 36) snaps.splice(0, snaps.length - 36);
    saveNetworthSnaps(snaps);
  }

  // Hitung net worth saat ini
  function calcNetWorth() {
    const wallets      = getWallets();
    const items        = getNetworthItems();
    const installments = getInstallments();
    const goals        = getGoals();

    // Aset dari dompet
    const walletAssets = wallets.reduce((s, w) => s + Math.max(0, w.balance || 0), 0);

    // Aset dari goals (tabungan terkumpul)
    const goalAssets   = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);

    // Aset manual
    const manualAssets = items.filter(i => i.kind === 'asset').reduce((s, i) => s + (i.amount || 0), 0);

    // Hutang cicilan aktif
    const instDebt = installments
      .filter(i => !i.completedAt)
      .reduce((s, i) => {
        const info = getInstallmentInfo(i);
        return s + (info.remaining || 0);
      }, 0);

    // Hutang manual
    const manualDebt = items.filter(i => i.kind === 'debt').reduce((s, i) => s + (i.amount || 0), 0);

    const totalAssets = walletAssets + goalAssets + manualAssets;
    const totalDebt   = instDebt + manualDebt;
    const netWorth    = totalAssets - totalDebt;

    return {
      totalAssets, totalDebt, netWorth,
      walletAssets, goalAssets, manualAssets,
      instDebt, manualDebt,
    };
  }

  // --- Receipts / Struk ---
  // receipt: { id, transactionId, storeName, date, items:[{name,qty,price}],
  //            subtotal, tax, discount, total, thumbnail, createdAt }

  function getReceipts()    { return _get(keys.receipts) || []; }
  function saveReceipts(r)  { _set(keys.receipts, r); }

  function addReceipt(receipt) {
    const list = getReceipts();
    receipt.id        = 'rct' + Date.now();
    receipt.createdAt = Date.now();
    list.unshift(receipt);
    saveReceipts(list);
    return receipt;
  }

  function updateReceipt(id, data) {
    saveReceipts(getReceipts().map(r =>
      r.id === id ? Object.assign({}, r, data) : r
    ));
  }

  function deleteReceipt(id) {
    saveReceipts(getReceipts().filter(r => r.id !== id));
  }

  function getReceiptByTransactionId(txnId) {
    return getReceipts().find(r => r.transactionId === txnId) || null;
  }

  // Compress image to thumbnail (max 200px, quality 0.5)
  function compressImage(dataUrl, maxSize, quality) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio  = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.5));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  return {
    getSettings, saveSettings,
    getWallets, saveWallets, addWallet, updateWallet, deleteWallet, getActiveWallet,
    getCategories, saveCategories, addCategory, updateCategory, deleteCategory,
    getTransactions, saveTransactions, addTransaction, updateTransaction, deleteTransaction,
    addTransfer, deleteTransfer,
    getBudgets, addBudget, updateBudget, deleteBudget,
    getRecurring, addRecurring, updateRecurring, deleteRecurring,
    getNotes, saveNotes, addNote, updateNote, deleteNote, pinNote,
    NOTE_COLORS,
    getGoals, saveGoals, addGoal, updateGoal, deleteGoal, addSavingToGoal, withdrawFromGoal,
    getInstallments, saveInstallments, addInstallment, updateInstallment, deleteInstallment, payInstallment, getInstallmentInfo,
    getNetworthItems, saveNetworthItems, addNetworthItem, updateNetworthItem, deleteNetworthItem,
    getNetworthSnaps, recordNetworthSnapshot, calcNetWorth,
    getReceipts, saveReceipts, addReceipt, updateReceipt, deleteReceipt,
    getReceiptByTransactionId, compressImage,
    exportBackup, importBackup, clearAll,
    getTransactionsByPeriod, getSummary, getCategoryTotals, getMonthlyTrend, getBudgetSpending,
    processRecurring,
  };
})();
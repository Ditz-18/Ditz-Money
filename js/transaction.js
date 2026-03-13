
const TransactionPage = (() => {

  const CATEGORY_ICONS = [
    'fa-utensils','fa-car','fa-bag-shopping','fa-gamepad','fa-heart-pulse',
    'fa-graduation-cap','fa-file-invoice','fa-house','fa-bolt','fa-phone',
    'fa-shirt','fa-plane','fa-music','fa-dog','fa-dumbbell','fa-coffee',
    'fa-book','fa-laptop','fa-tv','fa-gift','fa-money-bill-wave','fa-chart-line',
    'fa-wallet','fa-building-columns','fa-piggy-bank','fa-hand-holding-dollar',
    'fa-briefcase','fa-tools','fa-paint-brush','fa-camera','fa-bicycle',
    'fa-bus','fa-train','fa-ship','fa-gas-pump','fa-parking','fa-ellipsis',
  ];

  const COLORS = [
    '#00e5ff','#00e676','#ffd740','#ff6d00','#f50057',
    '#d500f9','#2979ff','#1de9b6','#ff1744','#c6ff00',
    '#ff6e40','#40c4ff','#b2ff59','#ea80fc','#ff80ab',
  ];

  let editingId = null;
  let selectedType = 'expense';

  function render() {
    const container = document.getElementById('page-transaction');
    const cats   = DB.getCategories();
    const wallets = DB.getWallets();
    const settings = DB.getSettings();
    const today  = Utils.todayStr();

    container.innerHTML = `
      <div class="page-header">
        <h1>Catat Transaksi</h1>
        <button class="btn btn-ghost btn-sm" onclick="App.navigate('scan')">
          <i class="fa-solid fa-receipt" style="color:var(--cyan)"></i> Scan Struk
        </button>
      </div>

      <div style="max-width:560px;margin:0 auto">
        <div class="card" id="txn-form-card">
          <!-- Type toggle -->
          <div class="form-group">
            <div class="type-toggle">
              <div class="type-toggle-btn income ${selectedType === 'income' ? 'active' : ''}" onclick="TransactionPage.setType('income')">
                <i class="fa-solid fa-arrow-trend-up"></i> Pemasukan
              </div>
              <div class="type-toggle-btn expense ${selectedType === 'expense' ? 'active' : ''}" onclick="TransactionPage.setType('expense')">
                <i class="fa-solid fa-arrow-trend-down"></i> Pengeluaran
              </div>
            </div>
          </div>

          <!-- Amount -->
          <div class="form-group">
            <label class="form-label">Jumlah</label>
            <div style="position:relative">
              <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:14px;font-weight:600" id="txn-currency-symbol">${settings.currency === 'IDR' ? 'Rp' : settings.currency}</span>
              <input type="text" inputmode="numeric" id="txn-amount" class="form-control"
                placeholder="0"
                style="padding-left:48px;font-size:20px;font-family:var(--font-display);font-weight:700"
                oninput="TransactionPage.onAmountInput(this);App.setFormDirty(true)"
                onkeydown="return TransactionPage.onAmountKeydown(event)">
            </div>
            <div id="txn-amount-hint" class="form-hint" style="display:none"></div>
          </div>

          <div class="form-row">
            <!-- Category -->
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <select id="txn-category" class="form-control">
                ${cats.filter(c => c.type === selectedType).map(c => `
                  <option value="${c.id}">${c.name}</option>
                `).join('')}
              </select>
            </div>
            <!-- Date -->
            <div class="form-group">
              <label class="form-label">Tanggal</label>
              <input type="date" id="txn-date" class="form-control" value="${today}">
            </div>
          </div>

          <!-- Wallet -->
          <div class="form-group">
            <label class="form-label">Dompet</label>
            <select id="txn-wallet" class="form-control">
              ${wallets.map(w => `
                <option value="${w.id}" ${w.id === DB.getActiveWallet().id ? 'selected' : ''}>${w.name}</option>
              `).join('')}
            </select>
          </div>

          <!-- Note -->
          <div class="form-group">
            <label class="form-label">Catatan <span class="text-muted">(opsional)</span></label>
            <input type="text" id="txn-note" class="form-control" placeholder="Tambah catatan...">
          </div>

          <!-- Actions -->
          <div style="display:flex;gap:10px;margin-top:8px">
            <button class="btn btn-ghost" style="flex:1" onclick="TransactionPage.reset()">
              <i class="fa-solid fa-rotate-left"></i> Reset
            </button>
            <button class="btn btn-primary" style="flex:2" id="txn-submit-btn" onclick="TransactionPage.submit()">
              <i class="fa-solid fa-plus"></i> Simpan Transaksi
            </button>
          </div>
        </div>

        <!-- Quick stats today -->
        <div class="card" style="margin-top:16px">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-calendar-day" style="color:var(--cyan)"></i> Hari Ini</span>
          </div>
          <div id="today-summary"></div>
        </div>
      </div>
    `;
    _renderTodaySummary();
  }

  function setType(type) {
    selectedType = type;
    const cats = DB.getCategories().filter(c => c.type === type);
    document.getElementById('txn-category').innerHTML = cats.map(c =>
      `<option value="${c.id}">${c.name}</option>`
    ).join('');
    document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.type-toggle-btn.${type}`).classList.add('active');
  }

  function onAmountInput(input) {
    // Strip non-numeric except dot
    let raw = input.value.replace(/[^0-9]/g, '');
    if (raw === '') { input.value = ''; _hideAmountHint(); return; }
    // Prevent leading zeros
    raw = String(parseInt(raw, 10));
    // Format with thousand separator
    input.value = Number(raw).toLocaleString('id-ID');
    // Show hint
    const num = parseInt(raw, 10);
    if (num > 0) {
      const hint = document.getElementById('txn-amount-hint');
      if (hint) {
        hint.style.display = 'block';
        hint.style.color   = 'var(--teal)';
        hint.textContent   = Utils.formatCurrency(num, DB.getSettings());
      }
    }
  }

  function onAmountKeydown(e) {
    // Allow: backspace, delete, tab, escape, enter, arrows, home, end
    const allowed = [8,9,13,27,37,38,39,40,46,35,36];
    if (allowed.includes(e.keyCode)) return true;
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && [65,67,86,88].includes(e.keyCode)) return true;
    // Block non-numeric
    if (e.key < '0' || e.key > '9') { e.preventDefault(); return false; }
    return true;
  }

  function _hideAmountHint() {
    const hint = document.getElementById('txn-amount-hint');
    if (hint) hint.style.display = 'none';
  }

  function _getRawAmount() {
    const val = document.getElementById('txn-amount').value;
    return parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
  }

  function reset() {
    editingId = null;
    document.getElementById('txn-amount').value = '';
    document.getElementById('txn-note').value   = '';
    document.getElementById('txn-date').value   = Utils.todayStr();
    document.getElementById('txn-submit-btn').innerHTML = '<i class="fa-solid fa-plus"></i> Simpan Transaksi';
    _hideAmountHint();
    App.setFormDirty(false);
  }

  function editTransaction(id) {
    const txn = DB.getTransactions().find(t => t.id === id);
    if (!txn) return;
    editingId = id;
    App.navigate('transaction');
    setTimeout(() => {
      setType(txn.type);
      const amountEl = document.getElementById('txn-amount');
      amountEl.value = Number(txn.amount).toLocaleString('id-ID');
      onAmountInput(amountEl);
      document.getElementById('txn-date').value     = txn.date;
      document.getElementById('txn-note').value     = txn.note || '';
      document.getElementById('txn-wallet').value   = txn.walletId;
      document.getElementById('txn-category').value = txn.categoryId;
      document.getElementById('txn-submit-btn').innerHTML = '<i class="fa-solid fa-pen"></i> Update Transaksi';
    }, 50);
  }

  function submit() {
    const amount   = _getRawAmount();
    const catId    = document.getElementById('txn-category').value;
    const walletId = document.getElementById('txn-wallet').value;
    const date     = document.getElementById('txn-date').value;
    const note     = document.getElementById('txn-note').value.trim();

    // Validasi lengkap
    if (!amount || amount <= 0) {
      Utils.toast('Jumlah harus lebih dari 0', 'error');
      document.getElementById('txn-amount').focus();
      return;
    }
    if (amount > 999999999999) {
      Utils.toast('Jumlah terlalu besar', 'error');
      return;
    }
    if (!catId)    { Utils.toast('Pilih kategori terlebih dahulu', 'error'); return; }
    if (!walletId) { Utils.toast('Pilih dompet terlebih dahulu', 'error'); return; }
    if (!date)     { Utils.toast('Pilih tanggal transaksi', 'error'); return; }

    // Cek saldo cukup untuk pengeluaran
    if (selectedType === 'expense') {
      const wallet = DB.getWallets().find(w => w.id === walletId);
      if (wallet && (wallet.balance || 0) < amount) {
        Utils.confirm(
          'Saldo Tidak Cukup',
          `Saldo ${wallet.name} (${Utils.formatCurrency(wallet.balance || 0, DB.getSettings())}) kurang dari jumlah yang dimasukkan. Tetap simpan?`,
          () => _doSave(amount, catId, walletId, date, note),
          'warning'
        );
        return;
      }
    }
    _doSave(amount, catId, walletId, date, note);
  }

  function _doSave(amount, catId, walletId, date, note) {
    if (editingId) {
      DB.updateTransaction(editingId, { type: selectedType, amount, categoryId: catId, walletId, date, note });
      Utils.toast('Transaksi diperbarui', 'success');
    } else {
      DB.addTransaction({ type: selectedType, amount, categoryId: catId, walletId, date, note });
      Utils.toast('Transaksi disimpan', 'success');
    }
    App.setFormDirty(false);
    reset();
    _renderTodaySummary();
    App.updateTopbarWallet();
    App.markDirty(['dashboard', 'history', 'report', 'budget', 'wallet']);
  }

  function _renderTodaySummary() {
    const el = document.getElementById('today-summary');
    if (!el) return;
    const today = Utils.todayStr();
    const txns  = DB.getTransactions().filter(t => t.date === today);
    const settings = DB.getSettings();
    if (!txns.length) {
      el.innerHTML = '<p class="text-muted text-sm" style="text-align:center;padding:16px 0">Belum ada transaksi hari ini</p>';
      return;
    }
    const income  = txns.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    el.innerHTML = `
      <div style="display:flex;gap:16px;margin-bottom:12px">
        <div style="flex:1;text-align:center;padding:12px;background:rgba(0,230,118,.08);border-radius:var(--radius-md)">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">MASUK</div>
          <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--green)">${Utils.formatCurrency(income, settings)}</div>
        </div>
        <div style="flex:1;text-align:center;padding:12px;background:rgba(255,23,68,.08);border-radius:var(--radius-md)">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">KELUAR</div>
          <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--red)">${Utils.formatCurrency(expense, settings)}</div>
        </div>
      </div>
      ${txns.slice(0,3).map(t => {
        const cat = Utils.getCategoryById(t.categoryId);
        return `
          <div class="txn-item">
            <div class="txn-icon" style="background:${cat.color}22;color:${cat.color}">
              <i class="fa-solid ${cat.icon}"></i>
            </div>
            <div class="txn-info">
              <div class="txn-name">${cat.name}</div>
              <div class="txn-meta">${t.note || '-'}</div>
            </div>
            <div class="txn-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
              ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount, settings)}
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  return { render, setType, reset, submit, editTransaction, onAmountInput, onAmountKeydown };
})();

// ============================================================
// HISTORY PAGE
// ============================================================
const HistoryPage = (() => {
  let filterType     = 'all';
  let filterCategory = 'all';
  let filterWallet   = 'all';
  let filterYear     = new Date().getFullYear();
  let filterMonth    = new Date().getMonth();
  let searchQuery    = '';
  let currentPage    = 1;
  const PAGE_SIZE    = 20;

  function render() {
    const container = document.getElementById('page-history');
    const cats   = DB.getCategories();
    const wallets = DB.getWallets();

    container.innerHTML = `
      <div class="page-header">
        <h1>Riwayat Transaksi</h1>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="HistoryPage.printPDF()">
            <i class="fa-solid fa-print" style="color:var(--purple)"></i>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="HistoryPage.exportCSV()">
            <i class="fa-solid fa-file-csv" style="color:var(--green)"></i> CSV
          </button>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('transaction')">
            <i class="fa-solid fa-plus"></i> Tambah
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-20">
        <div class="filter-bar" style="margin-bottom:12px">
          <div class="search-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" placeholder="Cari transaksi..." id="history-search" oninput="HistoryPage.onSearch(this.value)">
          </div>
          <select class="form-control" style="width:auto" id="hist-year" onchange="HistoryPage.onYearChange(this.value)">
            ${_yearOptions()}
          </select>
          <select class="form-control" style="width:auto" id="hist-month" onchange="HistoryPage.onMonthChange(this.value)">
            <option value="-1">Semua Bulan</option>
            ${Array.from({length:12},(_,m)=>`<option value="${m}" ${m===filterMonth?'selected':''}>${Utils.getMonthName(m)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-bar">
          <div class="tab-nav" style="margin-bottom:0;flex:1">
            <div class="tab-btn ${filterType==='all'?'active':''}" onclick="HistoryPage.onTypeChange('all')">Semua</div>
            <div class="tab-btn ${filterType==='income'?'active':''}" onclick="HistoryPage.onTypeChange('income')">Pemasukan</div>
            <div class="tab-btn ${filterType==='expense'?'active':''}" onclick="HistoryPage.onTypeChange('expense')">Pengeluaran</div>
          </div>
          <select class="form-control" style="width:auto" onchange="HistoryPage.onCatChange(this.value)">
            <option value="all">Semua Kategori</option>
            ${cats.map(c=>`<option value="${c.id}" ${c.id===filterCategory?'selected':''}>${c.name}</option>`).join('')}
          </select>
          <select class="form-control" style="width:auto" onchange="HistoryPage.onWalletChange(this.value)">
            <option value="all">Semua Dompet</option>
            ${wallets.map(w=>`<option value="${w.id}" ${w.id===filterWallet?'selected':''}>${w.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Summary bar -->
      <div id="history-summary" class="mb-20"></div>

      <!-- List -->
      <div class="card">
        <div id="history-list"></div>
        <div id="history-pagination" style="display:flex;justify-content:center;gap:8px;padding-top:16px"></div>
      </div>
    `;

    _renderList();
  }

  function _yearOptions() {
    const now = new Date().getFullYear();
    return Array.from({length:6},(_,i)=>now-i).map(y=>`<option value="${y}" ${y===filterYear?'selected':''}>${y}</option>`).join('');
  }

  function _getFiltered() {
    let txns = DB.getTransactions();
    if (filterYear && filterMonth >= 0) {
      txns = txns.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === filterYear && d.getMonth() === filterMonth;
      });
    } else if (filterYear) {
      txns = txns.filter(t => new Date(t.date).getFullYear() === filterYear);
    }
    if (filterType !== 'all') txns = txns.filter(t => t.type === filterType);
    if (filterCategory !== 'all') txns = txns.filter(t => t.categoryId === filterCategory);
    if (filterWallet !== 'all') txns = txns.filter(t => t.walletId === filterWallet);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      txns = txns.filter(t => {
        const cat    = Utils.getCategoryById(t.categoryId);
        const wallet = Utils.getWalletById(t.walletId);
        return (t.note||'').toLowerCase().includes(q) ||
               cat.name.toLowerCase().includes(q) ||
               wallet.name.toLowerCase().includes(q) ||
               t.amount.toString().includes(q);
      });
    }
    return txns;
  }

  function _renderList() {
    const txns    = _getFiltered();
    const settings = DB.getSettings();
    const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

    // Summary
    document.getElementById('history-summary').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${[
          {label:'Pemasukan',val:income,color:'var(--green)'},
          {label:'Pengeluaran',val:expense,color:'var(--red)'},
          {label:'Selisih',val:income-expense,color:income-expense>=0?'var(--cyan)':'var(--orange)'},
        ].map(s=>`
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${s.label}</div>
            <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:${s.color}">${Utils.formatCurrency(s.val,settings)}</div>
          </div>
        `).join('')}
      </div>
    `;

    const totalPages = Math.ceil(txns.length / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = 1;
    const paged = txns.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);

    const listEl = document.getElementById('history-list');
    if (!paged.length) {
      listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-receipt"></i><h3>Tidak ada transaksi</h3><p>Coba ubah filter pencarian</p></div>`;
    } else {
      // Group by date
      const grouped = {};
      paged.forEach(t => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t);
      });
      listEl.innerHTML = Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).map(([date, items]) => `
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);letter-spacing:.5px;padding:12px 0 6px;text-transform:uppercase">
            ${Utils.relativeDateStr(date)} &nbsp; <span style="font-weight:400">${Utils.formatDate(date)}</span>
          </div>
          ${items.map(t => {
            const cat    = Utils.getCategoryById(t.categoryId);
            const wallet = Utils.getWalletById(t.walletId);
            return `
              <div class="txn-item">
                <div class="txn-icon" style="background:${cat.color}22;color:${cat.color}">
                  <i class="fa-solid ${cat.icon}"></i>
                </div>
                <div class="txn-info">
                  <div class="txn-name">${t.isTransfer ? '<span class="badge" style="background:rgba(29,233,182,.15);color:var(--teal);font-size:9px;padding:2px 6px;margin-right:4px">TRANSFER</span>' : ''}${cat.name}${t.hasReceipt ? ' <span class="receipt-badge" onclick="event.stopPropagation();ReceiptModal.show(\''+t.id+'\')"><i class="fa-solid fa-receipt"></i> Struk</span>' : ''}</div>
                  <div class="txn-meta">
                    <i class="fa-solid fa-wallet" style="font-size:10px;margin-right:3px"></i>${wallet.name}
                    ${t.note ? ' · ' + Utils.truncate(t.note, 25) : ''}
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                  <div class="txn-amount ${t.type==='income'?'amount-income':'amount-expense'}">
                    ${t.type==='income'?'+':'-'}${Utils.formatCurrency(t.amount, settings)}
                  </div>
                  <div style="display:flex;gap:4px">
                    <button class="btn-icon" style="width:28px;height:28px;font-size:12px" onclick="TransactionPage.editTransaction('${t.id}')">
                      <i class="fa-solid fa-pen" style="color:var(--cyan)"></i>
                    </button>
                    <button class="btn-icon" style="width:28px;height:28px;font-size:12px" onclick="HistoryPage.deleteTransaction('${t.id}')">
                      <i class="fa-solid fa-trash" style="color:var(--red)"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `).join('');
    }

    // Pagination
    const pagEl = document.getElementById('history-pagination');
    if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
    pagEl.innerHTML = `
      <button class="btn btn-ghost btn-sm" ${currentPage===1?'disabled':''} onclick="HistoryPage.goPage(${currentPage-1})">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <span class="text-muted text-sm" style="display:flex;align-items:center">${currentPage} / ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" ${currentPage===totalPages?'disabled':''} onclick="HistoryPage.goPage(${currentPage+1})">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;
  }

  function deleteTransaction(id) {
    Utils.confirm('Hapus Transaksi', 'Transaksi ini akan dihapus permanen dan saldo dompet akan disesuaikan.', () => {
      DB.deleteTransaction(id);
      Utils.toast('Transaksi dihapus', 'success');
      App.updateTopbarWallet();
      _renderList();
    });
  }

  function exportCSV() {
    const txns = _getFiltered();
    if (!txns.length) { Utils.toast('Tidak ada data untuk diekspor', 'warning'); return; }
    const csv = Utils.transactionsToCSV(txns);
    Utils.downloadFile(csv, `ditzmoney_transaksi_${Utils.todayStr()}.csv`, 'text/csv');
    Utils.toast('CSV berhasil diekspor', 'success');
  }

  function printPDF() {
    const txns    = _getFiltered();
    const settings = DB.getSettings();
    const appName  = settings.appName || 'Ditz Money';
    if (!txns.length) { Utils.toast('Tidak ada data untuk dicetak', 'warning'); return; }

    const income  = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) { Utils.toast('Izinkan popup untuk mencetak', 'warning'); return; }

    const styles = `
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#1a1a2e; font-size:13px; }
      .page { max-width:800px; margin:0 auto; padding:36px 28px; }
      .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; padding-bottom:16px; border-bottom:3px solid #0d0f14; }
      .logo { width:44px; height:44px; border-radius:10px; object-fit:cover; }
      .app-name { font-size:20px; font-weight:800; color:#0d0f14; }
      .sub { font-size:12px; color:#666; margin-top:2px; }
      .stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
      .stat-box { background:#f8f9fc; border-radius:10px; padding:14px; border-left:4px solid var(--c); }
      .stat-box .lbl { font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
      .stat-box .val { font-size:17px; font-weight:800; color:var(--c); }
      table { width:100%; border-collapse:collapse; }
      th { background:#0d0f14; color:#fff; padding:9px 12px; text-align:left; font-size:11px; letter-spacing:.5px; text-transform:uppercase; }
      td { padding:9px 12px; border-bottom:1px solid #eef0f8; }
      tr:last-child td { border-bottom:none; }
      tr:nth-child(even) td { background:#f8f9fc; }
      .inc { color:#00a854; font-weight:700; }
      .exp { color:#d4170c; font-weight:700; }
      .badge { display:inline-block; padding:2px 7px; border-radius:99px; font-size:10px; font-weight:700; background:#e0f7f4; color:#00897b; margin-right:4px; }
      .cat-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }
      .footer { margin-top:32px; padding-top:14px; border-top:1px solid #eee; text-align:center; font-size:11px; color:#aaa; }
      @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
    `;

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Riwayat Transaksi - ${appName}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div style="display:flex;align-items:center;gap:12px">
              <img src="https://d.top4top.io/p_3721v7lxr0.png" class="logo" alt="${appName}">
              <div>
                <div class="app-name">${appName}</div>
                <div class="sub">Riwayat Transaksi</div>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:13px;font-weight:600;color:#444">${txns.length} transaksi</div>
              <div class="sub">Dicetak: ${Utils.formatDate(new Date().toISOString(), 'long')}</div>
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-box" style="--c:#00a854">
              <div class="lbl">Total Pemasukan</div>
              <div class="val">${Utils.formatCurrency(income, settings)}</div>
            </div>
            <div class="stat-box" style="--c:#d4170c">
              <div class="lbl">Total Pengeluaran</div>
              <div class="val">${Utils.formatCurrency(expense, settings)}</div>
            </div>
            <div class="stat-box" style="--c:#0288d1">
              <div class="lbl">Selisih</div>
              <div class="val">${Utils.formatCurrency(income-expense, settings)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr><th>Tanggal</th><th>Kategori</th><th>Dompet</th><th>Catatan</th><th style="text-align:right">Jumlah</th></tr>
            </thead>
            <tbody>
              ${txns.map(t => {
                const cat    = Utils.getCategoryById(t.categoryId);
                const wallet = Utils.getWalletById(t.walletId);
                return `
                  <tr>
                    <td>${Utils.formatDate(t.date)}</td>
                    <td>
                      ${t.isTransfer ? '<span class="badge">TRANSFER</span>' : `<span class="cat-dot" style="background:${cat.color}"></span>`}
                      ${cat.name}
                    </td>
                    <td>${wallet.name}</td>
                    <td style="color:#666;max-width:160px">${t.note || '-'}</td>
                    <td style="text-align:right" class="${t.type==='income'?'inc':'exp'}">
                      ${t.type==='income'?'+':'-'}${Utils.formatCurrency(t.amount, settings)}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            Laporan dibuat otomatis oleh ${appName} &bull; ${Utils.todayStr()}
          </div>
        </div>
        <script>window.onload=function(){setTimeout(()=>window.print(),400)};<\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  function onSearch(v) { searchQuery = v; currentPage = 1; _renderList(); }
  function onTypeChange(v) { filterType = v; currentPage = 1;
    document.querySelectorAll('#page-history .tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    _renderList();
  }
  function onCatChange(v) { filterCategory = v; currentPage = 1; _renderList(); }
  function onWalletChange(v) { filterWallet = v; currentPage = 1; _renderList(); }
  function onYearChange(v) { filterYear = +v; currentPage = 1; _renderList(); }
  function onMonthChange(v) { filterMonth = +v; currentPage = 1; _renderList(); }
  function goPage(p) { currentPage = p; _renderList(); document.getElementById('page-history').scrollTop = 0; }

  return { render, deleteTransaction, exportCSV, printPDF, onSearch, onTypeChange, onCatChange, onWalletChange, onYearChange, onMonthChange, goPage };
})();

// ============================================================
// SPLIT BILL PAGE
// ============================================================
const SplitBillPage = (() => {

  // State
  let members  = [];   // [{id, name}]
  let items    = [];   // [{id, name, price, paidBy, splitWith:[memberId,...]}]
  let billTitle = '';

  // ---- Render ----
  function render() {
    const container = document.getElementById('page-splitbill');
    const settings  = DB.getSettings();
    const wallets   = DB.getWallets();

    container.innerHTML = `
      <div class="page-header">
        <h1>Split Bill</h1>
        <button class="btn btn-ghost btn-sm" onclick="SplitBillPage.reset()">
          <i class="fa-solid fa-rotate-left" style="color:var(--yellow)"></i> Reset
        </button>
      </div>
      <p class="text-muted text-sm mb-20">Hitung pembagian tagihan dan catat pengeluaran otomatis.</p>

      <!-- Step 1: Bill info & Members -->
      <div class="card mb-16">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-users" style="color:var(--cyan)"></i> Peserta</span>
        </div>
        <div class="form-group">
          <label class="form-label">Nama Tagihan</label>
          <input type="text" id="sb-title" class="form-control" placeholder="Contoh: Makan Siang, Nongkrong..."
            value="${billTitle}" oninput="SplitBillPage.onTitleChange(this.value)">
        </div>
        <div class="form-group">
          <label class="form-label">Tambah Peserta</label>
          <div style="display:flex;gap:8px">
            <input type="text" id="sb-member-name" class="form-control" placeholder="Nama peserta..." 
              onkeydown="if(event.key==='Enter')SplitBillPage.addMember()">
            <button class="btn btn-primary" onclick="SplitBillPage.addMember()">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
        <div id="sb-members-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
          ${members.map(m => `
            <div style="display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);padding:6px 12px;border-radius:99px;font-size:13px;font-weight:600">
              <i class="fa-solid fa-user" style="color:var(--cyan);font-size:11px"></i>
              ${m.name}
              <button onclick="SplitBillPage.removeMember('${m.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:11px;padding:0 0 0 4px;line-height:1">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `).join('') || '<span class="text-muted text-sm">Belum ada peserta</span>'}
        </div>
      </div>

      <!-- Step 2: Items -->
      <div class="card mb-16">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-list" style="color:var(--orange)"></i> Item Tagihan</span>
          <button class="btn btn-primary btn-sm" onclick="SplitBillPage.openItemModal()">
            <i class="fa-solid fa-plus"></i> Tambah Item
          </button>
        </div>
        <div id="sb-items-list">
          ${items.length ? items.map(item => {
            const paidByMember = members.find(m => m.id === item.paidBy);
            const splitCount   = item.splitWith.length || members.length;
            const perPerson    = splitCount > 0 ? Math.ceil(item.price / splitCount) : item.price;
            return `
              <div class="txn-item">
                <div class="txn-icon" style="background:rgba(255,109,0,.15);color:var(--orange)">
                  <i class="fa-solid fa-receipt"></i>
                </div>
                <div class="txn-info">
                  <div class="txn-name">${item.name}</div>
                  <div class="txn-meta">
                    Dibayar: ${paidByMember ? paidByMember.name : 'Bersama'} &middot;
                    Dibagi: ${item.splitWith.length ? item.splitWith.map(id=>members.find(m=>m.id===id)?.name||'').join(', ') : 'Semua'}
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                  <div style="font-family:var(--font-display);font-weight:700;font-size:14px;color:var(--orange)">
                    ${Utils.formatCurrency(item.price, settings)}
                  </div>
                  <div style="font-size:11px;color:var(--text-muted)">${Utils.formatCurrency(perPerson, settings)}/org</div>
                  <div style="display:flex;gap:4px">
                    <button class="btn-icon" style="width:26px;height:26px;font-size:11px" onclick="SplitBillPage.openItemModal('${item.id}')">
                      <i class="fa-solid fa-pen" style="color:var(--cyan)"></i>
                    </button>
                    <button class="btn-icon" style="width:26px;height:26px;font-size:11px" onclick="SplitBillPage.removeItem('${item.id}')">
                      <i class="fa-solid fa-trash" style="color:var(--red)"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('') : `
            <div class="empty-state" style="padding:24px">
              <i class="fa-solid fa-receipt"></i>
              <p>Belum ada item. Tap "+ Tambah Item"</p>
            </div>
          `}
        </div>
      </div>

      <!-- Step 3: Summary & Hasil -->
      ${members.length >= 2 && items.length ? _buildSummaryHTML(settings, wallets) : ''}

      <!-- Item Modal -->
      <div class="modal-overlay" id="sb-item-modal" onclick="if(event.target===this)SplitBillPage.closeItemModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="sb-item-modal-title">Tambah Item</div>
            <button class="btn-icon" onclick="SplitBillPage.closeItemModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nama Item</label>
              <input type="text" id="sb-item-name" class="form-control" placeholder="Contoh: Nasi Goreng, Kopi...">
            </div>
            <div class="form-group">
              <label class="form-label">Harga</label>
              <div style="position:relative">
                <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:600">${settings.currency === 'IDR' ? 'Rp' : settings.currency}</span>
                <input type="text" inputmode="numeric" id="sb-item-price" class="form-control"
                  placeholder="0" style="padding-left:44px;font-size:18px;font-family:var(--font-display);font-weight:700"
                  oninput="SplitBillPage.onItemPriceInput(this)"
                  onkeydown="return TransactionPage.onAmountKeydown(event)">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Dibayar Oleh</label>
              <select id="sb-item-paidby" class="form-control">
                <option value="">-- Bayar Bersama --</option>
                ${members.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Dibagi Ke <span class="text-muted">(kosong = semua)</span></label>
              <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px" id="sb-split-checkboxes">
                ${members.map(m=>`
                  <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px">
                    <input type="checkbox" value="${m.id}" class="sb-split-check" checked
                      style="width:16px;height:16px;accent-color:var(--cyan)">
                    ${m.name}
                  </label>
                `).join('')}
              </div>
              ${!members.length ? '<p class="text-muted text-sm">Tambah peserta dulu</p>' : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="SplitBillPage.closeItemModal()">Batal</button>
            <button class="btn btn-primary" onclick="SplitBillPage.saveItem()">
              <i class="fa-solid fa-check"></i> Simpan Item
            </button>
          </div>
        </div>
      </div>

      <!-- Save to Transaction Modal -->
      <div class="modal-overlay" id="sb-save-modal" onclick="if(event.target===this)Utils.closeModal('sb-save-modal')">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title"><i class="fa-solid fa-floppy-disk" style="color:var(--green)"></i> Catat ke Transaksi</div>
            <button class="btn-icon" onclick="Utils.closeModal('sb-save-modal')"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <p class="text-muted text-sm mb-16">Pilih peserta yang ingin dicatat pengeluarannya ke dompet.</p>
            <div id="sb-save-members"></div>
            <div class="form-row" style="margin-top:16px">
              <div class="form-group">
                <label class="form-label">Dompet</label>
                <select id="sb-save-wallet" class="form-control">
                  ${wallets.map(w=>`<option value="${w.id}" ${w.id===DB.getActiveWallet().id?'selected':''}>${w.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Tanggal</label>
                <input type="date" id="sb-save-date" class="form-control" value="${Utils.todayStr()}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <select id="sb-save-cat" class="form-control">
                ${DB.getCategories().filter(c=>c.type==='expense').map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="Utils.closeModal('sb-save-modal')">Batal</button>
            <button class="btn btn-success" onclick="SplitBillPage.saveToTransactions()">
              <i class="fa-solid fa-floppy-disk"></i> Catat Transaksi
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ---- Build summary HTML ----
  function _buildSummaryHTML(settings, wallets) {
    const result = _calculate();
    const totalBill = items.reduce((s, i) => s + i.price, 0);

    return `
      <div class="card mb-16">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-calculator" style="color:var(--purple)"></i> Hasil Pembagian</span>
        </div>

        <!-- Total -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-md);margin-bottom:16px">
          <span style="font-weight:600;color:var(--text-muted)">Total Tagihan</span>
          <span style="font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--orange)">${Utils.formatCurrency(totalBill, settings)}</span>
        </div>

        <!-- Per member -->
        ${Object.entries(result.owes).map(([memberId, amount]) => {
          const member = members.find(m => m.id === memberId);
          if (!member) return '';
          const paid   = result.paid[memberId] || 0;
          const net    = paid - amount;  // positive = can receive money, negative = still owes
          return `
            <div style="padding:14px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:36px;height:36px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--cyan)">
                    <i class="fa-solid fa-user"></i>
                  </div>
                  <span style="font-weight:700;font-size:15px">${member.name}</span>
                </div>
                <div style="text-align:right">
                  <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:${net>=0?'var(--green)':'var(--red)'}">
                    ${net >= 0 ? '+' : ''}${Utils.formatCurrency(net, settings)}
                  </div>
                  <div style="font-size:11px;color:var(--text-muted)">${net>=0?'dapat terima':'harus bayar'}</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
                <div style="padding:8px;background:rgba(0,230,118,.08);border-radius:var(--radius-sm);text-align:center">
                  <div style="color:var(--text-muted);margin-bottom:2px">Sudah Bayar</div>
                  <div style="color:var(--green);font-weight:700">${Utils.formatCurrency(paid, settings)}</div>
                </div>
                <div style="padding:8px;background:rgba(255,109,0,.08);border-radius:var(--radius-sm);text-align:center">
                  <div style="color:var(--text-muted);margin-bottom:2px">Porsi Tagihan</div>
                  <div style="color:var(--orange);font-weight:700">${Utils.formatCurrency(amount, settings)}</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}

        <!-- Settlement / hutang antar orang -->
        ${result.settlements.length ? `
          <div style="margin-top:16px">
            <div class="card-title mb-12"><i class="fa-solid fa-arrows-left-right" style="color:var(--teal)"></i> Siapa Bayar Siapa</div>
            ${result.settlements.map(s => {
              const from = members.find(m => m.id === s.from);
              const to   = members.find(m => m.id === s.to);
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-elevated);border-radius:var(--radius-md);margin-bottom:8px;font-size:13px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:700;color:var(--red)">${from?.name}</span>
                    <i class="fa-solid fa-arrow-right" style="color:var(--text-muted);font-size:11px"></i>
                    <span style="font-weight:700;color:var(--green)">${to?.name}</span>
                  </div>
                  <span style="font-family:var(--font-display);font-weight:700;color:var(--teal)">${Utils.formatCurrency(s.amount, settings)}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <!-- Actions -->
        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn btn-ghost" style="flex:1" onclick="SplitBillPage.printSplitBill()">
            <i class="fa-solid fa-print" style="color:var(--purple)"></i> Cetak
          </button>
          <button class="btn btn-success" style="flex:1" onclick="SplitBillPage.openSaveModal()">
            <i class="fa-solid fa-floppy-disk"></i> Catat ke Transaksi
          </button>
        </div>
      </div>
    `;
  }

  // ---- Calculation engine ----
  function _calculate() {
    // owes[memberId] = total yang harus dibayar
    // paid[memberId] = total yang sudah dibayar (karena jadi payer)
    const owes = {};
    const paid = {};
    members.forEach(m => { owes[m.id] = 0; paid[m.id] = 0; });

    items.forEach(item => {
      const splitWith = item.splitWith.length ? item.splitWith : members.map(m => m.id);
      const perPerson = Math.ceil(item.price / splitWith.length);

      // Siapa yang nanggung dulu
      if (item.paidBy) {
        paid[item.paidBy] = (paid[item.paidBy] || 0) + item.price;
      } else {
        // dibagi rata sebagai yang sudah bayar
        splitWith.forEach(id => {
          paid[id] = (paid[id] || 0) + Math.ceil(item.price / splitWith.length);
        });
      }

      // Porsi masing-masing
      splitWith.forEach(id => {
        owes[id] = (owes[id] || 0) + perPerson;
      });
    });

    // Hitung settlement minimum (greedy algorithm)
    const balances = members.map(m => ({ id: m.id, bal: (paid[m.id] || 0) - (owes[m.id] || 0) }));
    const settlements = [];

    const debtors  = balances.filter(b => b.bal < 0).sort((a,b) => a.bal - b.bal);
    const creditors = balances.filter(b => b.bal > 0).sort((a,b) => b.bal - a.bal);

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amount = Math.min(-d.bal, c.bal);
      if (amount > 0) settlements.push({ from: d.id, to: c.id, amount });
      d.bal += amount;
      c.bal -= amount;
      if (Math.abs(d.bal) < 1) i++;
      if (Math.abs(c.bal) < 1) j++;
    }

    return { owes, paid, settlements };
  }

  // ---- Members ----
  function onTitleChange(val) { billTitle = val; }

  function addMember() {
    const input = document.getElementById('sb-member-name');
    const name  = input.value.trim();
    if (!name) { Utils.toast('Nama peserta harus diisi', 'error'); return; }
    if (members.find(m => m.name.toLowerCase() === name.toLowerCase())) {
      Utils.toast('Peserta sudah ada', 'warning'); return;
    }
    members.push({ id: 'mbr' + Date.now(), name });
    input.value = '';
    render();
  }

  function removeMember(id) {
    members = members.filter(m => m.id !== id);
    // Remove member from all items splitWith
    items = items.map(item => ({
      ...item,
      splitWith: item.splitWith.filter(mid => mid !== id),
      paidBy: item.paidBy === id ? '' : item.paidBy,
    }));
    render();
  }

  // ---- Items ----
  let _editingItemId = null;

  function onItemPriceInput(input) {
    let raw = input.value.replace(/[^0-9]/g, '');
    if (!raw) { input.value = ''; return; }
    raw = String(parseInt(raw, 10));
    input.value = Number(raw).toLocaleString('id-ID');
  }

  function openItemModal(id) {
    _editingItemId = id || null;
    document.getElementById('sb-item-modal-title').textContent = id ? 'Edit Item' : 'Tambah Item';
    if (id) {
      const item = items.find(i => i.id === id);
      if (item) {
        document.getElementById('sb-item-name').value   = item.name;
        document.getElementById('sb-item-price').value  = Number(item.price).toLocaleString('id-ID');
        document.getElementById('sb-item-paidby').value = item.paidBy || '';
        document.querySelectorAll('.sb-split-check').forEach(cb => {
          cb.checked = item.splitWith.length === 0 || item.splitWith.includes(cb.value);
        });
      }
    } else {
      document.getElementById('sb-item-name').value  = '';
      document.getElementById('sb-item-price').value = '';
      document.getElementById('sb-item-paidby').value = '';
      document.querySelectorAll('.sb-split-check').forEach(cb => cb.checked = true);
    }
    Utils.openModal('sb-item-modal');
  }

  function closeItemModal() { Utils.closeModal('sb-item-modal'); _editingItemId = null; }

  function saveItem() {
    const name   = document.getElementById('sb-item-name').value.trim();
    const price  = parseInt((document.getElementById('sb-item-price').value || '0').replace(/[^0-9]/g,''), 10) || 0;
    const paidBy = document.getElementById('sb-item-paidby').value;
    const splitWith = [...document.querySelectorAll('.sb-split-check:checked')].map(cb => cb.value);

    if (!name)  { Utils.toast('Nama item harus diisi', 'error'); return; }
    if (!price) { Utils.toast('Harga harus lebih dari 0', 'error'); return; }

    if (_editingItemId) {
      items = items.map(i => i.id === _editingItemId
        ? { ...i, name, price, paidBy, splitWith }
        : i
      );
      Utils.toast('Item diperbarui', 'success');
    } else {
      items.push({ id: 'itm' + Date.now(), name, price, paidBy, splitWith });
      Utils.toast('Item ditambahkan', 'success');
    }
    closeItemModal();
    render();
  }

  function removeItem(id) {
    items = items.filter(i => i.id !== id);
    render();
  }

  // ---- Save to transactions ----
  function openSaveModal() {
    if (!billTitle.trim()) { Utils.toast('Isi nama tagihan terlebih dahulu', 'warning'); return; }
    const result = _calculate();
    const settings = DB.getSettings();
    const el = document.getElementById('sb-save-members');

    el.innerHTML = members.map(m => {
      const amount = result.owes[m.id] || 0;
      return `
        <label style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-md);margin-bottom:8px;cursor:pointer;gap:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <input type="checkbox" value="${m.id}" class="sb-save-check" checked style="width:16px;height:16px;accent-color:var(--green)">
            <span style="font-weight:600">${m.name}</span>
          </div>
          <span style="font-family:var(--font-display);font-weight:700;color:var(--orange)">${Utils.formatCurrency(amount, settings)}</span>
        </label>
      `;
    }).join('');

    Utils.openModal('sb-save-modal');
  }

  function saveToTransactions() {
    const catId    = document.getElementById('sb-save-cat').value;
    const walletId = document.getElementById('sb-save-wallet').value;
    const date     = document.getElementById('sb-save-date').value;
    const selected = [...document.querySelectorAll('.sb-save-check:checked')].map(cb => cb.value);
    const result   = _calculate();

    if (!selected.length) { Utils.toast('Pilih minimal 1 peserta', 'error'); return; }
    if (!catId || !walletId || !date) { Utils.toast('Lengkapi data terlebih dahulu', 'error'); return; }

    let saved = 0;
    selected.forEach(memberId => {
      const member = members.find(m => m.id === memberId);
      const amount = result.owes[memberId] || 0;
      if (amount > 0) {
        DB.addTransaction({
          type:       'expense',
          amount,
          categoryId: catId,
          walletId,
          date,
          note:       `[Split] ${billTitle} - ${member.name}`,
          isSplitBill: true,
        });
        saved++;
      }
    });

    Utils.closeModal('sb-save-modal');
    Utils.toast(`${saved} transaksi split bill berhasil dicatat`, 'success');
    App.updateTopbarWallet();
    App.markDirty(['dashboard','history','report','budget','wallet']);
  }

  // ---- Print ----
  function printSplitBill() {
    const settings = DB.getSettings();
    const result   = _calculate();
    const totalBill = items.reduce((s, i) => s + i.price, 0);
    const appName   = DB.getSettings().appName || 'Ditz Money';

    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) { Utils.toast('Izinkan popup untuk mencetak', 'warning'); return; }

    printWin.document.write(`
      <!DOCTYPE html><html lang="id">
      <head><meta charset="UTF-8"><title>Split Bill - ${billTitle}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1f2937;padding:32px}
        .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e5e7eb}
        .logo{width:44px;height:44px;border-radius:10px;object-fit:cover}
        .app-name{font-size:18px;font-weight:800;color:#111}
        .bill-title{font-size:22px;font-weight:800;color:#111;margin-bottom:4px}
        .bill-sub{font-size:13px;color:#6b7280}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th{background:#1f2937;color:#fff;padding:9px 12px;text-align:left;font-size:11px;letter-spacing:.5px;text-transform:uppercase}
        td{padding:9px 12px;border-bottom:1px solid #f3f4f6}
        tr:nth-child(even) td{background:#f9fafb}
        .section{margin-bottom:24px}
        .section-title{font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
        .member-row{display:flex;justify-content:space-between;padding:10px 14px;background:#f9fafb;border-radius:8px;margin-bottom:6px}
        .settle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px}
        .green{color:#16a34a;font-weight:700} .red{color:#dc2626;font-weight:700} .orange{color:#ea580c;font-weight:700}
        .total-box{background:#f3f4f6;border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
        .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
        @media print{body{padding:16px}}
      </style>
      </head><body>
        <div class="header">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="https://d.top4top.io/p_3721v7lxr0.png" class="logo" alt="${appName}">
            <div><div class="app-name">${appName}</div><div style="font-size:11px;color:#9ca3af">Split Bill</div></div>
          </div>
          <div style="text-align:right;font-size:12px;color:#6b7280">
            ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
          </div>
        </div>

        <div class="bill-title">${billTitle || 'Split Bill'}</div>
        <div class="bill-sub">${members.length} peserta &middot; ${items.length} item</div>
        <br>

        <div class="total-box">
          <span style="font-size:14px;font-weight:600;color:#374151">Total Tagihan</span>
          <span style="font-size:22px;font-weight:800;color:#ea580c">${Utils.formatCurrency(totalBill, settings)}</span>
        </div>

        <div class="section">
          <div class="section-title">Daftar Item</div>
          <table>
            <thead><tr><th>Item</th><th>Dibayar Oleh</th><th>Dibagi Ke</th><th style="text-align:right">Harga</th><th style="text-align:right">/Orang</th></tr></thead>
            <tbody>
              ${items.map(item => {
                const paidByM   = members.find(m=>m.id===item.paidBy);
                const splitWith = item.splitWith.length ? item.splitWith : members.map(m=>m.id);
                const perPerson = Math.ceil(item.price / splitWith.length);
                return `<tr>
                  <td style="font-weight:600">${item.name}</td>
                  <td>${paidByM ? paidByM.name : 'Bersama'}</td>
                  <td>${item.splitWith.length ? item.splitWith.map(id=>members.find(m=>m.id===id)?.name||'').join(', ') : 'Semua'}</td>
                  <td style="text-align:right" class="orange">${Utils.formatCurrency(item.price, settings)}</td>
                  <td style="text-align:right;color:#6b7280">${Utils.formatCurrency(perPerson, settings)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Ringkasan Per Peserta</div>
          ${members.map(m => {
            const owes = result.owes[m.id] || 0;
            const paid = result.paid[m.id] || 0;
            const net  = paid - owes;
            return `<div class="member-row">
              <span style="font-weight:700">${m.name}</span>
              <div style="display:flex;gap:20px;font-size:12px">
                <span>Bayar: <strong class="green">${Utils.formatCurrency(paid, settings)}</strong></span>
                <span>Porsi: <strong class="orange">${Utils.formatCurrency(owes, settings)}</strong></span>
                <span>Saldo: <strong class="${net>=0?'green':'red'}">${net>=0?'+':''}${Utils.formatCurrency(net, settings)}</strong></span>
              </div>
            </div>`;
          }).join('')}
        </div>

        ${result.settlements.length ? `
          <div class="section">
            <div class="section-title">Siapa Bayar Siapa</div>
            ${result.settlements.map(s => {
              const from = members.find(m=>m.id===s.from);
              const to   = members.find(m=>m.id===s.to);
              return `<div class="settle-row">
                <div><span class="red">${from?.name}</span> &rarr; <span class="green">${to?.name}</span></div>
                <span style="font-weight:700;color:#0891b2">${Utils.formatCurrency(s.amount, settings)}</span>
              </div>`;
            }).join('')}
          </div>
        ` : ''}

        <div class="footer">${appName} &mdash; Split Bill Generator</div>
        <script>window.onload=function(){setTimeout(()=>window.print(),400)};<\/script>
      </body></html>
    `);
    printWin.document.close();
  }

  // ---- Reset ----
  function reset() {
    Utils.confirm('Reset Split Bill', 'Semua data split bill akan dihapus.', () => {
      members   = [];
      items     = [];
      billTitle = '';
      render();
    });
  }

  return { render, addMember, removeMember, onTitleChange, openItemModal, closeItemModal,
           saveItem, removeItem, onItemPriceInput, openSaveModal, saveToTransactions,
           printSplitBill, reset };
})();
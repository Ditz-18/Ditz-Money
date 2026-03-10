/**
 * FinTrack - Transaction & History Pages
 */

// ============================================================
// TRANSACTION FORM
// ============================================================
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
              <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:14px;font-weight:600">${settings.currency === 'IDR' ? 'Rp' : settings.currency}</span>
              <input type="number" id="txn-amount" class="form-control" placeholder="0" style="padding-left:48px;font-size:20px;font-family:var(--font-display);font-weight:700" min="0" step="any">
            </div>
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

  function reset() {
    editingId = null;
    document.getElementById('txn-amount').value = '';
    document.getElementById('txn-note').value   = '';
    document.getElementById('txn-date').value   = Utils.todayStr();
    document.getElementById('txn-submit-btn').innerHTML = '<i class="fa-solid fa-plus"></i> Simpan Transaksi';
  }

  function editTransaction(id) {
    const txn = DB.getTransactions().find(t => t.id === id);
    if (!txn) return;
    editingId = id;
    App.navigate('transaction');
    setTimeout(() => {
      setType(txn.type);
      document.getElementById('txn-amount').value   = txn.amount;
      document.getElementById('txn-date').value     = txn.date;
      document.getElementById('txn-note').value     = txn.note || '';
      document.getElementById('txn-wallet').value   = txn.walletId;
      document.getElementById('txn-category').value = txn.categoryId;
      document.getElementById('txn-submit-btn').innerHTML = '<i class="fa-solid fa-pen"></i> Update Transaksi';
    }, 50);
  }

  function submit() {
    const amount   = Utils.parseAmount(document.getElementById('txn-amount').value);
    const catId    = document.getElementById('txn-category').value;
    const walletId = document.getElementById('txn-wallet').value;
    const date     = document.getElementById('txn-date').value;
    const note     = document.getElementById('txn-note').value.trim();

    if (!amount || amount <= 0) { Utils.toast('Jumlah harus lebih dari 0', 'error'); return; }
    if (!catId)    { Utils.toast('Pilih kategori', 'error'); return; }
    if (!walletId) { Utils.toast('Pilih dompet', 'error'); return; }
    if (!date)     { Utils.toast('Pilih tanggal', 'error'); return; }

    if (editingId) {
      DB.updateTransaction(editingId, { type: selectedType, amount, categoryId: catId, walletId, date, note });
      Utils.toast('Transaksi diperbarui', 'success');
    } else {
      DB.addTransaction({ type: selectedType, amount, categoryId: catId, walletId, date, note });
      Utils.toast('Transaksi disimpan', 'success');
    }
    reset();
    _renderTodaySummary();
    // update topbar wallet badge
    App.updateTopbarWallet();
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

  return { render, setType, reset, submit, editTransaction };
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
                  <div class="txn-name">${cat.name}</div>
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
    Utils.downloadFile(csv, `fintrack_transaksi_${Utils.todayStr()}.csv`, 'text/csv');
    Utils.toast('CSV berhasil diekspor', 'success');
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

  return { render, deleteTransaction, exportCSV, onSearch, onTypeChange, onCatChange, onWalletChange, onYearChange, onMonthChange, goPage };
})();

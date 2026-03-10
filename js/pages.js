/**
 * FinTrack - Report, Budget, Wallet, Category, Recurring, Backup, Settings Pages
 */

// ============================================================
// REPORT PAGE
// ============================================================
const ReportPage = (() => {
  let lineChart = null;
  let catChart  = null;
  let year  = new Date().getFullYear();
  let month = new Date().getMonth();
  let activeTab = 'monthly';

  function render() {
    const container = document.getElementById('page-report');
    container.innerHTML = `
      <div class="page-header">
        <h1>Laporan</h1>
        <div class="flex gap-8">
          <select id="rpt-year" class="form-control" style="width:auto;font-size:13px;padding:8px 12px" onchange="ReportPage.setYear(this.value)">
            ${Array.from({length:6},(_,i)=>new Date().getFullYear()-i).map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}
          </select>
          <select id="rpt-month" class="form-control" style="width:auto;font-size:13px;padding:8px 12px" onchange="ReportPage.setMonth(this.value)">
            ${Array.from({length:12},(_,m)=>`<option value="${m}" ${m===month?'selected':''}>${Utils.getMonthName(m)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="tab-nav mb-20">
        <div class="tab-btn ${activeTab==='monthly'?'active':''}" onclick="ReportPage.setTab('monthly')">Bulanan</div>
        <div class="tab-btn ${activeTab==='category'?'active':''}" onclick="ReportPage.setTab('category')">Per Kategori</div>
        <div class="tab-btn ${activeTab==='yearly'?'active':''}" onclick="ReportPage.setTab('yearly')">Tahunan</div>
      </div>

      <div id="rpt-content"></div>
    `;
    _renderContent();
  }

  function setYear(y) { year = +y; _renderContent(); }
  function setMonth(m) { month = +m; _renderContent(); }
  function setTab(t) {
    activeTab = t;
    document.querySelectorAll('#page-report .tab-btn').forEach((b,i) => {
      b.classList.toggle('active', ['monthly','category','yearly'][i] === t);
    });
    _renderContent();
  }

  function _renderContent() {
    if (activeTab === 'monthly')  _renderMonthly();
    if (activeTab === 'category') _renderCategory();
    if (activeTab === 'yearly')   _renderYearly();
  }

  function _renderMonthly() {
    const settings = DB.getSettings();
    const summary  = DB.getSummary(year, month);
    const txns     = DB.getTransactionsByPeriod(year, month);
    const savingRate = summary.income > 0 ? ((summary.net / summary.income) * 100).toFixed(1) : 0;

    document.getElementById('rpt-content').innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">
        ${[
          {label:'Pemasukan',val:summary.income,color:'var(--green)',icon:'fa-arrow-trend-up'},
          {label:'Pengeluaran',val:summary.expense,color:'var(--red)',icon:'fa-arrow-trend-down'},
          {label:'Selisih Bersih',val:summary.net,color:'var(--cyan)',icon:'fa-scale-balanced'},
          {label:'Saving Rate',val:savingRate+'%',color:'var(--teal)',icon:'fa-piggy-bank',raw:true},
        ].map(s=>`
          <div class="stat-card" style="--accent-color:${s.color}">
            <div class="stat-icon"><i class="fa-solid ${s.icon}"></i></div>
            <div class="stat-label">${s.label}</div>
            <div class="stat-value" style="color:${s.color}">${s.raw ? s.val : Utils.formatCurrency(s.val, settings)}</div>
            <div class="stat-change">${summary.count} transaksi</div>
          </div>
        `).join('')}
      </div>

      <div class="dashboard-grid">
        <div class="card span-2">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-chart-line" style="color:var(--cyan)"></i> Arus Kas Harian</span>
          </div>
          <div class="chart-wrapper" style="height:240px"><canvas id="line-chart"></canvas></div>
        </div>
      </div>
    `;
    _renderLineChart(txns, settings);
  }

  function _renderLineChart(txns, settings) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
    const incomeByDay  = {};
    const expenseByDay = {};
    txns.forEach(t => {
      const d = new Date(t.date).getDate();
      if (t.type === 'income')  incomeByDay[d]  = (incomeByDay[d]  || 0) + t.amount;
      if (t.type === 'expense') expenseByDay[d] = (expenseByDay[d] || 0) + t.amount;
    });

    if (lineChart) lineChart.destroy();
    const ctx = document.getElementById('line-chart').getContext('2d');
    lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Pemasukan',
            data: days.map(d => incomeByDay[d] || 0),
            borderColor: 'rgba(0,230,118,1)', backgroundColor: 'rgba(0,230,118,.1)',
            tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: 'rgba(0,230,118,1)',
          },
          {
            label: 'Pengeluaran',
            data: days.map(d => expenseByDay[d] || 0),
            borderColor: 'rgba(255,23,68,1)', backgroundColor: 'rgba(255,23,68,.1)',
            tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: 'rgba(255,23,68,1)',
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#8b92b3' } } },
        scales: {
          x: { ticks: { color: '#8b92b3' }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { ticks: { color: '#8b92b3', callback: v => Utils.formatShortNumber(v) }, grid: { color: 'rgba(255,255,255,.05)' } }
        }
      }
    });
  }

  function _renderCategory() {
    const settings = DB.getSettings();
    const expCats  = DB.getCategoryTotals(year, month, 'expense');
    const incCats  = DB.getCategoryTotals(year, month, 'income');
    const total    = expCats.reduce((s, c) => s + c.total, 0);

    document.getElementById('rpt-content').innerHTML = `
      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header"><span class="card-title"><i class="fa-solid fa-chart-pie" style="color:var(--red)"></i> Pengeluaran</span></div>
          <div class="chart-wrapper" style="height:200px;display:flex;align-items:center;justify-content:center">
            <canvas id="cat-exp-chart"></canvas>
          </div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
            ${expCats.map(c => `
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:8px;height:8px;border-radius:50%;background:${c.color};flex-shrink:0"></div>
                  <span>${c.name}</span>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:600;color:${c.color}">${Utils.formatCurrency(c.total, settings)}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${total>0?((c.total/total)*100).toFixed(1):'0'}%</div>
                </div>
              </div>
            `).join('') || '<p class="text-muted text-sm" style="text-align:center;padding:16px">Tidak ada data</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title"><i class="fa-solid fa-chart-pie" style="color:var(--green)"></i> Pemasukan</span></div>
          <div class="chart-wrapper" style="height:200px;display:flex;align-items:center;justify-content:center">
            <canvas id="cat-inc-chart"></canvas>
          </div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
            ${incCats.map(c => {
              const t = incCats.reduce((s,x)=>s+x.total,0);
              return `
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:8px;height:8px;border-radius:50%;background:${c.color};flex-shrink:0"></div>
                  <span>${c.name}</span>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:600;color:${c.color}">${Utils.formatCurrency(c.total, settings)}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${t>0?((c.total/t)*100).toFixed(1):'0'}%</div>
                </div>
              </div>
            `}).join('') || '<p class="text-muted text-sm" style="text-align:center;padding:16px">Tidak ada data</p>'}
          </div>
        </div>
      </div>
    `;

    if (expCats.length) {
      const ctx = document.getElementById('cat-exp-chart').getContext('2d');
      new Chart(ctx, { type:'doughnut', data:{ labels: expCats.map(c=>c.name), datasets:[{ data: expCats.map(c=>c.total), backgroundColor: expCats.map(c=>c.color+'cc'), borderColor: expCats.map(c=>c.color), borderWidth:2 }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:false}} } });
    }
    if (incCats.length) {
      const ctx = document.getElementById('cat-inc-chart').getContext('2d');
      new Chart(ctx, { type:'doughnut', data:{ labels: incCats.map(c=>c.name), datasets:[{ data: incCats.map(c=>c.total), backgroundColor: incCats.map(c=>c.color+'cc'), borderColor: incCats.map(c=>c.color), borderWidth:2 }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:false}} } });
    }
  }

  function _renderYearly() {
    const settings = DB.getSettings();
    const trend = DB.getMonthlyTrend(year);
    const totalIncome  = trend.reduce((s,t) => s + t.income, 0);
    const totalExpense = trend.reduce((s,t) => s + t.expense, 0);

    document.getElementById('rpt-content').innerHTML = `
      <div class="stats-grid mb-20">
        ${[
          {label:'Total Pemasukan '+year,val:totalIncome,color:'var(--green)',icon:'fa-arrow-trend-up'},
          {label:'Total Pengeluaran '+year,val:totalExpense,color:'var(--red)',icon:'fa-arrow-trend-down'},
          {label:'Selisih '+year,val:totalIncome-totalExpense,color:'var(--cyan)',icon:'fa-scale-balanced'},
        ].map(s=>`
          <div class="stat-card" style="--accent-color:${s.color}">
            <div class="stat-icon"><i class="fa-solid ${s.icon}"></i></div>
            <div class="stat-label">${s.label}</div>
            <div class="stat-value" style="color:${s.color}">${Utils.formatCurrency(s.val,settings)}</div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fa-solid fa-table-list" style="color:var(--blue)"></i> Rekap Per Bulan</span></div>
        <div class="table-container">
          <table>
            <thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Selisih</th><th>Transaksi</th></tr></thead>
            <tbody>
              ${trend.map(t => `
                <tr>
                  <td style="font-weight:600">${Utils.getMonthName(t.month)}</td>
                  <td class="amount-income">+${Utils.formatCurrency(t.income,settings)}</td>
                  <td class="amount-expense">-${Utils.formatCurrency(t.expense,settings)}</td>
                  <td style="color:${t.net>=0?'var(--teal)':'var(--orange)'};font-weight:600">${Utils.formatCurrency(t.net,settings)}</td>
                  <td class="text-muted">${t.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return { render, setYear, setMonth, setTab };
})();

// ============================================================
// BUDGET PAGE
// ============================================================
const BudgetPage = (() => {
  let editingId = null;

  function render() {
    const container = document.getElementById('page-budget');
    const budgets = DB.getBudgets();
    const settings = DB.getSettings();
    const now = new Date();

    container.innerHTML = `
      <div class="page-header">
        <h1>Budget Planner</h1>
        <button class="btn btn-primary btn-sm" onclick="BudgetPage.openModal()">
          <i class="fa-solid fa-plus"></i> Tambah Budget
        </button>
      </div>

      <div id="budget-list">
        ${budgets.length ? budgets.map(b => {
          const cat   = Utils.getCategoryById(b.categoryId);
          const spent = DB.getBudgetSpending(b, now.getFullYear(), now.getMonth());
          const pct   = Math.min(100, (spent / b.amount) * 100);
          const cls   = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';
          const statusColor = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
          return `
            <div class="card mb-16">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="width:44px;height:44px;border-radius:var(--radius-md);background:${cat.color}22;color:${cat.color};display:flex;align-items:center;justify-content:center;font-size:18px">
                    <i class="fa-solid ${cat.icon}"></i>
                  </div>
                  <div>
                    <div style="font-weight:700;font-size:15px">${cat.name}</div>
                    <div style="font-size:12px;color:var(--text-muted)">${b.period === 'yearly' ? 'Tahunan' : 'Bulanan'}</div>
                  </div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="btn-icon" onclick="BudgetPage.openModal('${b.id}')"><i class="fa-solid fa-pen" style="color:var(--cyan)"></i></button>
                  <button class="btn-icon" onclick="BudgetPage.deleteBudget('${b.id}')"><i class="fa-solid fa-trash" style="color:var(--red)"></i></button>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px">
                <span style="color:var(--text-muted)">Terpakai: <strong style="color:${statusColor}">${Utils.formatCurrency(spent, settings)}</strong></span>
                <span style="color:var(--text-muted)">Limit: <strong style="color:var(--text-primary)">${Utils.formatCurrency(b.amount, settings)}</strong></span>
              </div>
              <div class="progress-bar" style="height:10px">
                <div class="progress-fill ${cls}" style="width:${pct}%;--fill-color:${cat.color}"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:6px;color:var(--text-muted)">
                <span>${pct.toFixed(1)}% terpakai</span>
                <span>Sisa: ${Utils.formatCurrency(Math.max(0, b.amount - spent), settings)}</span>
              </div>
            </div>
          `;
        }).join('') : `
          <div class="empty-state">
            <i class="fa-solid fa-bullseye"></i>
            <h3>Belum ada budget</h3>
            <p>Buat budget untuk mengontrol pengeluaran kamu</p>
          </div>
        `}
      </div>

      <!-- Budget Modal -->
      <div class="modal-overlay" id="budget-modal" onclick="if(event.target===this)BudgetPage.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="budget-modal-title">Tambah Budget</div>
            <button class="btn-icon" onclick="BudgetPage.closeModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <select id="bgt-category" class="form-control">
                ${DB.getCategories().filter(c=>c.type==='expense').map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Limit Jumlah</label>
              <input type="number" id="bgt-amount" class="form-control" placeholder="0" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Periode</label>
              <select id="bgt-period" class="form-control">
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="BudgetPage.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="BudgetPage.saveBudget()"><i class="fa-solid fa-check"></i> Simpan</button>
          </div>
        </div>
      </div>
    `;
  }

  function openModal(id) {
    editingId = id || null;
    document.getElementById('budget-modal-title').textContent = id ? 'Edit Budget' : 'Tambah Budget';
    if (id) {
      const b = DB.getBudgets().find(x => x.id === id);
      if (b) {
        document.getElementById('bgt-category').value = b.categoryId;
        document.getElementById('bgt-amount').value   = b.amount;
        document.getElementById('bgt-period').value   = b.period;
      }
    } else {
      document.getElementById('bgt-amount').value = '';
    }
    Utils.openModal('budget-modal');
  }
  function closeModal() { Utils.closeModal('budget-modal'); editingId = null; }

  function saveBudget() {
    const catId  = document.getElementById('bgt-category').value;
    const amount = Utils.parseAmount(document.getElementById('bgt-amount').value);
    const period = document.getElementById('bgt-period').value;
    if (!amount || amount <= 0) { Utils.toast('Jumlah harus lebih dari 0', 'error'); return; }
    if (editingId) {
      DB.updateBudget(editingId, { categoryId: catId, amount, period });
      Utils.toast('Budget diperbarui', 'success');
    } else {
      DB.addBudget({ categoryId: catId, amount, period });
      Utils.toast('Budget ditambahkan', 'success');
    }
    closeModal(); render();
  }

  function deleteBudget(id) {
    Utils.confirm('Hapus Budget', 'Budget ini akan dihapus permanen.', () => {
      DB.deleteBudget(id); Utils.toast('Budget dihapus', 'success'); render();
    });
  }

  return { render, openModal, closeModal, saveBudget, deleteBudget };
})();

// ============================================================
// WALLET PAGE
// ============================================================
const WalletPage = (() => {
  let editingId = null;

  const WALLET_COLORS = ['#00e5ff','#00e676','#ffd740','#ff6d00','#f50057','#d500f9','#2979ff','#1de9b6','#ff1744'];
  const WALLET_ICONS  = ['fa-wallet','fa-building-columns','fa-piggy-bank','fa-credit-card','fa-money-bill-wave','fa-vault','fa-briefcase','fa-coins'];
  const WALLET_GRADIENTS = [
    'linear-gradient(135deg,#00e5ff,#2979ff)',
    'linear-gradient(135deg,#00e676,#1de9b6)',
    'linear-gradient(135deg,#ffd740,#ff6d00)',
    'linear-gradient(135deg,#f50057,#d500f9)',
    'linear-gradient(135deg,#ff1744,#ff6d00)',
    'linear-gradient(135deg,#c6ff00,#00e676)',
  ];

  function render() {
    const wallets  = DB.getWallets();
    const settings = DB.getSettings();
    const active   = DB.getActiveWallet();
    const container = document.getElementById('page-wallet');

    container.innerHTML = `
      <div class="page-header">
        <h1>Dompet</h1>
        <button class="btn btn-primary btn-sm" onclick="WalletPage.openModal()">
          <i class="fa-solid fa-plus"></i> Tambah Dompet
        </button>
      </div>

      <div class="wallet-grid mb-24" id="wallet-cards">
        ${wallets.map((w,i) => {
          const grad = WALLET_GRADIENTS[i % WALLET_GRADIENTS.length];
          const textColor = '#fff';
          return `
            <div class="wallet-card" style="background:${grad}" onclick="WalletPage.setActive('${w.id}')">
              ${w.id === active.id ? '<div class="w-active-badge">AKTIF</div>' : ''}
              <div class="w-icon"><i class="fa-solid ${w.icon || 'fa-wallet'}"></i></div>
              <div class="w-name">${w.name}</div>
              <div class="w-balance">${Utils.formatCurrency(w.balance || 0, settings)}</div>
              <div style="position:absolute;bottom:12px;right:12px;display:flex;gap:6px;z-index:2">
                <button class="btn-icon" style="background:rgba(255,255,255,.2);color:#fff" onclick="event.stopPropagation();WalletPage.openModal('${w.id}')">
                  <i class="fa-solid fa-pen" style="font-size:12px"></i>
                </button>
                ${wallets.length > 1 ? `<button class="btn-icon" style="background:rgba(255,255,255,.2);color:#fff" onclick="event.stopPropagation();WalletPage.deleteWallet('${w.id}')">
                  <i class="fa-solid fa-trash" style="font-size:12px"></i>
                </button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Wallet Modal -->
      <div class="modal-overlay" id="wallet-modal" onclick="if(event.target===this)WalletPage.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="wallet-modal-title">Tambah Dompet</div>
            <button class="btn-icon" onclick="WalletPage.closeModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nama Dompet</label>
              <input type="text" id="w-name" class="form-control" placeholder="Contoh: BCA, OVO, Kas...">
            </div>
            <div class="form-group">
              <label class="form-label">Saldo Awal</label>
              <input type="number" id="w-balance" class="form-control" placeholder="0" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Tipe</label>
              <select id="w-type" class="form-control">
                <option value="cash">Kas / Tunai</option>
                <option value="bank">Bank</option>
                <option value="ewallet">E-Wallet</option>
                <option value="investment">Investasi</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Icon</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${WALLET_ICONS.map(icon => `
                  <div class="icon-option" data-icon="${icon}" onclick="WalletPage.selectIcon(this,'${icon}')">
                    <i class="fa-solid ${icon}"></i>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="w-icon" value="fa-wallet">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="WalletPage.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="WalletPage.saveWallet()"><i class="fa-solid fa-check"></i> Simpan</button>
          </div>
        </div>
      </div>
    `;
  }

  function selectIcon(el, icon) {
    document.querySelectorAll('#wallet-modal .icon-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('w-icon').value = icon;
  }

  function openModal(id) {
    editingId = id || null;
    document.getElementById('wallet-modal-title').textContent = id ? 'Edit Dompet' : 'Tambah Dompet';
    if (id) {
      const w = DB.getWallets().find(x => x.id === id);
      if (w) {
        document.getElementById('w-name').value    = w.name;
        document.getElementById('w-balance').value = w.balance || 0;
        document.getElementById('w-type').value    = w.type || 'cash';
        document.getElementById('w-icon').value    = w.icon || 'fa-wallet';
        const iconEl = document.querySelector(`#wallet-modal .icon-option[data-icon="${w.icon}"]`);
        if (iconEl) iconEl.classList.add('selected');
      }
    } else {
      document.getElementById('w-name').value    = '';
      document.getElementById('w-balance').value = '';
    }
    Utils.openModal('wallet-modal');
  }
  function closeModal() { Utils.closeModal('wallet-modal'); editingId = null; }

  function saveWallet() {
    const name    = document.getElementById('w-name').value.trim();
    const balance = Utils.parseAmount(document.getElementById('w-balance').value);
    const type    = document.getElementById('w-type').value;
    const icon    = document.getElementById('w-icon').value;
    if (!name) { Utils.toast('Nama dompet harus diisi', 'error'); return; }
    if (editingId) {
      DB.updateWallet(editingId, { name, type, icon });
      Utils.toast('Dompet diperbarui', 'success');
    } else {
      DB.addWallet({ name, balance, type, icon });
      Utils.toast('Dompet ditambahkan', 'success');
    }
    closeModal(); render(); App.updateTopbarWallet();
  }

  function setActive(id) {
    DB.saveSettings({ activeWallet: id });
    Utils.toast('Dompet aktif diubah', 'success');
    render(); App.updateTopbarWallet();
  }

  function deleteWallet(id) {
    Utils.confirm('Hapus Dompet', 'Dompet ini dan semua datanya akan dihapus. Transaksi terkait tidak akan dihapus.', () => {
      DB.deleteWallet(id);
      const wallets = DB.getWallets();
      if (wallets.length) DB.saveSettings({ activeWallet: wallets[0].id });
      Utils.toast('Dompet dihapus', 'success');
      render(); App.updateTopbarWallet();
    });
  }

  return { render, openModal, closeModal, saveWallet, selectIcon, setActive, deleteWallet };
})();

// ============================================================
// CATEGORY PAGE
// ============================================================
const CategoryPage = (() => {
  let editingId  = null;
  let activeTab  = 'expense';

  const COLORS = ['#00e5ff','#00e676','#ffd740','#ff6d00','#f50057','#d500f9','#2979ff','#1de9b6','#ff1744','#c6ff00','#ff6e40','#40c4ff','#b2ff59','#ea80fc','#ff80ab'];
  const ICONS   = ['fa-utensils','fa-car','fa-bag-shopping','fa-gamepad','fa-heart-pulse','fa-graduation-cap','fa-file-invoice','fa-house','fa-bolt','fa-phone','fa-shirt','fa-plane','fa-music','fa-dog','fa-dumbbell','fa-coffee','fa-book','fa-laptop','fa-tv','fa-gift','fa-money-bill-wave','fa-chart-line','fa-wallet','fa-building-columns','fa-piggy-bank','fa-hand-holding-dollar','fa-briefcase','fa-tools','fa-paint-brush','fa-camera','fa-bicycle','fa-bus','fa-ellipsis'];

  function render() {
    const container = document.getElementById('page-category');
    container.innerHTML = `
      <div class="page-header">
        <h1>Kategori</h1>
        <button class="btn btn-primary btn-sm" onclick="CategoryPage.openModal()">
          <i class="fa-solid fa-plus"></i> Tambah Kategori
        </button>
      </div>
      <div class="tab-nav mb-20">
        <div class="tab-btn ${activeTab==='expense'?'active':''}" onclick="CategoryPage.setTab('expense')">Pengeluaran</div>
        <div class="tab-btn ${activeTab==='income'?'active':''}" onclick="CategoryPage.setTab('income')">Pemasukan</div>
      </div>
      <div id="cat-list"></div>

      <!-- Modal -->
      <div class="modal-overlay" id="cat-modal" onclick="if(event.target===this)CategoryPage.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="cat-modal-title">Tambah Kategori</div>
            <button class="btn-icon" onclick="CategoryPage.closeModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nama Kategori</label>
              <input type="text" id="cat-name" class="form-control" placeholder="Nama kategori...">
            </div>
            <div class="form-group">
              <label class="form-label">Jenis</label>
              <div class="type-toggle">
                <div class="type-toggle-btn expense active" onclick="CategoryPage.setModalType('expense',this)"><i class="fa-solid fa-arrow-trend-down"></i> Pengeluaran</div>
                <div class="type-toggle-btn income" onclick="CategoryPage.setModalType('income',this)"><i class="fa-solid fa-arrow-trend-up"></i> Pemasukan</div>
              </div>
              <input type="hidden" id="cat-type" value="expense">
            </div>
            <div class="form-group">
              <label class="form-label">Warna</label>
              <div class="color-picker-row">
                ${COLORS.map(c => `<div class="color-swatch" style="background:${c}" data-color="${c}" onclick="CategoryPage.selectColor(this,'${c}')"></div>`).join('')}
              </div>
              <input type="hidden" id="cat-color" value="${COLORS[0]}">
            </div>
            <div class="form-group">
              <label class="form-label">Icon</label>
              <div class="icon-picker-grid">
                ${ICONS.map(icon => `<div class="icon-option" data-icon="${icon}" onclick="CategoryPage.selectIcon(this,'${icon}')"><i class="fa-solid ${icon}"></i></div>`).join('')}
              </div>
              <input type="hidden" id="cat-icon" value="fa-ellipsis">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="CategoryPage.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="CategoryPage.saveCategory()"><i class="fa-solid fa-check"></i> Simpan</button>
          </div>
        </div>
      </div>
    `;
    _renderList();
  }

  function _renderList() {
    const cats = DB.getCategories().filter(c => c.type === activeTab);
    const el   = document.getElementById('cat-list');
    el.innerHTML = cats.map(c => `
      <div class="card mb-12" style="display:flex;align-items:center;gap:14px;padding:14px 18px">
        <div style="width:44px;height:44px;border-radius:var(--radius-md);background:${c.color}22;color:${c.color};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
          <i class="fa-solid ${c.icon}"></i>
        </div>
        <div style="flex:1;font-weight:600">${c.name}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="CategoryPage.openModal('${c.id}')"><i class="fa-solid fa-pen" style="color:var(--cyan)"></i></button>
          <button class="btn-icon" onclick="CategoryPage.deleteCategory('${c.id}')"><i class="fa-solid fa-trash" style="color:var(--red)"></i></button>
        </div>
      </div>
    `).join('') || `<div class="empty-state"><i class="fa-solid fa-tag"></i><h3>Belum ada kategori</h3></div>`;
  }

  function setTab(t) {
    activeTab = t;
    document.querySelectorAll('#page-category .tab-btn').forEach((b,i) => b.classList.toggle('active', ['expense','income'][i]===t));
    _renderList();
  }
  function setModalType(type, el) {
    document.getElementById('cat-type').value = type;
    document.querySelectorAll('#cat-modal .type-toggle-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  }
  function selectColor(el, color) {
    document.querySelectorAll('.color-swatch').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('cat-color').value = color;
  }
  function selectIcon(el, icon) {
    document.querySelectorAll('#cat-modal .icon-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('cat-icon').value = icon;
  }

  function openModal(id) {
    editingId = id || null;
    document.getElementById('cat-modal-title').textContent = id ? 'Edit Kategori' : 'Tambah Kategori';
    if (id) {
      const c = DB.getCategories().find(x => x.id === id);
      if (c) {
        document.getElementById('cat-name').value  = c.name;
        document.getElementById('cat-type').value  = c.type;
        document.getElementById('cat-color').value = c.color;
        document.getElementById('cat-icon').value  = c.icon;
        const sw = document.querySelector(`#cat-modal .color-swatch[data-color="${c.color}"]`);
        if (sw) sw.classList.add('selected');
        const ic = document.querySelector(`#cat-modal .icon-option[data-icon="${c.icon}"]`);
        if (ic) ic.classList.add('selected');
        document.querySelectorAll('#cat-modal .type-toggle-btn').forEach(b => {
          b.classList.toggle('active', b.classList.contains(c.type));
        });
      }
    } else {
      document.getElementById('cat-name').value = '';
    }
    Utils.openModal('cat-modal');
  }
  function closeModal() { Utils.closeModal('cat-modal'); editingId = null; }

  function saveCategory() {
    const name  = document.getElementById('cat-name').value.trim();
    const type  = document.getElementById('cat-type').value;
    const color = document.getElementById('cat-color').value;
    const icon  = document.getElementById('cat-icon').value;
    if (!name) { Utils.toast('Nama kategori harus diisi', 'error'); return; }
    if (editingId) {
      DB.updateCategory(editingId, { name, type, color, icon });
      Utils.toast('Kategori diperbarui', 'success');
    } else {
      DB.addCategory({ name, type, color, icon });
      Utils.toast('Kategori ditambahkan', 'success');
    }
    closeModal(); _renderList();
  }

  function deleteCategory(id) {
    Utils.confirm('Hapus Kategori', 'Kategori ini akan dihapus. Transaksi dengan kategori ini tidak akan terpengaruh.', () => {
      DB.deleteCategory(id); Utils.toast('Kategori dihapus', 'success'); _renderList();
    });
  }

  return { render, setTab, openModal, closeModal, saveCategory, setModalType, selectColor, selectIcon, deleteCategory };
})();

// ============================================================
// RECURRING PAGE
// ============================================================
const RecurringPage = (() => {
  let editingId = null;

  function render() {
    const container = document.getElementById('page-recurring');
    const list = DB.getRecurring();
    const settings = DB.getSettings();

    container.innerHTML = `
      <div class="page-header">
        <h1>Transaksi Rutin</h1>
        <button class="btn btn-primary btn-sm" onclick="RecurringPage.openModal()">
          <i class="fa-solid fa-plus"></i> Tambah
        </button>
      </div>
      <p class="text-muted text-sm mb-20">Transaksi rutin akan otomatis dibuat sesuai jadwal saat aplikasi dibuka.</p>

      <div id="recurring-list">
        ${list.length ? list.map(r => {
          const cat    = Utils.getCategoryById(r.categoryId);
          const wallet = Utils.getWalletById(r.walletId);
          const freqMap = {daily:'Harian',weekly:'Mingguan',monthly:'Bulanan',yearly:'Tahunan'};
          return `
            <div class="card mb-12">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:44px;height:44px;border-radius:var(--radius-md);background:${cat.color}22;color:${cat.color};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
                  <i class="fa-solid ${cat.icon}"></i>
                </div>
                <div style="flex:1">
                  <div style="font-weight:700;font-size:15px">${r.name}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
                    ${freqMap[r.frequency]} · ${cat.name} · ${wallet.name}
                    ${r.lastRun ? ' · Terakhir: ' + Utils.formatDate(r.lastRun) : ''}
                  </div>
                </div>
                <div style="text-align:right;margin-right:8px">
                  <div class="${r.type==='income'?'amount-income':'amount-expense'}" style="font-size:15px;font-weight:700">
                    ${r.type==='income'?'+':'-'}${Utils.formatCurrency(r.amount, settings)}
                  </div>
                  <div class="badge ${r.active?'badge-income':'badge-neutral'}" style="margin-top:4px;font-size:9px">
                    ${r.active ? 'AKTIF' : 'NONAKTIF'}
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <button class="btn-icon" onclick="RecurringPage.toggleActive('${r.id}',${!r.active})"><i class="fa-solid ${r.active?'fa-pause':'fa-play'}" style="color:var(--yellow)"></i></button>
                  <button class="btn-icon" onclick="RecurringPage.openModal('${r.id}')"><i class="fa-solid fa-pen" style="color:var(--cyan)"></i></button>
                  <button class="btn-icon" onclick="RecurringPage.deleteRecurring('${r.id}')"><i class="fa-solid fa-trash" style="color:var(--red)"></i></button>
                </div>
              </div>
            </div>
          `;
        }).join('') : `<div class="empty-state"><i class="fa-solid fa-rotate"></i><h3>Belum ada transaksi rutin</h3><p>Tambahkan transaksi yang terjadi secara berkala</p></div>`}
      </div>

      <!-- Modal -->
      <div class="modal-overlay" id="rec-modal" onclick="if(event.target===this)RecurringPage.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="rec-modal-title">Tambah Transaksi Rutin</div>
            <button class="btn-icon" onclick="RecurringPage.closeModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nama</label>
              <input type="text" id="rec-name" class="form-control" placeholder="Contoh: Gaji Bulanan, Netflix...">
            </div>
            <div class="form-group">
              <label class="form-label">Jenis</label>
              <div class="type-toggle">
                <div class="type-toggle-btn income" onclick="RecurringPage.setType('income',this)"><i class="fa-solid fa-arrow-trend-up"></i> Pemasukan</div>
                <div class="type-toggle-btn expense active" onclick="RecurringPage.setType('expense',this)"><i class="fa-solid fa-arrow-trend-down"></i> Pengeluaran</div>
              </div>
              <input type="hidden" id="rec-type" value="expense">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Jumlah</label>
                <input type="number" id="rec-amount" class="form-control" placeholder="0" min="0">
              </div>
              <div class="form-group">
                <label class="form-label">Frekuensi</label>
                <select id="rec-frequency" class="form-control">
                  <option value="daily">Harian</option>
                  <option value="weekly">Mingguan</option>
                  <option value="monthly" selected>Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Kategori</label>
                <select id="rec-category" class="form-control">
                  ${DB.getCategories().map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Dompet</label>
                <select id="rec-wallet" class="form-control">
                  ${DB.getWallets().map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Mulai Tanggal</label>
              <input type="date" id="rec-start" class="form-control" value="${Utils.todayStr()}">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="RecurringPage.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="RecurringPage.saveRecurring()"><i class="fa-solid fa-check"></i> Simpan</button>
          </div>
        </div>
      </div>
    `;
  }

  function setType(type, el) {
    document.getElementById('rec-type').value = type;
    document.querySelectorAll('#rec-modal .type-toggle-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  }

  function openModal(id) {
    editingId = id || null;
    document.getElementById('rec-modal-title').textContent = id ? 'Edit Transaksi Rutin' : 'Tambah Transaksi Rutin';
    if (id) {
      const r = DB.getRecurring().find(x => x.id === id);
      if (r) {
        document.getElementById('rec-name').value      = r.name;
        document.getElementById('rec-type').value      = r.type;
        document.getElementById('rec-amount').value    = r.amount;
        document.getElementById('rec-frequency').value = r.frequency;
        document.getElementById('rec-category').value  = r.categoryId;
        document.getElementById('rec-wallet').value    = r.walletId;
        document.getElementById('rec-start').value     = r.startDate;
      }
    } else {
      document.getElementById('rec-name').value   = '';
      document.getElementById('rec-amount').value = '';
    }
    Utils.openModal('rec-modal');
  }
  function closeModal() { Utils.closeModal('rec-modal'); editingId = null; }

  function saveRecurring() {
    const name      = document.getElementById('rec-name').value.trim();
    const type      = document.getElementById('rec-type').value;
    const amount    = Utils.parseAmount(document.getElementById('rec-amount').value);
    const frequency = document.getElementById('rec-frequency').value;
    const catId     = document.getElementById('rec-category').value;
    const walletId  = document.getElementById('rec-wallet').value;
    const startDate = document.getElementById('rec-start').value;
    if (!name)   { Utils.toast('Nama harus diisi', 'error'); return; }
    if (!amount) { Utils.toast('Jumlah harus diisi', 'error'); return; }
    if (editingId) {
      DB.updateRecurring(editingId, { name, type, amount, frequency, categoryId: catId, walletId, startDate });
      Utils.toast('Transaksi rutin diperbarui', 'success');
    } else {
      DB.addRecurring({ name, type, amount, frequency, categoryId: catId, walletId, startDate, active: true });
      Utils.toast('Transaksi rutin ditambahkan', 'success');
    }
    closeModal(); render();
  }

  function toggleActive(id, active) {
    DB.updateRecurring(id, { active }); render();
    Utils.toast(active ? 'Diaktifkan' : 'Dinonaktifkan', 'success');
  }

  function deleteRecurring(id) {
    Utils.confirm('Hapus Transaksi Rutin', 'Transaksi rutin ini akan dihapus.', () => {
      DB.deleteRecurring(id); Utils.toast('Dihapus', 'success'); render();
    });
  }

  return { render, openModal, closeModal, saveRecurring, setType, toggleActive, deleteRecurring };
})();

// ============================================================
// BACKUP PAGE
// ============================================================
const BackupPage = (() => {
  function render() {
    const container = document.getElementById('page-backup');
    const txnCount  = DB.getTransactions().length;
    const settings  = DB.getSettings();

    container.innerHTML = `
      <div class="page-header"><h1>Backup & Restore</h1></div>

      <div style="max-width:600px;margin:0 auto">
        <!-- Export -->
        <div class="card mb-16">
          <div class="card-header" style="margin-bottom:12px">
            <span class="card-title"><i class="fa-solid fa-cloud-arrow-up" style="color:var(--cyan)"></i> Export / Backup</span>
          </div>
          <p class="text-muted text-sm mb-16">Unduh semua data aplikasi dalam format JSON. Simpan file ini di tempat yang aman untuk cadangan data.</p>
          <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;font-size:13px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span class="text-muted">Total Transaksi</span>
              <strong>${txnCount}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span class="text-muted">Kategori</span>
              <strong>${DB.getCategories().length}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span class="text-muted">Dompet</span>
              <strong>${DB.getWallets().length}</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span class="text-muted">Tanggal Export</span>
              <strong>${Utils.formatDate(new Date().toISOString())}</strong>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" style="flex:1" onclick="BackupPage.exportJSON()">
              <i class="fa-solid fa-download"></i> Export JSON
            </button>
            <button class="btn btn-ghost" style="flex:1" onclick="BackupPage.exportCSVAll()">
              <i class="fa-solid fa-file-csv" style="color:var(--green)"></i> Export CSV
            </button>
          </div>
        </div>

        <!-- Import -->
        <div class="card mb-16">
          <div class="card-header" style="margin-bottom:12px">
            <span class="card-title"><i class="fa-solid fa-cloud-arrow-down" style="color:var(--green)"></i> Import / Restore</span>
          </div>
          <p class="text-muted text-sm mb-16">Restore data dari file backup JSON yang sebelumnya diekspor dari Ditz Money. Data yang ada akan digabungkan/ditimpa.</p>
          <div id="drop-zone" style="border:2px dashed var(--border-light);border-radius:var(--radius-lg);padding:32px;text-align:center;cursor:pointer;transition:var(--transition)"
            onclick="document.getElementById('file-input').click()"
            ondragover="event.preventDefault();this.style.borderColor='var(--cyan)'"
            ondragleave="this.style.borderColor=''"
            ondrop="BackupPage.onDrop(event)">
            <i class="fa-solid fa-file-import" style="font-size:36px;color:var(--text-muted);margin-bottom:12px"></i>
            <div style="font-weight:600;margin-bottom:6px">Klik atau drag file JSON di sini</div>
            <div class="text-muted text-sm">Format: fintrack_backup_*.json</div>
          </div>
          <input type="file" id="file-input" accept=".json" style="display:none" onchange="BackupPage.onFileSelect(event)">
        </div>

        <!-- Reset -->
        <div class="card" style="border-color:rgba(255,23,68,.3)">
          <div class="card-header" style="margin-bottom:12px">
            <span class="card-title"><i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Reset Data</span>
          </div>
          <p class="text-muted text-sm mb-16">Hapus semua data aplikasi secara permanen. Aksi ini tidak bisa dibatalkan.</p>
          <button class="btn btn-danger" onclick="BackupPage.resetAll()">
            <i class="fa-solid fa-trash-can"></i> Reset Semua Data
          </button>
        </div>
      </div>
    `;
  }

  function exportJSON() {
    const backup = DB.exportBackup();
    const json   = JSON.stringify(backup, null, 2);
    Utils.downloadFile(json, `fintrack_backup_${Utils.todayStr()}.json`, 'application/json');
    Utils.toast('Backup JSON berhasil diunduh', 'success');
  }

  function exportCSVAll() {
    const txns = DB.getTransactions();
    if (!txns.length) { Utils.toast('Belum ada transaksi', 'warning'); return; }
    const csv = Utils.transactionsToCSV(txns);
    Utils.downloadFile(csv, `fintrack_semua_transaksi_${Utils.todayStr()}.csv`, 'text/csv');
    Utils.toast('CSV berhasil diunduh', 'success');
  }

  function onDrop(e) {
    e.preventDefault();
    document.getElementById('drop-zone').style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) _processFile(file);
  }

  function onFileSelect(e) {
    const file = e.target.files[0];
    if (file) _processFile(file);
  }

  function _processFile(file) {
    if (!file.name.endsWith('.json')) { Utils.toast('File harus berformat JSON', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const backup = JSON.parse(e.target.result);
        Utils.confirm(
          'Restore Backup',
          `File: ${file.name}\nData akan ditimpa. Lanjutkan?`,
          () => {
            DB.importBackup(backup);
            Utils.toast('Backup berhasil dipulihkan', 'success');
            App.updateTopbarWallet();
            render();
          }, 'warning'
        );
      } catch { Utils.toast('File backup tidak valid', 'error'); }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    Utils.confirm('Reset Semua Data', 'SEMUA data akan dihapus permanen! Pastikan sudah melakukan backup.', () => {
      DB.clearAll();
      Utils.toast('Semua data telah direset', 'success');
      App.updateTopbarWallet();
      App.navigate('dashboard');
    });
  }

  return { render, exportJSON, exportCSVAll, onDrop, onFileSelect, resetAll };
})();

// ============================================================
// SETTINGS PAGE
// ============================================================
const SettingsPage = (() => {
  const CURRENCIES = [
    { code:'IDR', name:'Rupiah (Rp)', locale:'id-ID' },
    { code:'USD', name:'Dollar US ($)', locale:'en-US' },
    { code:'EUR', name:'Euro (€)', locale:'de-DE' },
    { code:'SGD', name:'Dollar Singapura ($)', locale:'en-SG' },
    { code:'MYR', name:'Ringgit Malaysia (RM)', locale:'ms-MY' },
    { code:'GBP', name:'Pound Sterling (£)', locale:'en-GB' },
    { code:'JPY', name:'Yen Jepang (¥)', locale:'ja-JP' },
  ];

  function render() {
    const container = document.getElementById('page-settings');
    const s = DB.getSettings();

    container.innerHTML = `
      <div class="page-header"><h1>Pengaturan</h1></div>

      <div style="max-width:600px;margin:0 auto">
        <!-- App -->
        <div class="settings-section">
          <div class="settings-section-title">Aplikasi</div>
          <div class="settings-item">
            <div class="settings-item-left">
              <div class="settings-item-icon"><i class="fa-solid fa-pen" style="color:var(--cyan)"></i></div>
              <div class="settings-item-info">
                <h4>Nama Aplikasi</h4>
                <p>Tampil di header dan laporan</p>
              </div>
            </div>
            <input type="text" class="form-control" style="width:160px;text-align:right" value="${s.appName || 'Ditz Money'}" id="set-app-name" onchange="SettingsPage.saveSetting('appName',this.value)">
          </div>
          <div class="settings-item">
            <div class="settings-item-left">
              <div class="settings-item-icon"><i class="fa-solid fa-coins" style="color:var(--yellow)"></i></div>
              <div class="settings-item-info">
                <h4>Mata Uang</h4>
                <p>Format tampilan angka</p>
              </div>
            </div>
            <select class="form-control" style="width:auto" id="set-currency" onchange="SettingsPage.setCurrency(this.value)">
              ${CURRENCIES.map(c=>`<option value="${c.code}" ${c.code===s.currency?'selected':''}>${c.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Security -->
        <div class="settings-section">
          <div class="settings-section-title">Keamanan</div>
          <div class="settings-item">
            <div class="settings-item-left">
              <div class="settings-item-icon"><i class="fa-solid fa-lock" style="color:var(--orange)"></i></div>
              <div class="settings-item-info">
                <h4>PIN Keamanan</h4>
                <p>Proteksi aplikasi dengan PIN 4 digit</p>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="set-pin-toggle" ${s.pinEnabled?'checked':''} onchange="SettingsPage.togglePin(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div id="pin-input-section" style="${s.pinEnabled?'':'display:none'}">
            <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:10px">
              <label class="form-label">Atur PIN (4 digit)</label>
              <div style="display:flex;gap:8px">
                <input type="password" id="set-pin" class="form-control" maxlength="4" style="width:100px;text-align:center;letter-spacing:8px;font-size:20px" placeholder="••••" value="${s.pin||''}">
                <button class="btn btn-primary" onclick="SettingsPage.savePin()"><i class="fa-solid fa-check"></i> Simpan PIN</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Data -->
        <div class="settings-section">
          <div class="settings-section-title">Data & Penyimpanan</div>
          <div class="settings-item" onclick="App.navigate('backup')" style="cursor:pointer">
            <div class="settings-item-left">
              <div class="settings-item-icon"><i class="fa-solid fa-database" style="color:var(--blue)"></i></div>
              <div class="settings-item-info">
                <h4>Backup & Restore</h4>
                <p>${DB.getTransactions().length} transaksi tersimpan</p>
              </div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:var(--text-muted)"></i>
          </div>
        </div>

        <!-- Install PWA -->
        <div class="settings-section">
          <div class="settings-section-title">Instalasi</div>
          <div class="settings-item" id="pwa-install-item">
            <div class="settings-item-left">
              <div class="settings-item-icon" id="pwa-install-icon">
                <i class="fa-solid fa-mobile-screen" style="color:var(--cyan)"></i>
              </div>
              <div class="settings-item-info">
                <h4 id="pwa-install-title">Install Aplikasi</h4>
                <p id="pwa-install-desc">Pasang di layar utama untuk akses cepat</p>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" id="pwa-install-btn" onclick="SettingsPage.triggerInstall()">
              <i class="fa-solid fa-download"></i> Install
            </button>
          </div>
        </div>

        <!-- About -->
        <div class="settings-section">
          <div class="settings-section-title">Tentang</div>
          <div class="card" style="padding:20px;text-align:center">
            <img src="https://d.top4top.io/p_3721v7lxr0.png" alt="Ditz Money" style="width:56px;height:56px;border-radius:var(--radius-lg);object-fit:cover;margin:0 auto 12px;display:block">
            <div style="font-family:var(--font-display);font-size:20px;font-weight:800;margin-bottom:4px">${s.appName || 'Ditz Money'}</div>
            <div class="text-muted text-sm">Versi 1.0.0 · Aplikasi Keuangan Pribadi</div>
            <div class="text-muted text-sm" style="margin-top:4px">Data disimpan di browser (localStorage)</div>
          </div>
        </div>
      </div>

      <!-- iOS Install Modal -->
      <div class="modal-overlay" id="ios-install-modal" onclick="if(event.target===this)Utils.closeModal('ios-install-modal')">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">Install di iPhone / iPad</div>
            <button class="btn-icon" onclick="Utils.closeModal('ios-install-modal')"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <p class="text-muted text-sm" style="margin-bottom:20px">Ikuti langkah berikut untuk memasang Ditz Money di layar utama:</p>
            <div style="display:flex;flex-direction:column;gap:16px">
              <div style="display:flex;align-items:center;gap:14px;padding:14px;background:var(--bg-elevated);border-radius:var(--radius-md)">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--cyan);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;flex-shrink:0">1</div>
                <div>
                  <div style="font-weight:600;margin-bottom:2px">Tap tombol Share</div>
                  <div class="text-muted text-sm">Tombol <i class="fa-solid fa-arrow-up-from-bracket" style="color:var(--cyan)"></i> di bagian bawah Safari</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:14px;padding:14px;background:var(--bg-elevated);border-radius:var(--radius-md)">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;flex-shrink:0">2</div>
                <div>
                  <div style="font-weight:600;margin-bottom:2px">Pilih "Add to Home Screen"</div>
                  <div class="text-muted text-sm">Scroll ke bawah di menu Share sampai menemukan opsi ini</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:14px;padding:14px;background:var(--bg-elevated);border-radius:var(--radius-md)">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--yellow);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;flex-shrink:0">3</div>
                <div>
                  <div style="font-weight:600;margin-bottom:2px">Tap "Add" di pojok kanan atas</div>
                  <div class="text-muted text-sm">Ditz Money akan muncul di layar utama</div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" style="width:100%" onclick="Utils.closeModal('ios-install-modal')">
              <i class="fa-solid fa-check"></i> Mengerti
            </button>
          </div>
        </div>
      </div>
    `;

    // Init PWA install state after render
    setTimeout(() => SettingsPage.initPWAButton(), 50);
  }

  function saveSetting(key, value) {
    DB.saveSettings({ [key]: value });
    if (key === 'appName') {
      const logoText = document.querySelector('.sidebar-logo .logo-text');
      if (logoText) logoText.textContent = value || 'Ditz Money';
      document.title = (value || 'Ditz Money') + ' - Laporan Keuangan';
    }
  }

  function setCurrency(code) {
    const cur = CURRENCIES.find(c => c.code === code);
    if (cur) DB.saveSettings({ currency: code, locale: cur.locale });
    Utils.toast('Mata uang diperbarui', 'success');
  }

  function togglePin(enabled) {
    DB.saveSettings({ pinEnabled: enabled });
    document.getElementById('pin-input-section').style.display = enabled ? '' : 'none';
    if (!enabled) DB.saveSettings({ pin: '' });
  }

  function savePin() {
    const pin = document.getElementById('set-pin').value;
    if (!/^\d{4}$/.test(pin)) { Utils.toast('PIN harus 4 digit angka', 'error'); return; }
    DB.saveSettings({ pin });
    Utils.toast('PIN disimpan', 'success');
  }

  function initPWAButton() {
    const btn   = document.getElementById('pwa-install-btn');
    const title = document.getElementById('pwa-install-title');
    const desc  = document.getElementById('pwa-install-desc');
    const icon  = document.getElementById('pwa-install-icon');
    if (!btn) return;

    // Already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      _setInstalledState(btn, title, desc, icon);
      return;
    }

    // iOS detection
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      btn.innerHTML = '<i class="fa-solid fa-circle-info"></i> Cara Install';
      btn.className = 'btn btn-ghost btn-sm';
      return;
    }

    // Android/Desktop — check if prompt available
    if (window._deferredPWAPrompt) {
      btn.style.display = '';
    } else {
      // Prompt not available yet, show info
      btn.innerHTML = '<i class="fa-solid fa-circle-info"></i> Cara Install';
      btn.className = 'btn btn-ghost btn-sm';
    }
  }

  function _setInstalledState(btn, title, desc, icon) {
    if (btn)   { btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Terinstall'; btn.className = 'btn btn-ghost btn-sm'; btn.disabled = true; btn.style.color = 'var(--green)'; }
    if (title) title.textContent = 'Sudah Terinstall';
    if (desc)  desc.textContent  = 'Ditz Money sudah terpasang di layar utama';
    if (icon)  icon.innerHTML    = '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i>';
  }

  function triggerInstall() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      Utils.openModal('ios-install-modal');
      return;
    }
    if (window._deferredPWAPrompt) {
      window._deferredPWAPrompt.prompt();
      window._deferredPWAPrompt.userChoice.then(result => {
        if (result.outcome === 'accepted') {
          Utils.toast('Ditz Money berhasil diinstall!', 'success');
          const btn   = document.getElementById('pwa-install-btn');
          const title = document.getElementById('pwa-install-title');
          const desc  = document.getElementById('pwa-install-desc');
          const icon  = document.getElementById('pwa-install-icon');
          _setInstalledState(btn, title, desc, icon);
        }
        window._deferredPWAPrompt = null;
      });
    } else {
      Utils.toast('Buka di Chrome Android atau Desktop untuk install', 'warning');
    }
  }

  return { render, saveSetting, setCurrency, togglePin, savePin, initPWAButton, triggerInstall };
})();
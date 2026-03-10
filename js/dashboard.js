/**
 * FinTrack - Dashboard Page
 */

const Dashboard = (() => {

  let barChart  = null;
  let pieChart  = null;
  let currentYear  = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function render() {
    const container = document.getElementById('page-dashboard');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 id="dash-greeting">Halo!</h1>
          <p class="text-muted text-sm" id="dash-date"></p>
        </div>
        <div class="flex gap-8">
          <select id="dash-year-select" class="form-control" style="width:auto;padding:8px 12px;font-size:13px;"></select>
          <select id="dash-month-select" class="form-control" style="width:auto;padding:8px 12px;font-size:13px;"></select>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" id="dash-stats"></div>

      <!-- Charts & Recent -->
      <div class="dashboard-grid">
        <div class="card span-2">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-chart-bar" style="color:var(--purple)"></i> Tren Bulanan</span>
            <span class="text-xs text-muted" id="dash-trend-year"></span>
          </div>
          <div class="chart-wrapper" style="height:220px">
            <canvas id="bar-chart"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-chart-pie" style="color:var(--pink)"></i> Pengeluaran</span>
          </div>
          <div class="chart-wrapper" style="height:220px;display:flex;align-items:center;justify-content:center;">
            <canvas id="pie-chart"></canvas>
          </div>
          <div id="pie-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:6px;"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-clock-rotate-left" style="color:var(--yellow)"></i> Transaksi Terbaru</span>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('history')">Lihat semua</button>
          </div>
          <div id="dash-recent-txns"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-wallet" style="color:var(--teal)"></i> Dompet</span>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('wallet')">Kelola</button>
          </div>
          <div id="dash-wallets-list"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-bullseye" style="color:var(--orange)"></i> Budget Bulan Ini</span>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('budget')">Kelola</button>
          </div>
          <div id="dash-budgets-list"></div>
        </div>
      </div>
    `;

    _initPeriodSelectors();
    _loadData();
  }

  function _initPeriodSelectors() {
    const yearSel  = document.getElementById('dash-year-select');
    const monthSel = document.getElementById('dash-month-select');
    const now = new Date();
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      yearSel.appendChild(opt);
    }
    for (let m = 0; m < 12; m++) {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = Utils.getMonthName(m);
      if (m === currentMonth) opt.selected = true;
      monthSel.appendChild(opt);
    }
    yearSel.onchange  = () => { currentYear  = +yearSel.value;  _loadData(); };
    monthSel.onchange = () => { currentMonth = +monthSel.value; _loadData(); };
  }

  function _loadData() {
    const settings = DB.getSettings();
    const now = new Date();
    const greetingHour = now.getHours();
    const greeting = greetingHour < 12 ? 'Selamat Pagi' : greetingHour < 17 ? 'Selamat Siang' : 'Selamat Malam';
    document.getElementById('dash-greeting').textContent = greeting + '!';
    document.getElementById('dash-date').textContent = Utils.formatDate(now.toISOString(), 'long');
    document.getElementById('dash-trend-year').textContent = currentYear;

    const summary  = DB.getSummary(currentYear, currentMonth);
    const prevSummary = currentMonth === 0
      ? DB.getSummary(currentYear - 1, 11)
      : DB.getSummary(currentYear, currentMonth - 1);
    const wallets  = DB.getWallets();
    const totalBalance = wallets.reduce((s, w) => s + (w.balance || 0), 0);

    _renderStats(summary, prevSummary, totalBalance, settings);
    _renderBarChart();
    _renderPieChart(summary);
    _renderRecentTransactions();
    _renderWalletsList(wallets, settings);
    _renderBudgets(settings);
  }

  function _renderStats(summary, prev, totalBalance, settings) {
    const cards = [
      {
        label: 'Total Saldo', icon: 'fa-vault', color: 'var(--cyan)',
        value: Utils.formatCurrency(totalBalance, settings),
        change: null,
      },
      {
        label: 'Pemasukan', icon: 'fa-arrow-trend-up', color: 'var(--green)',
        value: Utils.formatCurrency(summary.income, settings),
        change: Utils.percentChange(summary.income, prev.income),
        up: summary.income >= prev.income,
      },
      {
        label: 'Pengeluaran', icon: 'fa-arrow-trend-down', color: 'var(--red)',
        value: Utils.formatCurrency(summary.expense, settings),
        change: Utils.percentChange(summary.expense, prev.expense),
        up: summary.expense <= prev.expense,
      },
      {
        label: 'Selisih Bersih', icon: 'fa-scale-balanced', color: summary.net >= 0 ? 'var(--teal)' : 'var(--orange)',
        value: Utils.formatCurrency(summary.net, settings),
        change: null,
      },
    ];
    document.getElementById('dash-stats').innerHTML = cards.map(c => `
      <div class="stat-card" style="--accent-color:${c.color}">
        <div class="stat-icon"><i class="fa-solid ${c.icon}"></i></div>
        <div class="stat-label">${c.label}</div>
        <div class="stat-value" style="color:${c.color}">${c.value}</div>
        ${c.change !== null ? `
          <div class="stat-change ${c.up ? 'up' : 'down'}">
            <i class="fa-solid ${c.up ? 'fa-caret-up' : 'fa-caret-down'}"></i>
            ${Math.abs(c.change)}% dari bulan lalu
          </div>` : '<div class="stat-change">Total semua dompet</div>'}
      </div>
    `).join('');
  }

  function _renderBarChart() {
    const trend = DB.getMonthlyTrend(currentYear);
    const settings = DB.getSettings();
    const labels = trend.map(t => Utils.getMonthName(t.month, true));
    const incomeData  = trend.map(t => t.income);
    const expenseData = trend.map(t => t.expense);

    if (barChart) barChart.destroy();
    const ctx = document.getElementById('bar-chart').getContext('2d');
    barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Pemasukan',
            data: incomeData,
            backgroundColor: 'rgba(0,230,118,.7)',
            borderColor: 'rgba(0,230,118,1)',
            borderWidth: 1, borderRadius: 6,
          },
          {
            label: 'Pengeluaran',
            data: expenseData,
            backgroundColor: 'rgba(255,23,68,.65)',
            borderColor: 'rgba(255,23,68,1)',
            borderWidth: 1, borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#8b92b3', font: { size: 12 } } } },
        scales: {
          x: { ticks: { color: '#8b92b3' }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: {
            ticks: {
              color: '#8b92b3',
              callback: v => Utils.formatShortNumber(v)
            },
            grid: { color: 'rgba(255,255,255,.05)' }
          }
        }
      }
    });
  }

  function _renderPieChart(summary) {
    const catTotals = DB.getCategoryTotals(currentYear, currentMonth, 'expense');
    if (pieChart) pieChart.destroy();

    if (!catTotals.length) {
      document.getElementById('pie-chart').style.display = 'none';
      document.getElementById('pie-legend').innerHTML = '<p class="text-muted text-sm" style="text-align:center">Belum ada pengeluaran bulan ini</p>';
      return;
    }
    document.getElementById('pie-chart').style.display = '';
    const ctx = document.getElementById('pie-chart').getContext('2d');
    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: catTotals.map(c => c.name),
        datasets: [{
          data: catTotals.map(c => c.total),
          backgroundColor: catTotals.map(c => c.color + 'cc'),
          borderColor:     catTotals.map(c => c.color),
          borderWidth: 2,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { display: false } }
      }
    });

    const settings = DB.getSettings();
    document.getElementById('pie-legend').innerHTML = catTotals.slice(0, 5).map(c => `
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="cat-dot" style="background:${c.color}"></span>
          <span>${c.name}</span>
        </div>
        <span style="font-weight:600;color:${c.color}">${Utils.formatCurrency(c.total, settings)}</span>
      </div>
    `).join('');
  }

  function _renderRecentTransactions() {
    const txns = DB.getTransactions().slice(0, 5);
    const settings = DB.getSettings();
    const el = document.getElementById('dash-recent-txns');
    if (!txns.length) {
      el.innerHTML = `<div class="empty-state" style="padding:30px 20px">
        <i class="fa-solid fa-receipt"></i><p>Belum ada transaksi</p>
      </div>`;
      return;
    }
    el.innerHTML = txns.map(t => {
      const cat = Utils.getCategoryById(t.categoryId);
      return `
        <div class="txn-item" onclick="App.navigate('history')">
          <div class="txn-icon" style="background:${cat.color}22;color:${cat.color}">
            <i class="fa-solid ${cat.icon}"></i>
          </div>
          <div class="txn-info">
            <div class="txn-name">${cat.name}</div>
            <div class="txn-meta">${Utils.relativeDateStr(t.date)}${t.note ? ' · ' + Utils.truncate(t.note, 20) : ''}</div>
          </div>
          <div class="txn-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
            ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount, settings)}
          </div>
        </div>
      `;
    }).join('');
  }

  function _renderWalletsList(wallets, settings) {
    const el = document.getElementById('dash-wallets-list');
    const activeWallet = DB.getActiveWallet();
    el.innerHTML = wallets.map(w => `
      <div class="txn-item">
        <div class="txn-icon" style="background:${w.color}22;color:${w.color}">
          <i class="fa-solid ${w.icon || 'fa-wallet'}"></i>
        </div>
        <div class="txn-info">
          <div class="txn-name">${w.name} ${w.id === activeWallet.id ? '<span class="badge badge-neutral" style="font-size:9px;padding:2px 7px">AKTIF</span>' : ''}</div>
          <div class="txn-meta">${w.type || 'cash'}</div>
        </div>
        <div class="txn-amount" style="color:${w.color}">${Utils.formatCurrency(w.balance || 0, settings)}</div>
      </div>
    `).join('');
  }

  function _renderBudgets(settings) {
    const budgets = DB.getBudgets();
    const el = document.getElementById('dash-budgets-list');
    if (!budgets.length) {
      el.innerHTML = `<div class="empty-state" style="padding:20px">
        <i class="fa-solid fa-bullseye"></i><p>Belum ada budget. <a href="#" onclick="App.navigate('budget')" style="color:var(--cyan)">Tambah budget</a></p>
      </div>`;
      return;
    }
    const now = new Date();
    el.innerHTML = budgets.slice(0, 4).map(b => {
      const spent  = DB.getBudgetSpending(b, now.getFullYear(), now.getMonth());
      const pct    = Math.min(100, (spent / b.amount) * 100);
      const cat    = Utils.getCategoryById(b.categoryId);
      const cls    = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';
      return `
        <div class="budget-item">
          <div class="budget-header">
            <div class="budget-label">
              <span class="cat-dot" style="background:${cat.color}"></span>
              ${cat.name}
            </div>
            <div class="budget-amounts">${Utils.formatCurrency(spent, settings)} / ${Utils.formatCurrency(b.amount, settings)}</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${cls}" style="width:${pct}%;--fill-color:${cat.color}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  return { render };
})();

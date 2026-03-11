
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
          <button class="btn btn-ghost btn-sm" onclick="ReportPage.printPDF()" title="Cetak / Export PDF">
            <i class="fa-solid fa-print" style="color:var(--purple)"></i>
          </button>
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

  function printPDF() {
    const settings    = DB.getSettings();
    const appName     = settings.appName || 'Ditz Money';
    const summary     = DB.getSummary(year, month);
    const trend       = DB.getMonthlyTrend(year);
    const txns        = DB.getTransactionsByPeriod(year, month);
    const expCats     = DB.getCategoryTotals(year, month, 'expense');
    const incCats     = DB.getCategoryTotals(year, month, 'income');
    const totalIncome  = trend.reduce((s,t) => s + t.income, 0);
    const totalExpense = trend.reduce((s,t) => s + t.expense, 0);
    const savingRate   = summary.income > 0 ? ((summary.net / summary.income) * 100).toFixed(1) : 0;
    const periodLabel  = activeTab === 'yearly'
      ? `Tahun ${year}`
      : `${Utils.getMonthName(month)} ${year}`;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) { Utils.toast('Izinkan popup untuk mencetak laporan', 'warning'); return; }

    const styles = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a2e; font-size: 14px; }
      .page { max-width: 800px; margin: 0 auto; padding: 40px 32px; }
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #0d0f14; }
      .header-left { display: flex; align-items: center; gap: 14px; }
      .logo { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; }
      .app-name { font-size: 22px; font-weight: 800; color: #0d0f14; letter-spacing: -0.5px; }
      .header-right { text-align: right; }
      .period-label { font-size: 18px; font-weight: 700; color: #0d0f14; }
      .print-date { font-size: 12px; color: #666; margin-top: 4px; }
      .section-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #666; margin: 24px 0 12px; }
      .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
      .stat-box { background: #f8f9fc; border-radius: 12px; padding: 16px; border-left: 4px solid var(--c); }
      .stat-box .label { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
      .stat-box .value { font-size: 18px; font-weight: 800; color: var(--c); }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { background: #0d0f14; color: #fff; padding: 10px 14px; text-align: left; font-size: 11px; letter-spacing: .5px; text-transform: uppercase; }
      td { padding: 10px 14px; border-bottom: 1px solid #eef0f8; }
      tr:last-child td { border-bottom: none; }
      tr:nth-child(even) td { background: #f8f9fc; }
      .income { color: #00a854; font-weight: 700; }
      .expense { color: #d4170c; font-weight: 700; }
      .teal { color: #00897b; font-weight: 700; }
      .orange { color: #e65100; font-weight: 700; }
      .cat-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
      .card { background: #f8f9fc; border-radius: 12px; padding: 16px; }
      .card-title { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 12px; }
      .cat-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
      .cat-row:last-child { border-bottom: none; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #aaa; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { padding: 20px; }
      }
    `;

    // Build stats section
    const statsHTML = `
      <div class="stats-row">
        <div class="stat-box" style="--c:#00a854">
          <div class="label">Pemasukan</div>
          <div class="value">${Utils.formatCurrency(summary.income, settings)}</div>
        </div>
        <div class="stat-box" style="--c:#d4170c">
          <div class="label">Pengeluaran</div>
          <div class="value">${Utils.formatCurrency(summary.expense, settings)}</div>
        </div>
        <div class="stat-box" style="--c:#0288d1">
          <div class="label">Selisih Bersih</div>
          <div class="value">${Utils.formatCurrency(summary.net, settings)}</div>
        </div>
        <div class="stat-box" style="--c:#00897b">
          <div class="label">Saving Rate</div>
          <div class="value">${savingRate}%</div>
        </div>
      </div>
    `;

    // Build category tables
    const catHTML = `
      <div class="two-col">
        <div class="card">
          <div class="card-title">Pengeluaran per Kategori</div>
          ${expCats.length ? expCats.map(c => `
            <div class="cat-row">
              <span><span class="cat-dot" style="background:${c.color}"></span>${c.name}</span>
              <span style="font-weight:700;color:#d4170c">${Utils.formatCurrency(c.total, settings)}</span>
            </div>
          `).join('') : '<p style="color:#aaa;font-size:13px">Tidak ada data</p>'}
        </div>
        <div class="card">
          <div class="card-title">Pemasukan per Kategori</div>
          ${incCats.length ? incCats.map(c => `
            <div class="cat-row">
              <span><span class="cat-dot" style="background:${c.color}"></span>${c.name}</span>
              <span style="font-weight:700;color:#00a854">${Utils.formatCurrency(c.total, settings)}</span>
            </div>
          `).join('') : '<p style="color:#aaa;font-size:13px">Tidak ada data</p>'}
        </div>
      </div>
    `;

    // Build transaction table (monthly/category tab)
    const txnTableHTML = activeTab !== 'yearly' ? `
      <div class="section-title">Daftar Transaksi</div>
      <table>
        <thead><tr><th>Tanggal</th><th>Kategori</th><th>Dompet</th><th>Catatan</th><th style="text-align:right">Jumlah</th></tr></thead>
        <tbody>
          ${txns.filter(t => !t.isTransfer).map(t => {
            const cat    = Utils.getCategoryById(t.categoryId);
            const wallet = Utils.getWalletById(t.walletId);
            return `
              <tr>
                <td>${Utils.formatDate(t.date)}</td>
                <td><span class="cat-dot" style="background:${cat.color}"></span>${cat.name}</td>
                <td>${wallet.name}</td>
                <td style="color:#666">${t.note || '-'}</td>
                <td style="text-align:right" class="${t.type==='income'?'income':'expense'}">
                  ${t.type==='income'?'+':'-'}${Utils.formatCurrency(t.amount, settings)}
                </td>
              </tr>
            `;
          }).join('') || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px">Tidak ada transaksi</td></tr>'}
        </tbody>
      </table>
    ` : '';

    // Build yearly table
    const yearlyHTML = activeTab === 'yearly' ? `
      <div class="section-title">Rekap Per Bulan ${year}</div>
      <div class="stats-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="stat-box" style="--c:#00a854">
          <div class="label">Total Pemasukan ${year}</div>
          <div class="value">${Utils.formatCurrency(totalIncome, settings)}</div>
        </div>
        <div class="stat-box" style="--c:#d4170c">
          <div class="label">Total Pengeluaran ${year}</div>
          <div class="value">${Utils.formatCurrency(totalExpense, settings)}</div>
        </div>
        <div class="stat-box" style="--c:#0288d1">
          <div class="label">Selisih ${year}</div>
          <div class="value">${Utils.formatCurrency(totalIncome-totalExpense, settings)}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Selisih</th><th>Transaksi</th></tr></thead>
        <tbody>
          ${trend.map(t => `
            <tr>
              <td style="font-weight:600">${Utils.getMonthName(t.month)}</td>
              <td class="income">+${Utils.formatCurrency(t.income, settings)}</td>
              <td class="expense">-${Utils.formatCurrency(t.expense, settings)}</td>
              <td class="${t.net>=0?'teal':'orange'}">${Utils.formatCurrency(t.net, settings)}</td>
              <td style="color:#666">${t.count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

    const tabLabel = activeTab === 'monthly' ? 'Bulanan' : activeTab === 'category' ? 'Per Kategori' : 'Tahunan';

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Laporan ${tabLabel} - ${periodLabel} - ${appName}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="header-left">
              <img src="https://d.top4top.io/p_3721v7lxr0.png" class="logo" alt="${appName}">
              <div>
                <div class="app-name">${appName}</div>
                <div style="font-size:12px;color:#666">Laporan Keuangan</div>
              </div>
            </div>
            <div class="header-right">
              <div class="period-label">Laporan ${tabLabel}</div>
              <div class="period-label" style="font-size:14px;color:#444">${periodLabel}</div>
              <div class="print-date">Dicetak: ${Utils.formatDate(new Date().toISOString(), 'long')}</div>
            </div>
          </div>

          ${activeTab !== 'yearly' ? statsHTML : ''}
          ${activeTab !== 'yearly' ? catHTML : ''}
          ${txnTableHTML}
          ${yearlyHTML}

          <div class="footer">
            Laporan ini dibuat otomatis oleh ${appName} &bull; ${new Date().toISOString().slice(0,10)}
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(() => { window.print(); }, 400);
          };
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  return { render, setYear, setMonth, setTab, printPDF };
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

    // Transfer history (transaksi dengan isTransfer=true, hanya tampilkan sisi "expense"/keluar)
    const transfers = DB.getTransactions()
      .filter(t => t.isTransfer && t.type === 'expense')
      .slice(0, 10);

    container.innerHTML = `
      <div class="page-header">
        <h1>Dompet</h1>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="WalletPage.openTransferModal()">
            <i class="fa-solid fa-arrow-right-arrow-left" style="color:var(--teal)"></i> Transfer
          </button>
          <button class="btn btn-primary btn-sm" onclick="WalletPage.openModal()">
            <i class="fa-solid fa-plus"></i> Tambah
          </button>
        </div>
      </div>

      <!-- Total saldo semua dompet -->
      <div class="card mb-20" style="background:linear-gradient(135deg,rgba(0,229,255,.12),rgba(41,121,255,.08));border-color:rgba(0,229,255,.2)">
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:12px;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Total Semua Saldo</div>
          <div style="font-family:var(--font-display);font-size:28px;font-weight:800;color:var(--cyan)">
            ${Utils.formatCurrency(wallets.reduce((s,w) => s + (w.balance||0), 0), settings)}
          </div>
        </div>
      </div>

      <div class="wallet-grid mb-24" id="wallet-cards">
        ${wallets.map((w,i) => {
          const grad = WALLET_GRADIENTS[i % WALLET_GRADIENTS.length];
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

      <!-- Riwayat Transfer -->
      <div class="card mb-20">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-arrow-right-arrow-left" style="color:var(--teal)"></i> Riwayat Transfer</span>
          <button class="btn btn-primary btn-sm" onclick="WalletPage.openTransferModal()">
            <i class="fa-solid fa-plus"></i> Transfer
          </button>
        </div>
        <div id="transfer-history">
          ${transfers.length ? transfers.map(t => {
            const fromW = Utils.getWalletById(t.walletId);
            const toW   = Utils.getWalletById(t.transferTo);
            return `
              <div class="txn-item">
                <div class="txn-icon" style="background:rgba(29,233,182,.15);color:var(--teal)">
                  <i class="fa-solid fa-arrow-right-arrow-left"></i>
                </div>
                <div class="txn-info">
                  <div class="txn-name">${fromW.name} <i class="fa-solid fa-arrow-right" style="font-size:10px;color:var(--text-muted)"></i> ${toW.name}</div>
                  <div class="txn-meta">${Utils.relativeDateStr(t.date)}${t.note ? ' · ' + Utils.truncate(t.note.replace('Transfer ke '+toW.name,'').replace('Transfer dari '+fromW.name,'').trim(), 20) : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="txn-amount" style="color:var(--teal);font-family:var(--font-display);font-size:15px;font-weight:700">
                    ${Utils.formatCurrency(t.amount, settings)}
                  </div>
                  <button class="btn-icon" style="width:28px;height:28px;font-size:12px" onclick="WalletPage.deleteTransfer('${t.transferId}')">
                    <i class="fa-solid fa-trash" style="color:var(--red)"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('') : `
            <div class="empty-state" style="padding:30px 20px">
              <i class="fa-solid fa-arrow-right-arrow-left"></i>
              <p>Belum ada riwayat transfer</p>
            </div>
          `}
        </div>
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

      <!-- Transfer Modal -->
      <div class="modal-overlay" id="transfer-modal" onclick="if(event.target===this)WalletPage.closeTransferModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title"><i class="fa-solid fa-arrow-right-arrow-left" style="color:var(--teal)"></i> Transfer Antar Dompet</div>
            <button class="btn-icon" onclick="WalletPage.closeTransferModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">

            <!-- From - To visual -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
              <div style="flex:1">
                <div class="form-label">Dari</div>
                <select id="tf-from" class="form-control" onchange="WalletPage.onTransferWalletChange()">
                  ${wallets.map(w => `<option value="${w.id}">${w.name} (${Utils.formatCurrency(w.balance||0,settings)})</option>`).join('')}
                </select>
              </div>
              <div style="margin-top:20px;color:var(--teal);font-size:20px">
                <i class="fa-solid fa-arrow-right"></i>
              </div>
              <div style="flex:1">
                <div class="form-label">Ke</div>
                <select id="tf-to" class="form-control" onchange="WalletPage.onTransferWalletChange()">
                  ${wallets.map((w,i) => `<option value="${w.id}" ${i===1?'selected':''}>${w.name} (${Utils.formatCurrency(w.balance||0,settings)})</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Saldo warning -->
            <div id="tf-warning" style="display:none;background:rgba(255,215,64,.1);border:1px solid rgba(255,215,64,.3);border-radius:var(--radius-md);padding:10px 14px;font-size:13px;color:var(--yellow);margin-bottom:16px">
              <i class="fa-solid fa-triangle-exclamation"></i> <span id="tf-warning-text"></span>
            </div>

            <div class="form-group">
              <label class="form-label">Jumlah Transfer</label>
              <div style="position:relative">
                <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-weight:600;font-size:14px">${settings.currency === 'IDR' ? 'Rp' : settings.currency}</span>
                <input type="text" inputmode="numeric" id="tf-amount" class="form-control"
                  placeholder="0"
                  style="padding-left:48px;font-size:20px;font-family:var(--font-display);font-weight:700"
                  oninput="WalletPage.onTransferAmountInput(this)"
                  onkeydown="return TransactionPage.onAmountKeydown(event)">
              </div>
              <div id="tf-amount-hint" class="form-hint" style="display:none;color:var(--teal)"></div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tanggal</label>
                <input type="date" id="tf-date" class="form-control" value="${Utils.todayStr()}">
              </div>
              <div class="form-group">
                <label class="form-label">Catatan <span class="text-muted">(opsional)</span></label>
                <input type="text" id="tf-note" class="form-control" placeholder="Keterangan...">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="WalletPage.closeTransferModal()">Batal</button>
            <button class="btn btn-primary" onclick="WalletPage.doTransfer()" style="background:linear-gradient(135deg,var(--teal),var(--cyan))">
              <i class="fa-solid fa-arrow-right-arrow-left"></i> Transfer Sekarang
            </button>
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

  function openTransferModal() {
    const wallets = DB.getWallets();
    if (wallets.length < 2) { Utils.toast('Minimal 2 dompet untuk melakukan transfer', 'warning'); return; }
    document.getElementById('tf-amount').value = '';
    document.getElementById('tf-note').value   = '';
    document.getElementById('tf-date').value   = Utils.todayStr();
    document.getElementById('tf-amount-hint').style.display = 'none';
    document.getElementById('tf-warning').style.display     = 'none';
    Utils.openModal('transfer-modal');
  }
  function closeTransferModal() { Utils.closeModal('transfer-modal'); }

  function onTransferAmountInput(input) {
    let raw = input.value.replace(/[^0-9]/g, '');
    if (!raw) { input.value = ''; document.getElementById('tf-amount-hint').style.display = 'none'; return; }
    raw = String(parseInt(raw, 10));
    input.value = Number(raw).toLocaleString('id-ID');
    const hint = document.getElementById('tf-amount-hint');
    hint.style.display = 'block';
    hint.textContent   = Utils.formatCurrency(parseInt(raw), DB.getSettings());
    onTransferWalletChange();
  }

  function onTransferWalletChange() {
    const fromId  = document.getElementById('tf-from')?.value;
    const toId    = document.getElementById('tf-to')?.value;
    const warning = document.getElementById('tf-warning');
    const warnTxt = document.getElementById('tf-warning-text');
    if (!warning) return;

    if (fromId === toId) {
      warning.style.display = 'block';
      warnTxt.textContent   = 'Dompet asal dan tujuan tidak boleh sama';
      return;
    }
    const amountRaw = parseInt((document.getElementById('tf-amount')?.value || '0').replace(/[^0-9]/g,''), 10) || 0;
    const fromW = DB.getWallets().find(w => w.id === fromId);
    if (fromW && amountRaw > 0 && (fromW.balance || 0) < amountRaw) {
      warning.style.display = 'block';
      warnTxt.textContent   = `Saldo ${fromW.name} tidak cukup (${Utils.formatCurrency(fromW.balance||0, DB.getSettings())})`;
    } else {
      warning.style.display = 'none';
    }
  }

  function doTransfer() {
    const fromId = document.getElementById('tf-from').value;
    const toId   = document.getElementById('tf-to').value;
    const amount = parseInt((document.getElementById('tf-amount').value || '0').replace(/[^0-9]/g,''), 10) || 0;
    const date   = document.getElementById('tf-date').value;
    const note   = document.getElementById('tf-note').value.trim();

    if (fromId === toId) { Utils.toast('Dompet asal dan tujuan tidak boleh sama', 'error'); return; }
    if (!amount || amount <= 0) { Utils.toast('Jumlah transfer harus lebih dari 0', 'error'); return; }
    if (!date) { Utils.toast('Pilih tanggal transfer', 'error'); return; }

    const fromW = DB.getWallets().find(w => w.id === fromId);
    if (fromW && (fromW.balance || 0) < amount) {
      Utils.confirm(
        'Saldo Tidak Cukup',
        `Saldo ${fromW.name} kurang dari jumlah transfer. Tetap lanjutkan?`,
        () => _execTransfer(fromId, toId, amount, date, note),
        'warning'
      );
      return;
    }
    _execTransfer(fromId, toId, amount, date, note);
  }

  function _execTransfer(fromId, toId, amount, date, note) {
    DB.addTransfer({ fromWalletId: fromId, toWalletId: toId, amount, date, note });
    const fromW = Utils.getWalletById(fromId);
    const toW   = Utils.getWalletById(toId);
    Utils.toast(`Transfer ${Utils.formatCurrency(amount, DB.getSettings())} dari ${fromW.name} ke ${toW.name} berhasil`, 'success');
    closeTransferModal();
    App.updateTopbarWallet();
    App.markDirty(['dashboard', 'history', 'report']);
    render();
  }

  function deleteTransfer(transferId) {
    Utils.confirm('Hapus Transfer', 'Transfer ini akan dibatalkan dan saldo akan dikembalikan.', () => {
      DB.deleteTransfer(transferId);
      Utils.toast('Transfer dihapus', 'success');
      App.updateTopbarWallet();
      App.markDirty(['dashboard', 'history', 'report']);
      render();
    });
  }

  return { render, openModal, closeModal, saveWallet, selectIcon, setActive, deleteWallet, openTransferModal, closeTransferModal, onTransferAmountInput, onTransferWalletChange, doTransfer, deleteTransfer };
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
// NOTES PAGE — Catatan Keuangan
// ============================================================
const NotesPage = (() => {
  let editingId   = null;
  let searchQuery = '';
  let filterColor = 'all';
  let filterPin   = false;

  function render() {
    const container = document.getElementById('page-notes');
    container.innerHTML = `
      <div class="page-header">
        <h1>Catatan</h1>
        <button class="btn btn-primary btn-sm" onclick="NotesPage.openModal()">
          <i class="fa-solid fa-plus"></i> Catatan Baru
        </button>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar mb-16">
        <div class="search-box" style="flex:1">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" placeholder="Cari catatan..." id="notes-search"
            oninput="NotesPage.onSearch(this.value)" value="${searchQuery}">
        </div>
        <button class="btn ${filterPin ? 'btn-primary' : 'btn-ghost'} btn-sm"
          onclick="NotesPage.togglePinFilter()" title="Tampilkan yang di-pin">
          <i class="fa-solid fa-thumbtack"></i>
        </button>
      </div>

      <!-- Color filter chips -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">
        <div class="note-color-chip ${filterColor==='all'?'active':''}"
          style="--chip-color:var(--text-muted)" onclick="NotesPage.setColorFilter('all')">
          Semua
        </div>
        ${DB.NOTE_COLORS.map(c => `
          <div class="note-color-chip ${filterColor===c?'active':''}"
            style="--chip-color:${c};background:${filterColor===c?c+'33':'transparent'};border-color:${c}"
            onclick="NotesPage.setColorFilter('${c}')">
          </div>
        `).join('')}
      </div>

      <!-- Notes grid -->
      <div id="notes-grid"></div>

      <!-- Modal -->
      <div class="modal-overlay" id="notes-modal" onclick="if(event.target===this)NotesPage.closeModal()">
        <div class="modal" style="max-width:520px">
          <div class="modal-header">
            <div class="modal-title" id="notes-modal-title">Catatan Baru</div>
            <button class="btn-icon" onclick="NotesPage.closeModal()">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Judul</label>
              <input type="text" id="note-title" class="form-control" placeholder="Judul catatan...">
            </div>
            <div class="form-group">
              <label class="form-label">Isi Catatan</label>
              <textarea id="note-body" class="form-control"
                placeholder="Tulis catatan kamu di sini..."
                style="min-height:140px;resize:vertical;line-height:1.6"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Tag <span class="text-muted">(opsional, pisahkan dengan koma)</span></label>
              <input type="text" id="note-tags" class="form-control" placeholder="keuangan, rencana, target...">
            </div>
            <div class="form-group">
              <label class="form-label">Warna Catatan</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
                ${DB.NOTE_COLORS.map(c => `
                  <div class="color-swatch" style="background:${c}" data-color="${c}"
                    onclick="NotesPage.selectColor(this,'${c}')"></div>
                `).join('')}
              </div>
              <input type="hidden" id="note-color" value="${DB.NOTE_COLORS[0]}">
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px">
                <input type="checkbox" id="note-pin" style="width:16px;height:16px;accent-color:var(--yellow)">
                <span><i class="fa-solid fa-thumbtack" style="color:var(--yellow)"></i> Pin catatan ini</span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="NotesPage.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="NotesPage.saveNote()">
              <i class="fa-solid fa-check"></i> Simpan
            </button>
          </div>
        </div>
      </div>

      <!-- View modal -->
      <div class="modal-overlay" id="notes-view-modal" onclick="if(event.target===this)Utils.closeModal('notes-view-modal')">
        <div class="modal" style="max-width:520px" id="notes-view-content"></div>
      </div>
    `;

    _renderGrid();
  }

  function _renderGrid() {
    let notes = DB.getNotes();

    // Filter
    if (filterPin)              notes = notes.filter(n => n.pinned);
    if (filterColor !== 'all')  notes = notes.filter(n => n.color === filterColor);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      notes = notes.filter(n =>
        (n.title||'').toLowerCase().includes(q) ||
        (n.body||'').toLowerCase().includes(q)  ||
        (n.tags||[]).some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort: pinned first, then by updatedAt
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    const grid = document.getElementById('notes-grid');
    if (!notes.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-note-sticky"></i>
          <h3>Belum ada catatan</h3>
          <p>Simpan ide, rencana, atau memo keuangan kamu di sini</p>
        </div>`;
      return;
    }

    grid.innerHTML = `<div class="notes-masonry">${notes.map(n => _noteCard(n)).join('')}</div>`;
  }

  function _noteCard(n) {
    const preview = (n.body || '').slice(0, 120) + ((n.body||'').length > 120 ? '...' : '');
    const tags    = (n.tags || []).slice(0, 3);
    const date    = Utils.relativeDateStr(new Date(n.updatedAt).toISOString().slice(0,10));

    return `
      <div class="note-card" style="--note-color:${n.color||'var(--cyan)'}"
        onclick="NotesPage.viewNote('${n.id}')">
        <div class="note-card-top">
          ${n.pinned ? '<i class="fa-solid fa-thumbtack note-pin-icon"></i>' : ''}
          <div class="note-card-actions">
            <button class="btn-icon" style="width:26px;height:26px;font-size:11px"
              onclick="event.stopPropagation();NotesPage.openModal('${n.id}')">
              <i class="fa-solid fa-pen" style="color:var(--cyan)"></i>
            </button>
            <button class="btn-icon" style="width:26px;height:26px;font-size:11px"
              onclick="event.stopPropagation();NotesPage.togglePin('${n.id}',${!n.pinned})">
              <i class="fa-solid fa-thumbtack" style="color:${n.pinned?'var(--yellow)':'var(--text-muted)'}"></i>
            </button>
            <button class="btn-icon" style="width:26px;height:26px;font-size:11px"
              onclick="event.stopPropagation();NotesPage.deleteNote('${n.id}')">
              <i class="fa-solid fa-trash" style="color:var(--red)"></i>
            </button>
          </div>
        </div>
        ${n.title ? `<div class="note-card-title">${n.title}</div>` : ''}
        ${preview  ? `<div class="note-card-body">${preview.replace(/\n/g,'<br>')}</div>` : ''}
        <div class="note-card-footer">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${tags.map(t=>`<span class="note-tag">${t}</span>`).join('')}
          </div>
          <span class="note-date">${date}</span>
        </div>
      </div>
    `;
  }

  // ---- View note ----
  function viewNote(id) {
    const n = DB.getNotes().find(x => x.id === id);
    if (!n) return;
    const el = document.getElementById('notes-view-content');
    el.innerHTML = `
      <div class="modal-header" style="border-bottom:3px solid ${n.color||'var(--cyan)'}">
        <div>
          <div class="modal-title">${n.title || 'Catatan'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
            ${Utils.formatDate(new Date(n.updatedAt).toISOString())}
            ${n.pinned ? ' · <i class="fa-solid fa-thumbtack" style="color:var(--yellow)"></i> Di-pin' : ''}
          </div>
        </div>
        <button class="btn-icon" onclick="Utils.closeModal('notes-view-modal')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-body">
        <div style="white-space:pre-wrap;line-height:1.8;font-size:14px;color:var(--text-primary)">
          ${(n.body || '').replace(/</g,'&lt;')}
        </div>
        ${n.tags && n.tags.length ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:16px">
            ${n.tags.map(t=>`<span class="note-tag">${t}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="Utils.closeModal('notes-view-modal')">Tutup</button>
        <button class="btn btn-primary" onclick="Utils.closeModal('notes-view-modal');NotesPage.openModal('${n.id}')">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
      </div>
    `;
    Utils.openModal('notes-view-modal');
  }

  // ---- Modal ----
  function openModal(id) {
    editingId = id || null;
    document.getElementById('notes-modal-title').textContent = id ? 'Edit Catatan' : 'Catatan Baru';

    if (id) {
      const n = DB.getNotes().find(x => x.id === id);
      if (n) {
        document.getElementById('note-title').value = n.title || '';
        document.getElementById('note-body').value  = n.body  || '';
        document.getElementById('note-tags').value  = (n.tags || []).join(', ');
        document.getElementById('note-color').value = n.color || DB.NOTE_COLORS[0];
        document.getElementById('note-pin').checked = n.pinned || false;
        const sw = document.querySelector(`#notes-modal .color-swatch[data-color="${n.color}"]`);
        if (sw) { document.querySelectorAll('#notes-modal .color-swatch').forEach(s => s.classList.remove('selected')); sw.classList.add('selected'); }
      }
    } else {
      document.getElementById('note-title').value = '';
      document.getElementById('note-body').value  = '';
      document.getElementById('note-tags').value  = '';
      document.getElementById('note-color').value = DB.NOTE_COLORS[0];
      document.getElementById('note-pin').checked = false;
      const first = document.querySelector('#notes-modal .color-swatch');
      if (first) { document.querySelectorAll('#notes-modal .color-swatch').forEach(s => s.classList.remove('selected')); first.classList.add('selected'); }
    }
    Utils.openModal('notes-modal');
  }

  function closeModal() { Utils.closeModal('notes-modal'); editingId = null; }

  function selectColor(el, color) {
    document.querySelectorAll('#notes-modal .color-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('note-color').value = color;
  }

  function saveNote() {
    const title  = document.getElementById('note-title').value.trim();
    const body   = document.getElementById('note-body').value.trim();
    const tagsRaw = document.getElementById('note-tags').value;
    const color  = document.getElementById('note-color').value;
    const pinned = document.getElementById('note-pin').checked;
    const tags   = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    if (!title && !body) { Utils.toast('Judul atau isi catatan harus diisi', 'error'); return; }

    if (editingId) {
      DB.updateNote(editingId, { title, body, tags, color, pinned });
      Utils.toast('Catatan diperbarui', 'success');
    } else {
      DB.addNote({ title, body, tags, color, pinned });
      Utils.toast('Catatan disimpan', 'success');
    }
    closeModal();
    _renderGrid();
  }

  function deleteNote(id) {
    Utils.confirm('Hapus Catatan', 'Catatan ini akan dihapus permanen.', () => {
      DB.deleteNote(id);
      Utils.toast('Catatan dihapus', 'success');
      _renderGrid();
    });
  }

  function togglePin(id, pinned) {
    DB.pinNote(id, pinned);
    Utils.toast(pinned ? 'Catatan di-pin' : 'Pin dilepas', 'success');
    _renderGrid();
  }

  function onSearch(v)          { searchQuery = v; _renderGrid(); }
  function setColorFilter(c)    { filterColor = c; _renderGrid(); }
  function togglePinFilter()    { filterPin = !filterPin; render(); }

  return { render, openModal, closeModal, selectColor, saveNote, deleteNote, togglePin, viewNote, onSearch, setColorFilter, togglePinFilter };
})();

// ============================================================
// GOALS PAGE — Target Tabungan
// ============================================================
const GoalsPage = (() => {
  let editingId = null;

  const GOAL_ICONS  = ['fa-house','fa-car','fa-plane','fa-laptop','fa-mobile','fa-graduation-cap','fa-ring','fa-baby','fa-piggy-bank','fa-chart-line','fa-bicycle','fa-camera','fa-gamepad','fa-heart','fa-briefcase','fa-umbrella'];
  const GOAL_COLORS = ['#00e5ff','#00e676','#ffd740','#ff6d00','#f50057','#d500f9','#2979ff','#1de9b6','#ff1744','#c6ff00'];

  function render() {
    const container = document.getElementById('page-goals');
    const goals     = DB.getGoals();
    const settings  = DB.getSettings();
    const wallets   = DB.getWallets();

    const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
    const totalSaved  = goals.reduce((s, g) => s + (g.savedAmount  || 0), 0);
    const completed   = goals.filter(g => (g.savedAmount || 0) >= g.targetAmount).length;

    container.innerHTML = `
      <div class="page-header">
        <h1>Target Tabungan</h1>
        <button class="btn btn-primary btn-sm" onclick="GoalsPage.openModal()">
          <i class="fa-solid fa-plus"></i> Target Baru
        </button>
      </div>

      ${goals.length ? `
      <!-- Summary bar -->
      <div class="card mb-20" style="background:linear-gradient(135deg,rgba(0,230,118,.1),rgba(29,233,182,.06));border-color:rgba(0,230,118,.2)">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center">
          <div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Total Target</div>
            <div style="font-family:var(--font-display);font-size:17px;font-weight:800;color:var(--cyan)">${Utils.formatCurrency(totalTarget, settings)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Terkumpul</div>
            <div style="font-family:var(--font-display);font-size:17px;font-weight:800;color:var(--green)">${Utils.formatCurrency(totalSaved, settings)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Tercapai</div>
            <div style="font-family:var(--font-display);font-size:17px;font-weight:800;color:var(--yellow)">${completed} / ${goals.length}</div>
          </div>
        </div>
      </div>` : ''}

      <!-- Goals list -->
      <div id="goals-list">
        ${goals.length ? _renderGoalCards(goals, settings, wallets) : `
          <div class="empty-state">
            <i class="fa-solid fa-piggy-bank"></i>
            <h3>Belum ada target tabungan</h3>
            <p>Buat target untuk rumah, kendaraan, liburan, atau apapun yang kamu impikan</p>
          </div>
        `}
      </div>

      <!-- Goal Form Modal -->
      <div class="modal-overlay" id="goal-modal" onclick="if(event.target===this)GoalsPage.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="goal-modal-title">Target Baru</div>
            <button class="btn-icon" onclick="GoalsPage.closeModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nama Target</label>
              <input type="text" id="goal-name" class="form-control" placeholder="Contoh: Dana Darurat, DP Rumah...">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Target Jumlah</label>
                <div style="position:relative">
                  <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:600">Rp</span>
                  <input type="text" inputmode="numeric" id="goal-target" class="form-control"
                    placeholder="0" style="padding-left:38px;font-family:var(--font-display);font-weight:700"
                    oninput="GoalsPage.onAmountInput(this,'goal-target-hint')"
                    onkeydown="return TransactionPage.onAmountKeydown(event)">
                </div>
                <div id="goal-target-hint" class="form-hint" style="display:none;color:var(--teal)"></div>
              </div>
              <div class="form-group">
                <label class="form-label">Deadline <span class="text-muted">(opsional)</span></label>
                <input type="date" id="goal-deadline" class="form-control">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Deskripsi <span class="text-muted">(opsional)</span></label>
              <input type="text" id="goal-desc" class="form-control" placeholder="Keterangan tambahan...">
            </div>
            <div class="form-group">
              <label class="form-label">Warna</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
                ${GOAL_COLORS.map(c => `
                  <div class="color-swatch" style="background:${c}" data-color="${c}"
                    onclick="GoalsPage.selectColor(this,'${c}')"></div>
                `).join('')}
              </div>
              <input type="hidden" id="goal-color" value="${GOAL_COLORS[0]}">
            </div>
            <div class="form-group">
              <label class="form-label">Icon</label>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${GOAL_ICONS.map(icon => `
                  <div class="icon-option" data-icon="${icon}" onclick="GoalsPage.selectIcon(this,'${icon}')">
                    <i class="fa-solid ${icon}"></i>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="goal-icon" value="fa-piggy-bank">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="GoalsPage.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="GoalsPage.saveGoal()">
              <i class="fa-solid fa-check"></i> Simpan
            </button>
          </div>
        </div>
      </div>

      <!-- Saving Modal (tambah/tarik tabungan) -->
      <div class="modal-overlay" id="goal-saving-modal" onclick="if(event.target===this)Utils.closeModal('goal-saving-modal')">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="goal-saving-title">Tambah Tabungan</div>
            <button class="btn-icon" onclick="Utils.closeModal('goal-saving-modal')"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div id="goal-saving-info" style="margin-bottom:16px"></div>
            <div class="tab-nav mb-16">
              <div class="tab-btn active" id="saving-tab-add" onclick="GoalsPage.setSavingTab('add')">
                <i class="fa-solid fa-plus" style="color:var(--green)"></i> Tambah
              </div>
              <div class="tab-btn" id="saving-tab-withdraw" onclick="GoalsPage.setSavingTab('withdraw')">
                <i class="fa-solid fa-minus" style="color:var(--red)"></i> Tarik
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Jumlah</label>
              <div style="position:relative">
                <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:600">Rp</span>
                <input type="text" inputmode="numeric" id="saving-amount" class="form-control"
                  placeholder="0" style="padding-left:38px;font-size:20px;font-family:var(--font-display);font-weight:700"
                  oninput="GoalsPage.onAmountInput(this,'saving-amount-hint')"
                  onkeydown="return TransactionPage.onAmountKeydown(event)">
              </div>
              <div id="saving-amount-hint" class="form-hint" style="display:none;color:var(--teal)"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Dari Dompet</label>
              <select id="saving-wallet" class="form-control">
                ${wallets.map(w => `
                  <option value="${w.id}" ${w.id === DB.getActiveWallet().id ? 'selected' : ''}>
                    ${w.name} (${Utils.formatCurrency(w.balance || 0, settings)})
                  </option>
                `).join('')}
              </select>
            </div>
            <input type="hidden" id="saving-goal-id">
            <input type="hidden" id="saving-tab-active" value="add">
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="Utils.closeModal('goal-saving-modal')">Batal</button>
            <button class="btn btn-success" id="saving-submit-btn" onclick="GoalsPage.submitSaving()">
              <i class="fa-solid fa-piggy-bank"></i> Simpan
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function _renderGoalCards(goals, settings, wallets) {
    // Sort: active first, then completed
    const sorted = [...goals].sort((a, b) => {
      const aDone = (a.savedAmount || 0) >= a.targetAmount;
      const bDone = (b.savedAmount || 0) >= b.targetAmount;
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return sorted.map(g => {
      const saved    = g.savedAmount  || 0;
      const target   = g.targetAmount || 1;
      const pct      = Math.min(100, (saved / target) * 100);
      const isDone   = saved >= target;
      const remaining = Math.max(0, target - saved);
      const color    = g.color || GOAL_COLORS[0];

      // Hitung estimasi bulan jika ada deadline
      let deadlineInfo = '';
      if (g.deadline && !isDone) {
        const daysLeft = Math.ceil((new Date(g.deadline) - new Date()) / 86400000);
        const monthsLeft = Math.ceil(daysLeft / 30);
        const monthlyNeeded = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
        if (daysLeft < 0) {
          deadlineInfo = `<span style="color:var(--red);font-size:12px"><i class="fa-solid fa-triangle-exclamation"></i> Deadline terlewat ${Math.abs(daysLeft)} hari lalu</span>`;
        } else {
          deadlineInfo = `<span style="color:var(--text-muted);font-size:12px"><i class="fa-solid fa-calendar"></i> ${daysLeft} hari lagi · Perlu ${Utils.formatCurrency(monthlyNeeded, settings)}/bulan</span>`;
        }
      }

      return `
        <div class="goal-card ${isDone ? 'goal-done' : ''}" style="--goal-color:${color}">
          ${isDone ? '<div class="goal-done-badge"><i class="fa-solid fa-trophy"></i> Tercapai!</div>' : ''}

          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:12px">
              <div class="goal-icon-wrap">
                <i class="fa-solid ${g.icon || 'fa-piggy-bank'}"></i>
              </div>
              <div>
                <div style="font-family:var(--font-display);font-size:16px;font-weight:800">${g.name}</div>
                ${g.desc ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${g.desc}</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn-icon" onclick="GoalsPage.openModal('${g.id}')">
                <i class="fa-solid fa-pen" style="color:var(--cyan);font-size:12px"></i>
              </button>
              <button class="btn-icon" onclick="GoalsPage.deleteGoal('${g.id}')">
                <i class="fa-solid fa-trash" style="color:var(--red);font-size:12px"></i>
              </button>
            </div>
          </div>

          <!-- Amounts -->
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px">
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Terkumpul</div>
              <div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:${color}">
                ${Utils.formatCurrency(saved, settings)}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Target</div>
              <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text-secondary)">
                ${Utils.formatCurrency(target, settings)}
              </div>
            </div>
          </div>

          <!-- Progress -->
          <div class="progress-bar" style="height:12px;margin-bottom:8px">
            <div class="progress-fill" style="width:${pct}%;background:${isDone ? 'var(--green)' : color};transition:width .8s cubic-bezier(.4,0,.2,1)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:12px">
            <span>${pct.toFixed(1)}% tercapai</span>
            ${!isDone ? `<span>Sisa ${Utils.formatCurrency(remaining, settings)}</span>` : ''}
          </div>

          ${deadlineInfo ? `<div style="margin-bottom:12px">${deadlineInfo}</div>` : ''}

          <!-- Action buttons -->
          ${!isDone ? `
            <div style="display:flex;gap:8px">
              <button class="btn btn-success btn-sm" style="flex:1" onclick="GoalsPage.openSavingModal('${g.id}','add')">
                <i class="fa-solid fa-plus"></i> Tambah Tabungan
              </button>
              ${saved > 0 ? `
                <button class="btn btn-ghost btn-sm" onclick="GoalsPage.openSavingModal('${g.id}','withdraw')">
                  <i class="fa-solid fa-minus" style="color:var(--red)"></i>
                </button>
              ` : ''}
            </div>
          ` : `
            <div style="text-align:center;padding:8px;background:rgba(0,230,118,.1);border-radius:var(--radius-md)">
              <i class="fa-solid fa-trophy" style="color:var(--yellow)"></i>
              <span style="font-size:13px;font-weight:700;color:var(--green);margin-left:6px">Target berhasil dicapai!</span>
            </div>
          `}
        </div>
      `;
    }).join('');
  }

  // ---- Amount input helper ----
  function onAmountInput(input, hintId) {
    let raw = input.value.replace(/[^0-9]/g, '');
    if (!raw) { input.value = ''; document.getElementById(hintId).style.display = 'none'; return; }
    raw = String(parseInt(raw, 10));
    input.value = Number(raw).toLocaleString('id-ID');
    const hint = document.getElementById(hintId);
    if (hint) { hint.style.display = 'block'; hint.textContent = Utils.formatCurrency(parseInt(raw), DB.getSettings()); }
  }

  // ---- Color & Icon picker ----
  function selectColor(el, color) {
    document.querySelectorAll('#goal-modal .color-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('goal-color').value = color;
  }
  function selectIcon(el, icon) {
    document.querySelectorAll('#goal-modal .icon-option').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('goal-icon').value = icon;
  }

  // ---- Modal open/close ----
  function openModal(id) {
    editingId = id || null;
    document.getElementById('goal-modal-title').textContent = id ? 'Edit Target' : 'Target Baru';
    if (id) {
      const g = DB.getGoals().find(x => x.id === id);
      if (g) {
        document.getElementById('goal-name').value     = g.name || '';
        document.getElementById('goal-target').value   = Number(g.targetAmount||0).toLocaleString('id-ID');
        document.getElementById('goal-deadline').value = g.deadline || '';
        document.getElementById('goal-desc').value     = g.desc || '';
        document.getElementById('goal-color').value    = g.color || GOAL_COLORS[0];
        document.getElementById('goal-icon').value     = g.icon  || 'fa-piggy-bank';
        const sw = document.querySelector(`#goal-modal .color-swatch[data-color="${g.color}"]`);
        if (sw) { document.querySelectorAll('#goal-modal .color-swatch').forEach(s=>s.classList.remove('selected')); sw.classList.add('selected'); }
        const ic = document.querySelector(`#goal-modal .icon-option[data-icon="${g.icon}"]`);
        if (ic) { document.querySelectorAll('#goal-modal .icon-option').forEach(s=>s.classList.remove('selected')); ic.classList.add('selected'); }
      }
    } else {
      document.getElementById('goal-name').value     = '';
      document.getElementById('goal-target').value   = '';
      document.getElementById('goal-deadline').value = '';
      document.getElementById('goal-desc').value     = '';
      document.getElementById('goal-color').value    = GOAL_COLORS[0];
      document.getElementById('goal-icon').value     = 'fa-piggy-bank';
      document.getElementById('goal-target-hint').style.display = 'none';
      const first = document.querySelector('#goal-modal .color-swatch');
      if (first) { document.querySelectorAll('#goal-modal .color-swatch').forEach(s=>s.classList.remove('selected')); first.classList.add('selected'); }
    }
    Utils.openModal('goal-modal');
  }
  function closeModal() { Utils.closeModal('goal-modal'); editingId = null; }

  function saveGoal() {
    const name   = document.getElementById('goal-name').value.trim();
    const target = parseInt((document.getElementById('goal-target').value||'0').replace(/[^0-9]/g,''), 10) || 0;
    const deadline = document.getElementById('goal-deadline').value;
    const desc   = document.getElementById('goal-desc').value.trim();
    const color  = document.getElementById('goal-color').value;
    const icon   = document.getElementById('goal-icon').value;
    if (!name)   { Utils.toast('Nama target harus diisi', 'error'); return; }
    if (!target) { Utils.toast('Jumlah target harus lebih dari 0', 'error'); return; }
    if (editingId) {
      DB.updateGoal(editingId, { name, targetAmount: target, deadline, desc, color, icon });
      Utils.toast('Target diperbarui', 'success');
    } else {
      DB.addGoal({ name, targetAmount: target, deadline, desc, color, icon });
      Utils.toast('Target ditambahkan', 'success');
    }
    closeModal();
    App.markDirty(['dashboard']);
    render();
  }

  function deleteGoal(id) {
    Utils.confirm('Hapus Target', 'Target ini akan dihapus. Saldo yang sudah ditabung tidak akan dikembalikan otomatis.', () => {
      DB.deleteGoal(id);
      Utils.toast('Target dihapus', 'success');
      render();
    });
  }

  // ---- Saving modal ----
  function openSavingModal(goalId, tab) {
    const g = DB.getGoals().find(x => x.id === goalId);
    if (!g) return;
    const settings = DB.getSettings();
    const saved    = g.savedAmount || 0;
    const remaining = Math.max(0, g.targetAmount - saved);

    document.getElementById('saving-goal-id').value     = goalId;
    document.getElementById('saving-tab-active').value  = tab || 'add';
    document.getElementById('saving-amount').value      = '';
    document.getElementById('saving-amount-hint').style.display = 'none';
    document.getElementById('goal-saving-title').textContent = tab === 'withdraw' ? 'Tarik Tabungan' : 'Tambah Tabungan';

    document.getElementById('goal-saving-info').innerHTML = `
      <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:12px 14px;font-size:13px">
        <div style="font-weight:700;margin-bottom:6px;font-size:14px">${g.name}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">Terkumpul</span>
          <span style="color:var(--green);font-weight:600">${Utils.formatCurrency(saved, settings)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">Sisa target</span>
          <span style="color:var(--cyan);font-weight:600">${Utils.formatCurrency(remaining, settings)}</span>
        </div>
      </div>
    `;

    // Update tab UI
    setSavingTab(tab || 'add');
    Utils.openModal('goal-saving-modal');
  }

  function setSavingTab(tab) {
    document.getElementById('saving-tab-active').value = tab;
    document.getElementById('saving-tab-add').classList.toggle('active', tab === 'add');
    document.getElementById('saving-tab-withdraw').classList.toggle('active', tab === 'withdraw');
    const btn = document.getElementById('saving-submit-btn');
    if (btn) {
      btn.innerHTML = tab === 'withdraw'
        ? '<i class="fa-solid fa-minus"></i> Tarik Tabungan'
        : '<i class="fa-solid fa-piggy-bank"></i> Tambah Tabungan';
      btn.className = tab === 'withdraw' ? 'btn btn-danger' : 'btn btn-success';
    }
    document.getElementById('goal-saving-title').textContent = tab === 'withdraw' ? 'Tarik Tabungan' : 'Tambah Tabungan';
  }

  function submitSaving() {
    const goalId   = document.getElementById('saving-goal-id').value;
    const tab      = document.getElementById('saving-tab-active').value;
    const amount   = parseInt((document.getElementById('saving-amount').value||'0').replace(/[^0-9]/g,''), 10) || 0;
    const walletId = document.getElementById('saving-wallet').value;
    const settings = DB.getSettings();

    if (!amount) { Utils.toast('Jumlah harus lebih dari 0', 'error'); return; }

    const goal = DB.getGoals().find(g => g.id === goalId);
    if (!goal) return;

    if (tab === 'add') {
      const wallet = DB.getWallets().find(w => w.id === walletId);
      if (wallet && (wallet.balance || 0) < amount) {
        Utils.confirm('Saldo Tidak Cukup', `Saldo ${wallet.name} tidak cukup. Tetap lanjutkan?`, () => {
          DB.addSavingToGoal(goalId, amount, walletId);
          _afterSave(goal, amount, 'add', settings);
        }, 'warning');
        return;
      }
      DB.addSavingToGoal(goalId, amount, walletId);
      _afterSave(goal, amount, 'add', settings);
    } else {
      if (amount > (goal.savedAmount || 0)) {
        Utils.toast(`Jumlah melebihi tabungan yang ada (${Utils.formatCurrency(goal.savedAmount || 0, settings)})`, 'error');
        return;
      }
      DB.withdrawFromGoal(goalId, amount, walletId);
      _afterSave(goal, amount, 'withdraw', settings);
    }
  }

  function _afterSave(goal, amount, tab, settings) {
    Utils.closeModal('goal-saving-modal');
    App.updateTopbarWallet();
    App.markDirty(['dashboard','history','wallet']);

    const newSaved = DB.getGoals().find(g => g.id === goal.id)?.savedAmount || 0;
    const isDone   = newSaved >= goal.targetAmount;

    if (tab === 'add') {
      Utils.toast(
        isDone
          ? `🎉 Selamat! Target "${goal.name}" berhasil tercapai!`
          : `${Utils.formatCurrency(amount, settings)} berhasil ditabung ke "${goal.name}"`,
        isDone ? 'success' : 'success'
      );
    } else {
      Utils.toast(`${Utils.formatCurrency(amount, settings)} ditarik dari "${goal.name}"`, 'success');
    }
    render();
  }

  return { render, openModal, closeModal, saveGoal, deleteGoal, selectColor, selectIcon, openSavingModal, setSavingTab, submitSaving, onAmountInput };
})();

// ============================================================
// INSTALLMENT PAGE — Cicilan Tracker
// ============================================================
const InstallmentPage = (() => {
  let editingId  = null;
  let activeTab  = 'active';

  const INST_ICONS   = ['fa-house','fa-car','fa-mobile','fa-laptop','fa-motorcycle','fa-tv','fa-couch','fa-credit-card','fa-landmark','fa-graduation-cap','fa-briefcase','fa-tools'];
  const INST_COLORS  = ['#00e5ff','#ff6d00','#00e676','#f50057','#ffd740','#d500f9','#2979ff','#1de9b6','#ff1744'];

  function render() {
    const container    = document.getElementById('page-installment');
    const settings     = DB.getSettings();
    const installments = DB.getInstallments();
    const wallets      = DB.getWallets();

    const active    = installments.filter(i => i.active !== false && !(i.completedAt));
    const completed = installments.filter(i => i.completedAt);

    // Summary stats
    const totalDebt      = active.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalPaidAll   = active.reduce((s, i) => s + ((i.payments||[]).reduce((x,p)=>x+p.amount,0)), 0);
    const totalRemaining = Math.max(0, totalDebt - totalPaidAll);
    const monthlyBurden  = active.reduce((s, i) => s + (i.monthlyAmount || 0), 0);

    // Overdue count
    const overdueCount = active.filter(i => {
      const info = DB.getInstallmentInfo(i);
      return info.isOverdue;
    }).length;

    container.innerHTML = `
      <div class="page-header">
        <h1>Cicilan</h1>
        <button class="btn btn-primary btn-sm" onclick="InstallmentPage.openModal()">
          <i class="fa-solid fa-plus"></i> Tambah Cicilan
        </button>
      </div>

      ${installments.length ? `
      <!-- Summary -->
      <div class="card mb-20" style="background:linear-gradient(135deg,rgba(255,109,0,.1),rgba(245,0,87,.06));border-color:rgba(255,109,0,.25)">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:12px">
          <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-md);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px">Total Sisa Hutang</div>
            <div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--red)">${Utils.formatCurrency(totalRemaining, settings)}</div>
          </div>
          <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-md);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px">Beban/Bulan</div>
            <div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--orange)">${Utils.formatCurrency(monthlyBurden, settings)}</div>
          </div>
        </div>
        ${overdueCount ? `
          <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,23,68,.1);border:1px solid rgba(255,23,68,.3);border-radius:var(--radius-md);font-size:13px;color:var(--red)">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <strong>${overdueCount} cicilan</strong> sudah jatuh tempo! Segera bayar.
          </div>
        ` : ''}
      </div>` : ''}

      <!-- Tabs -->
      <div class="tab-nav mb-20">
        <div class="tab-btn ${activeTab==='active'?'active':''}" onclick="InstallmentPage.setTab('active')">
          Aktif <span style="background:var(--bg-elevated);padding:1px 7px;border-radius:99px;font-size:11px;margin-left:4px">${active.length}</span>
        </div>
        <div class="tab-btn ${activeTab==='completed'?'active':''}" onclick="InstallmentPage.setTab('completed')">
          Lunas <span style="background:var(--bg-elevated);padding:1px 7px;border-radius:99px;font-size:11px;margin-left:4px">${completed.length}</span>
        </div>
      </div>

      <!-- List -->
      <div id="inst-list"></div>

      <!-- Form Modal -->
      <div class="modal-overlay" id="inst-modal" onclick="if(event.target===this)InstallmentPage.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="inst-modal-title">Tambah Cicilan</div>
            <button class="btn-icon" onclick="InstallmentPage.closeModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nama Cicilan</label>
              <input type="text" id="inst-name" class="form-control" placeholder="Contoh: KPR Rumah, Kredit Motor...">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Total Hutang</label>
                <div style="position:relative">
                  <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:600">Rp</span>
                  <input type="text" inputmode="numeric" id="inst-total" class="form-control"
                    placeholder="0" style="padding-left:38px;font-family:var(--font-display);font-weight:700"
                    oninput="InstallmentPage.onAmountInput(this);InstallmentPage.calcMonthly()"
                    onkeydown="return TransactionPage.onAmountKeydown(event)">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Tenor (bulan)</label>
                <input type="number" id="inst-months" class="form-control" placeholder="12" min="1" max="360"
                  oninput="InstallmentPage.calcMonthly()">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Cicilan/Bulan</label>
              <div style="position:relative">
                <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:600">Rp</span>
                <input type="text" inputmode="numeric" id="inst-monthly" class="form-control"
                  placeholder="Otomatis terhitung"
                  style="padding-left:38px;font-family:var(--font-display);font-weight:700"
                  oninput="InstallmentPage.onAmountInput(this)"
                  onkeydown="return TransactionPage.onAmountKeydown(event)">
              </div>
              <div class="form-hint">Bisa diisi manual jika berbeda dari hasil otomatis</div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tanggal Mulai</label>
                <input type="date" id="inst-start" class="form-control" value="${Utils.todayStr()}">
              </div>
              <div class="form-group">
                <label class="form-label">Tanggal Jatuh Tempo</label>
                <input type="number" id="inst-due-day" class="form-control" placeholder="Tgl (1-31)" min="1" max="31">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Keterangan <span class="text-muted">(opsional)</span></label>
              <input type="text" id="inst-desc" class="form-control" placeholder="Bank, leasing, atau keterangan lain...">
            </div>
            <div class="form-group">
              <label class="form-label">Warna & Icon</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
                ${INST_COLORS.map(c => `
                  <div class="color-swatch" style="background:${c}" data-color="${c}"
                    onclick="InstallmentPage.selectColor(this,'${c}')"></div>
                `).join('')}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${INST_ICONS.map(icon => `
                  <div class="icon-option" data-icon="${icon}" onclick="InstallmentPage.selectIcon(this,'${icon}')">
                    <i class="fa-solid ${icon}"></i>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="inst-color" value="${INST_COLORS[0]}">
              <input type="hidden" id="inst-icon" value="fa-credit-card">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="InstallmentPage.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="InstallmentPage.saveInstallment()">
              <i class="fa-solid fa-check"></i> Simpan
            </button>
          </div>
        </div>
      </div>

      <!-- Pay Modal -->
      <div class="modal-overlay" id="inst-pay-modal" onclick="if(event.target===this)Utils.closeModal('inst-pay-modal')">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title"><i class="fa-solid fa-money-bill-wave" style="color:var(--green)"></i> Bayar Cicilan</div>
            <button class="btn-icon" onclick="Utils.closeModal('inst-pay-modal')"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div id="pay-inst-info" style="margin-bottom:16px"></div>
            <div class="form-group">
              <label class="form-label">Jumlah Bayar</label>
              <div style="position:relative">
                <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:600">Rp</span>
                <input type="text" inputmode="numeric" id="pay-amount" class="form-control"
                  placeholder="0" style="padding-left:38px;font-size:20px;font-family:var(--font-display);font-weight:700"
                  oninput="InstallmentPage.onAmountInput(this)"
                  onkeydown="return TransactionPage.onAmountKeydown(event)">
              </div>
              <div class="form-hint" id="pay-amount-hint"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Dari Dompet</label>
              <select id="pay-wallet" class="form-control">
                ${wallets.map(w => `
                  <option value="${w.id}" ${w.id===DB.getActiveWallet().id?'selected':''}>
                    ${w.name} (${Utils.formatCurrency(w.balance||0, settings)})
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Catatan <span class="text-muted">(opsional)</span></label>
              <input type="text" id="pay-note" class="form-control" placeholder="Keterangan pembayaran...">
            </div>
            <input type="hidden" id="pay-inst-id">
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="Utils.closeModal('inst-pay-modal')">Batal</button>
            <button class="btn btn-success" onclick="InstallmentPage.submitPayment()">
              <i class="fa-solid fa-check"></i> Bayar Sekarang
            </button>
          </div>
        </div>
      </div>

      <!-- History Modal -->
      <div class="modal-overlay" id="inst-history-modal" onclick="if(event.target===this)Utils.closeModal('inst-history-modal')">
        <div class="modal" style="max-width:500px">
          <div class="modal-header">
            <div class="modal-title" id="inst-history-title">Riwayat Pembayaran</div>
            <button class="btn-icon" onclick="Utils.closeModal('inst-history-modal')"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body" id="inst-history-content" style="max-height:60vh;overflow-y:auto"></div>
        </div>
      </div>
    `;

    _renderList();
  }

  function _renderList() {
    const installments = DB.getInstallments();
    const settings     = DB.getSettings();
    const el           = document.getElementById('inst-list');
    if (!el) return;

    const list = activeTab === 'active'
      ? installments.filter(i => !i.completedAt)
      : installments.filter(i =>  i.completedAt);

    if (!list.length) {
      el.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-credit-card"></i>
          <h3>${activeTab === 'active' ? 'Tidak ada cicilan aktif' : 'Belum ada cicilan yang lunas'}</h3>
          <p>${activeTab === 'active' ? 'Tambah cicilan untuk mulai tracking' : 'Cicilan yang sudah lunas akan muncul di sini'}</p>
        </div>`;
      return;
    }

    // Sort: overdue first, then by next payment date
    list.sort((a, b) => {
      const ia = DB.getInstallmentInfo(a);
      const ib = DB.getInstallmentInfo(b);
      if (ia.isOverdue && !ib.isOverdue) return -1;
      if (!ia.isOverdue && ib.isOverdue) return 1;
      return (ia.nextDate||'') > (ib.nextDate||'') ? 1 : -1;
    });

    el.innerHTML = list.map(inst => _instCard(inst, settings)).join('');
  }

  function _instCard(inst, settings) {
    const info     = DB.getInstallmentInfo(inst);
    const color    = inst.color || INST_COLORS[0];
    const isDone   = !!inst.completedAt;

    return `
      <div class="inst-card ${info.isOverdue ? 'inst-overdue' : ''} ${isDone ? 'inst-done' : ''}"
        style="--inst-color:${color}">

        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="inst-icon-wrap">
              <i class="fa-solid ${inst.icon || 'fa-credit-card'}"></i>
            </div>
            <div>
              <div style="font-family:var(--font-display);font-size:16px;font-weight:800">${inst.name}</div>
              ${inst.desc ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${inst.desc}</div>` : ''}
              ${info.isOverdue ? `
                <div style="font-size:11px;color:var(--red);margin-top:3px;font-weight:700">
                  <i class="fa-solid fa-triangle-exclamation"></i> Jatuh tempo terlewat!
                </div>` : info.nextDate && !isDone ? `
                <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
                  <i class="fa-solid fa-calendar"></i> Jatuh tempo: ${Utils.formatDate(info.nextDate)}
                </div>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn-icon" onclick="InstallmentPage.showHistory('${inst.id}')" title="Riwayat">
              <i class="fa-solid fa-clock-rotate-left" style="color:var(--yellow);font-size:12px"></i>
            </button>
            <button class="btn-icon" onclick="InstallmentPage.openModal('${inst.id}')">
              <i class="fa-solid fa-pen" style="color:var(--cyan);font-size:12px"></i>
            </button>
            <button class="btn-icon" onclick="InstallmentPage.deleteInstallment('${inst.id}')">
              <i class="fa-solid fa-trash" style="color:var(--red);font-size:12px"></i>
            </button>
          </div>
        </div>

        <!-- Amounts row -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
          <div style="text-align:center;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md)">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.4px">Cicilan/Bln</div>
            <div style="font-family:var(--font-display);font-size:13px;font-weight:700;color:${color}">${Utils.formatCurrency(inst.monthlyAmount||0, settings)}</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md)">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.4px">Sudah Bayar</div>
            <div style="font-family:var(--font-display);font-size:13px;font-weight:700;color:var(--green)">${Utils.formatCurrency(info.totalPaid||0, settings)}</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md)">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.4px">Sisa Hutang</div>
            <div style="font-family:var(--font-display);font-size:13px;font-weight:700;color:${isDone?'var(--green)':'var(--red)'}">
              ${isDone ? 'Lunas!' : Utils.formatCurrency(info.remaining||0, settings)}
            </div>
          </div>
        </div>

        <!-- Progress -->
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px">
          <span>${info.paidCount} dari ${inst.totalMonths} bulan</span>
          <span>${info.pct.toFixed(1)}%</span>
        </div>
        <div class="progress-bar" style="height:10px;margin-bottom:${isDone?'0':'14px'}">
          <div class="progress-fill" style="width:${info.pct}%;background:${isDone?'var(--green)':color};transition:width .8s cubic-bezier(.4,0,.2,1)"></div>
        </div>

        ${!isDone ? `
          <button class="btn btn-success" style="width:100%;justify-content:center" onclick="InstallmentPage.openPayModal('${inst.id}')">
            <i class="fa-solid fa-money-bill-wave"></i> Bayar Cicilan Sekarang
          </button>
        ` : `
          <div style="text-align:center;padding:8px;background:rgba(0,230,118,.1);border-radius:var(--radius-md)">
            <i class="fa-solid fa-circle-check" style="color:var(--green)"></i>
            <span style="font-size:13px;font-weight:700;color:var(--green);margin-left:6px">Cicilan Lunas!</span>
          </div>
        `}
      </div>
    `;
  }

  // ---- Amount input helper ----
  function onAmountInput(input) {
    let raw = input.value.replace(/[^0-9]/g, '');
    if (!raw) { input.value = ''; return; }
    raw = String(parseInt(raw, 10));
    input.value = Number(raw).toLocaleString('id-ID');
  }

  // ---- Auto calc monthly ----
  function calcMonthly() {
    const total  = parseInt((document.getElementById('inst-total')?.value||'0').replace(/[^0-9]/g,''), 10) || 0;
    const months = parseInt(document.getElementById('inst-months')?.value, 10) || 0;
    if (total && months) {
      const monthly = Math.ceil(total / months);
      document.getElementById('inst-monthly').value = monthly.toLocaleString('id-ID');
    }
  }

  // ---- Color & Icon ----
  function selectColor(el, color) {
    document.querySelectorAll('#inst-modal .color-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('inst-color').value = color;
  }
  function selectIcon(el, icon) {
    document.querySelectorAll('#inst-modal .icon-option').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('inst-icon').value = icon;
  }

  // ---- Tab ----
  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('#page-installment .tab-btn').forEach((b,i) => {
      b.classList.toggle('active', ['active','completed'][i] === tab);
    });
    _renderList();
  }

  // ---- Modal ----
  function openModal(id) {
    editingId = id || null;
    document.getElementById('inst-modal-title').textContent = id ? 'Edit Cicilan' : 'Tambah Cicilan';
    if (id) {
      const inst = DB.getInstallments().find(x => x.id === id);
      if (inst) {
        document.getElementById('inst-name').value    = inst.name || '';
        document.getElementById('inst-total').value   = Number(inst.totalAmount||0).toLocaleString('id-ID');
        document.getElementById('inst-months').value  = inst.totalMonths || '';
        document.getElementById('inst-monthly').value = Number(inst.monthlyAmount||0).toLocaleString('id-ID');
        document.getElementById('inst-start').value   = inst.startDate || Utils.todayStr();
        document.getElementById('inst-due-day').value = inst.dueDay || '';
        document.getElementById('inst-desc').value    = inst.desc || '';
        document.getElementById('inst-color').value   = inst.color || INST_COLORS[0];
        document.getElementById('inst-icon').value    = inst.icon  || 'fa-credit-card';
        const sw = document.querySelector(`#inst-modal .color-swatch[data-color="${inst.color}"]`);
        if (sw) { document.querySelectorAll('#inst-modal .color-swatch').forEach(s=>s.classList.remove('selected')); sw.classList.add('selected'); }
        const ic = document.querySelector(`#inst-modal .icon-option[data-icon="${inst.icon}"]`);
        if (ic) { document.querySelectorAll('#inst-modal .icon-option').forEach(s=>s.classList.remove('selected')); ic.classList.add('selected'); }
      }
    } else {
      ['inst-name','inst-total','inst-months','inst-monthly','inst-desc','inst-due-day'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      document.getElementById('inst-start').value  = Utils.todayStr();
      document.getElementById('inst-color').value  = INST_COLORS[0];
      document.getElementById('inst-icon').value   = 'fa-credit-card';
      const first = document.querySelector('#inst-modal .color-swatch');
      if (first) { document.querySelectorAll('#inst-modal .color-swatch').forEach(s=>s.classList.remove('selected')); first.classList.add('selected'); }
    }
    Utils.openModal('inst-modal');
  }
  function closeModal() { Utils.closeModal('inst-modal'); editingId = null; }

  function saveInstallment() {
    const name    = document.getElementById('inst-name').value.trim();
    const total   = parseInt((document.getElementById('inst-total').value||'0').replace(/[^0-9]/g,''), 10) || 0;
    const months  = parseInt(document.getElementById('inst-months').value, 10) || 0;
    const monthly = parseInt((document.getElementById('inst-monthly').value||'0').replace(/[^0-9]/g,''), 10) || 0;
    const start   = document.getElementById('inst-start').value;
    const dueDay  = parseInt(document.getElementById('inst-due-day').value, 10) || null;
    const desc    = document.getElementById('inst-desc').value.trim();
    const color   = document.getElementById('inst-color').value;
    const icon    = document.getElementById('inst-icon').value;

    if (!name)    { Utils.toast('Nama cicilan harus diisi', 'error'); return; }
    if (!total)   { Utils.toast('Total hutang harus diisi', 'error'); return; }
    if (!months)  { Utils.toast('Tenor (bulan) harus diisi', 'error'); return; }
    if (!monthly) { Utils.toast('Cicilan per bulan harus diisi', 'error'); return; }

    const data = { name, totalAmount: total, totalMonths: months, monthlyAmount: monthly, startDate: start, dueDay, desc, color, icon, active: true };

    if (editingId) {
      DB.updateInstallment(editingId, data);
      Utils.toast('Cicilan diperbarui', 'success');
    } else {
      DB.addInstallment(data);
      Utils.toast('Cicilan ditambahkan', 'success');
    }
    closeModal();
    render();
  }

  function deleteInstallment(id) {
    Utils.confirm('Hapus Cicilan', 'Data cicilan ini akan dihapus permanen.', () => {
      DB.deleteInstallment(id);
      Utils.toast('Cicilan dihapus', 'success');
      render();
    });
  }

  // ---- Pay Modal ----
  function openPayModal(id) {
    const inst = DB.getInstallments().find(x => x.id === id);
    if (!inst) return;
    const info     = DB.getInstallmentInfo(inst);
    const settings = DB.getSettings();

    document.getElementById('pay-inst-id').value  = id;
    document.getElementById('pay-amount').value   = Number(inst.monthlyAmount||0).toLocaleString('id-ID');
    document.getElementById('pay-note').value     = '';
    document.getElementById('pay-amount-hint').textContent = `Cicilan normal: ${Utils.formatCurrency(inst.monthlyAmount||0, settings)}`;

    document.getElementById('pay-inst-info').innerHTML = `
      <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:12px 14px;font-size:13px">
        <div style="font-weight:700;font-size:15px;margin-bottom:8px">${inst.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <div style="color:var(--text-muted);margin-bottom:2px">Sudah bayar</div>
            <div style="font-weight:700;color:var(--green)">${info.paidCount} dari ${inst.totalMonths} bln</div>
          </div>
          <div>
            <div style="color:var(--text-muted);margin-bottom:2px">Sisa hutang</div>
            <div style="font-weight:700;color:var(--red)">${Utils.formatCurrency(info.remaining, settings)}</div>
          </div>
        </div>
        ${info.isOverdue ? `<div style="margin-top:8px;color:var(--red);font-size:12px;font-weight:700"><i class="fa-solid fa-triangle-exclamation"></i> Pembayaran sudah jatuh tempo!</div>` : ''}
      </div>
    `;
    Utils.openModal('inst-pay-modal');
  }

  function submitPayment() {
    const id       = document.getElementById('pay-inst-id').value;
    const amount   = parseInt((document.getElementById('pay-amount').value||'0').replace(/[^0-9]/g,''), 10) || 0;
    const walletId = document.getElementById('pay-wallet').value;
    const note     = document.getElementById('pay-note').value.trim();
    const settings = DB.getSettings();

    if (!amount) { Utils.toast('Jumlah harus lebih dari 0', 'error'); return; }

    const wallet = DB.getWallets().find(w => w.id === walletId);
    if (wallet && (wallet.balance||0) < amount) {
      Utils.confirm('Saldo Tidak Cukup', `Saldo ${wallet.name} tidak cukup. Tetap bayar?`, () => {
        _doPay(id, walletId, amount, note, settings);
      }, 'warning');
      return;
    }
    _doPay(id, walletId, amount, note, settings);
  }

  function _doPay(id, walletId, amount, note, settings) {
    const result = DB.payInstallment(id, walletId, amount, note);
    Utils.closeModal('inst-pay-modal');
    App.updateTopbarWallet();
    App.markDirty(['dashboard','history','wallet']);
    if (result?.isDone) {
      Utils.toast(`Selamat! Cicilan berhasil dilunasi!`, 'success');
    } else {
      Utils.toast(`Pembayaran ${Utils.formatCurrency(amount, settings)} berhasil dicatat`, 'success');
    }
    render();
  }

  // ---- History Modal ----
  function showHistory(id) {
    const inst     = DB.getInstallments().find(x => x.id === id);
    if (!inst) return;
    const settings = DB.getSettings();
    const payments = inst.payments || [];

    document.getElementById('inst-history-title').textContent = `Riwayat — ${inst.name}`;
    document.getElementById('inst-history-content').innerHTML = payments.length ? `
      <div class="table-container">
        <table>
          <thead><tr><th>#</th><th>Tanggal</th><th>Dompet</th><th style="text-align:right">Jumlah</th></tr></thead>
          <tbody>
            ${payments.map((p, i) => {
              const wallet = Utils.getWalletById(p.walletId);
              return `<tr>
                <td style="color:var(--text-muted)">${i+1}</td>
                <td>${Utils.formatDate(p.date)}</td>
                <td>${wallet.name}</td>
                <td style="text-align:right;color:var(--red);font-weight:700;font-family:var(--font-display)">
                  -${Utils.formatCurrency(p.amount, settings)}
                </td>
              </tr>`;
            }).join('')}
            <tr style="border-top:2px solid var(--border)">
              <td colspan="3" style="font-weight:700">Total Terbayar</td>
              <td style="text-align:right;font-weight:700;color:var(--green);font-family:var(--font-display)">
                ${Utils.formatCurrency(payments.reduce((s,p)=>s+p.amount,0), settings)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    ` : `<div class="empty-state" style="padding:30px"><i class="fa-solid fa-receipt"></i><p>Belum ada riwayat pembayaran</p></div>`;

    Utils.openModal('inst-history-modal');
  }

  return { render, openModal, closeModal, saveInstallment, deleteInstallment, setTab, openPayModal, submitPayment, showHistory, selectColor, selectIcon, onAmountInput, calcMonthly };
})();

// ============================================================
// NET WORTH PAGE
// ============================================================
const NetWorthPage = (() => {
  let editingId  = null;
  let activeTab  = 'overview';
  let nwChart    = null;

  const ITEM_ICONS = {
    asset: ['fa-house','fa-car','fa-gem','fa-coins','fa-chart-line','fa-building','fa-land-mine-on','fa-briefcase','fa-piggy-bank','fa-laptop','fa-mobile','fa-motorcycle'],
    debt:  ['fa-credit-card','fa-landmark','fa-file-invoice-dollar','fa-hand-holding-dollar','fa-person-circle-minus','fa-money-bill-trend-up'],
  };

  function render() {
    const container = document.getElementById('page-networth');
    const settings  = DB.getSettings();
    const nw        = DB.calcNetWorth();
    const items     = DB.getNetworthItems();
    const snaps     = DB.getNetworthSnaps();

    container.innerHTML = `
      <div class="page-header">
        <h1>Net Worth</h1>
        <button class="btn btn-ghost btn-sm" onclick="NetWorthPage.recordSnapshot()" title="Simpan snapshot hari ini">
          <i class="fa-solid fa-camera" style="color:var(--purple)"></i> Snapshot
        </button>
      </div>

      <!-- Net Worth Hero Card -->
      <div class="nw-hero-card">
        <div style="font-size:12px;color:rgba(255,255,255,.65);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Kekayaan Bersih</div>
        <div class="nw-hero-value ${nw.netWorth >= 0 ? 'positive' : 'negative'}">
          ${nw.netWorth >= 0 ? '' : '-'}${Utils.formatCurrency(Math.abs(nw.netWorth), settings)}
        </div>
        <div style="display:flex;gap:20px;margin-top:16px">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.55);margin-bottom:3px">Total Aset</div>
            <div style="font-size:16px;font-weight:700;color:#4ade80">${Utils.formatCurrency(nw.totalAssets, settings)}</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.15)"></div>
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.55);margin-bottom:3px">Total Hutang</div>
            <div style="font-size:16px;font-weight:700;color:#f87171">${Utils.formatCurrency(nw.totalDebt, settings)}</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tab-nav mb-20">
        <div class="tab-btn ${activeTab==='overview'?'active':''}" onclick="NetWorthPage.setTab('overview')">Ringkasan</div>
        <div class="tab-btn ${activeTab==='assets'?'active':''}" onclick="NetWorthPage.setTab('assets')">Aset</div>
        <div class="tab-btn ${activeTab==='debts'?'active':''}" onclick="NetWorthPage.setTab('debts')">Hutang</div>
        <div class="tab-btn ${activeTab==='history'?'active':''}" onclick="NetWorthPage.setTab('history')">Riwayat</div>
      </div>

      <div id="nw-content"></div>

      <!-- Item Modal -->
      <div class="modal-overlay" id="nw-item-modal" onclick="if(event.target===this)NetWorthPage.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="nw-modal-title">Tambah Aset</div>
            <button class="btn-icon" onclick="NetWorthPage.closeModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Jenis</label>
              <div class="type-toggle">
                <div class="type-toggle-btn income active" id="nw-kind-asset" onclick="NetWorthPage.setKind('asset',this)">
                  <i class="fa-solid fa-arrow-trend-up"></i> Aset
                </div>
                <div class="type-toggle-btn expense" id="nw-kind-debt" onclick="NetWorthPage.setKind('debt',this)">
                  <i class="fa-solid fa-arrow-trend-down"></i> Hutang
                </div>
              </div>
              <input type="hidden" id="nw-kind" value="asset">
            </div>
            <div class="form-group">
              <label class="form-label">Nama</label>
              <input type="text" id="nw-item-name" class="form-control" placeholder="Contoh: Tanah, Saham, Pinjaman...">
            </div>
            <div class="form-group">
              <label class="form-label">Nilai</label>
              <div style="position:relative">
                <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:600">Rp</span>
                <input type="text" inputmode="numeric" id="nw-item-amount" class="form-control"
                  placeholder="0" style="padding-left:38px;font-size:18px;font-family:var(--font-display);font-weight:700"
                  oninput="NetWorthPage.onAmountInput(this)"
                  onkeydown="return TransactionPage.onAmountKeydown(event)">
              </div>
              <div id="nw-amount-hint" class="form-hint" style="display:none;color:var(--teal)"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <input type="text" id="nw-item-cat" class="form-control" placeholder="Properti, Kendaraan, Investasi...">
            </div>
            <div class="form-group">
              <label class="form-label">Keterangan <span class="text-muted">(opsional)</span></label>
              <input type="text" id="nw-item-desc" class="form-control" placeholder="Detail tambahan...">
            </div>
            <div class="form-group">
              <label class="form-label">Icon</label>
              <div style="display:flex;flex-wrap:wrap;gap:6px" id="nw-icon-list">
                ${ITEM_ICONS.asset.map(icon => `
                  <div class="icon-option" data-icon="${icon}" onclick="NetWorthPage.selectIcon(this,'${icon}')">
                    <i class="fa-solid ${icon}"></i>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="nw-item-icon" value="fa-coins">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="NetWorthPage.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="NetWorthPage.saveItem()">
              <i class="fa-solid fa-check"></i> Simpan
            </button>
          </div>
        </div>
      </div>
    `;

    _renderContent();
  }

  function _renderContent() {
    const el       = document.getElementById('nw-content');
    const settings = DB.getSettings();
    const nw       = DB.calcNetWorth();
    const items    = DB.getNetworthItems();
    const snaps    = DB.getNetworthSnaps();

    if (activeTab === 'overview')  _renderOverview(el, nw, items, settings);
    if (activeTab === 'assets')    _renderItems(el, items, 'asset', settings);
    if (activeTab === 'debts')     _renderItems(el, items, 'debt', settings);
    if (activeTab === 'history')   _renderHistory(el, snaps, settings);
  }

  function _renderOverview(el, nw, items, settings) {
    const wallets       = DB.getWallets();
    const goals         = DB.getGoals();
    const installments  = DB.getInstallments().filter(i => !i.completedAt);

    const assetSections = [
      { label: 'Saldo Dompet',        value: nw.walletAssets,  color: 'var(--cyan)',   icon: 'fa-wallet',     items: wallets.map(w => ({ name: w.name, value: w.balance||0 })) },
      { label: 'Tabungan Goals',      value: nw.goalAssets,    color: 'var(--green)',  icon: 'fa-piggy-bank', items: goals.filter(g=>g.savedAmount>0).map(g => ({ name: g.name, value: g.savedAmount||0 })) },
      { label: 'Aset Manual',         value: nw.manualAssets,  color: 'var(--teal)',   icon: 'fa-coins',      items: items.filter(i=>i.kind==='asset').map(i => ({ name: i.name, value: i.amount||0 })) },
    ];
    const debtSections = [
      { label: 'Sisa Cicilan',        value: nw.instDebt,      color: 'var(--orange)', icon: 'fa-credit-card', items: installments.map(i => { const info=DB.getInstallmentInfo(i); return {name:i.name,value:info.remaining}; }) },
      { label: 'Hutang Manual',       value: nw.manualDebt,    color: 'var(--red)',    icon: 'fa-hand-holding-dollar', items: items.filter(i=>i.kind==='debt').map(i => ({ name: i.name, value: i.amount||0 })) },
    ];

    el.innerHTML = `
      <!-- Asset breakdown -->
      <div class="card mb-16">
        <div class="card-header mb-16">
          <span class="card-title"><i class="fa-solid fa-arrow-trend-up" style="color:var(--green)"></i> Rincian Aset</span>
          <span style="font-family:var(--font-display);font-weight:800;color:var(--green)">${Utils.formatCurrency(nw.totalAssets, settings)}</span>
        </div>
        ${assetSections.map(s => s.value > 0 ? `
          <div style="margin-bottom:14px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600">
                <i class="fa-solid ${s.icon}" style="color:${s.color};width:16px;text-align:center"></i>
                ${s.label}
              </div>
              <span style="font-family:var(--font-display);font-size:14px;font-weight:700;color:${s.color}">${Utils.formatCurrency(s.value, settings)}</span>
            </div>
            <div class="progress-bar" style="height:6px;margin-bottom:6px">
              <div class="progress-fill" style="width:${nw.totalAssets>0?((s.value/nw.totalAssets)*100).toFixed(1):0}%;background:${s.color}"></div>
            </div>
            ${s.items.slice(0,3).map(i => `
              <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);padding:2px 0 2px 24px">
                <span>${i.name}</span>
                <span style="color:var(--text-secondary)">${Utils.formatCurrency(i.value, settings)}</span>
              </div>
            `).join('')}
          </div>
        ` : '').join('')}
      </div>

      <!-- Debt breakdown -->
      <div class="card mb-16">
        <div class="card-header mb-16">
          <span class="card-title"><i class="fa-solid fa-arrow-trend-down" style="color:var(--red)"></i> Rincian Hutang</span>
          <span style="font-family:var(--font-display);font-weight:800;color:var(--red)">${Utils.formatCurrency(nw.totalDebt, settings)}</span>
        </div>
        ${nw.totalDebt === 0 ? '<p class="text-muted text-sm" style="text-align:center;padding:12px 0">Tidak ada hutang</p>' :
          debtSections.map(s => s.value > 0 ? `
            <div style="margin-bottom:14px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600">
                  <i class="fa-solid ${s.icon}" style="color:${s.color};width:16px;text-align:center"></i>
                  ${s.label}
                </div>
                <span style="font-family:var(--font-display);font-size:14px;font-weight:700;color:${s.color}">${Utils.formatCurrency(s.value, settings)}</span>
              </div>
              <div class="progress-bar" style="height:6px;margin-bottom:6px">
                <div class="progress-fill" style="width:${nw.totalDebt>0?((s.value/nw.totalDebt)*100).toFixed(1):0}%;background:${s.color}"></div>
              </div>
              ${s.items.slice(0,3).map(i => `
                <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);padding:2px 0 2px 24px">
                  <span>${i.name}</span>
                  <span style="color:var(--text-secondary)">${Utils.formatCurrency(i.value, settings)}</span>
                </div>
              `).join('')}
            </div>
          ` : '').join('')}
      </div>

      <!-- Debt ratio -->
      ${nw.totalAssets > 0 ? `
        <div class="card">
          <div class="card-header mb-12">
            <span class="card-title"><i class="fa-solid fa-scale-balanced" style="color:var(--purple)"></i> Rasio Keuangan</span>
          </div>
          ${[
            { label: 'Debt-to-Asset Ratio', val: ((nw.totalDebt/nw.totalAssets)*100).toFixed(1)+'%', color: nw.totalDebt/nw.totalAssets < 0.4 ? 'var(--green)' : nw.totalDebt/nw.totalAssets < 0.7 ? 'var(--yellow)' : 'var(--red)', status: nw.totalDebt/nw.totalAssets < 0.4 ? 'Sehat' : nw.totalDebt/nw.totalAssets < 0.7 ? 'Perlu Perhatian' : 'Berbahaya' },
            { label: 'Net Worth Positif',   val: nw.netWorth >= 0 ? 'Ya' : 'Tidak', color: nw.netWorth >= 0 ? 'var(--green)' : 'var(--red)', status: nw.netWorth >= 0 ? 'Baik' : 'Perlu diperbaiki' },
          ].map(r => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-md);margin-bottom:8px">
              <div>
                <div style="font-size:13px;font-weight:600">${r.label}</div>
                <div style="font-size:11px;color:var(--text-muted)">${r.status}</div>
              </div>
              <div style="font-family:var(--font-display);font-size:16px;font-weight:800;color:${r.color}">${r.val}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  function _renderItems(el, items, kind, settings) {
    const filtered = items.filter(i => i.kind === kind);
    const total    = filtered.reduce((s, i) => s + (i.amount||0), 0);
    const isAsset  = kind === 'asset';
    const color    = isAsset ? 'var(--green)' : 'var(--red)';
    const label    = isAsset ? 'Aset' : 'Hutang';

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-family:var(--font-display);font-size:13px;font-weight:700;color:var(--text-muted)">
          TOTAL ${label.toUpperCase()} MANUAL
        </div>
        <div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:${color}">
          ${Utils.formatCurrency(total, settings)}
        </div>
      </div>

      <button class="btn btn-primary mb-16" style="width:100%;justify-content:center" onclick="NetWorthPage.openModal('${kind}')">
        <i class="fa-solid fa-plus"></i> Tambah ${label} Manual
      </button>

      ${filtered.length ? filtered.map(item => `
        <div class="nw-item-card" style="--nw-color:${isAsset?'var(--green)':'var(--red)'}">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="nw-item-icon">
              <i class="fa-solid ${item.icon||'fa-coins'}"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14px">${item.name}</div>
              ${item.category ? `<div style="font-size:12px;color:var(--text-muted)">${item.category}</div>` : ''}
              ${item.desc     ? `<div style="font-size:12px;color:var(--text-muted)">${item.desc}</div>` : ''}
            </div>
            <div style="text-align:right">
              <div style="font-family:var(--font-display);font-size:15px;font-weight:800;color:${color}">
                ${Utils.formatCurrency(item.amount||0, settings)}
              </div>
              <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:4px">
                <button class="btn-icon" style="width:26px;height:26px;font-size:11px" onclick="NetWorthPage.openModal('${kind}','${item.id}')">
                  <i class="fa-solid fa-pen" style="color:var(--cyan)"></i>
                </button>
                <button class="btn-icon" style="width:26px;height:26px;font-size:11px" onclick="NetWorthPage.deleteItem('${item.id}')">
                  <i class="fa-solid fa-trash" style="color:var(--red)"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `).join('') : `
        <div class="empty-state" style="padding:40px 20px">
          <i class="fa-solid ${isAsset?'fa-coins':'fa-credit-card'}"></i>
          <h3>Belum ada ${label.toLowerCase()} manual</h3>
          <p>${isAsset ? 'Tambahkan properti, kendaraan, investasi, dll' : 'Tambahkan hutang di luar cicilan yang sudah tercatat'}</p>
        </div>
      `}
    `;
  }

  function _renderHistory(el, snaps, settings) {
    if (!snaps.length) {
      el.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-chart-line"></i>
          <h3>Belum ada riwayat</h3>
          <p>Tap tombol <strong>Snapshot</strong> di atas untuk menyimpan net worth hari ini</p>
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:16px" onclick="NetWorthPage.recordSnapshot()">
          <i class="fa-solid fa-camera"></i> Simpan Snapshot Sekarang
        </button>`;
      return;
    }

    const sorted = [...snaps].sort((a,b) => a.date > b.date ? 1 : -1);
    const latest = sorted[sorted.length - 1];
    const oldest = sorted[0];
    const change = latest.netWorth - oldest.netWorth;

    el.innerHTML = `
      <!-- Trend summary -->
      <div class="card mb-16">
        <div class="card-header mb-12">
          <span class="card-title"><i class="fa-solid fa-chart-line" style="color:var(--purple)"></i> Tren Net Worth</span>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <div style="flex:1;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-md);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Snapshot Pertama</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${oldest.date}</div>
            <div style="font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--text-secondary)">${Utils.formatCurrency(oldest.netWorth, settings)}</div>
          </div>
          <div style="display:flex;align-items:center;color:${change>=0?'var(--green)':'var(--red)'};font-size:20px">
            <i class="fa-solid fa-arrow-right"></i>
          </div>
          <div style="flex:1;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-md);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Snapshot Terakhir</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${latest.date}</div>
            <div style="font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--text-secondary)">${Utils.formatCurrency(latest.netWorth, settings)}</div>
          </div>
        </div>
        <div style="text-align:center;padding:12px;background:${change>=0?'rgba(0,230,118,.1)':'rgba(255,23,68,.1)'};border-radius:var(--radius-md)">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Perubahan Total</div>
          <div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:${change>=0?'var(--green)':'var(--red)'}">
            ${change>=0?'+':''}${Utils.formatCurrency(change, settings)}
          </div>
        </div>
      </div>

      <!-- Snapshot table -->
      <div class="card">
        <div class="card-header mb-12">
          <span class="card-title"><i class="fa-solid fa-table-list" style="color:var(--blue)"></i> Semua Snapshot</span>
          <span class="text-muted text-xs">${snaps.length} data</span>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Tanggal</th><th style="text-align:right">Aset</th><th style="text-align:right">Hutang</th><th style="text-align:right">Net Worth</th></tr></thead>
            <tbody>
              ${sorted.reverse().map(s => `
                <tr>
                  <td style="font-weight:600">${Utils.formatDate(s.date)}</td>
                  <td style="text-align:right;color:var(--green)">${Utils.formatCurrency(s.totalAssets||0, settings)}</td>
                  <td style="text-align:right;color:var(--red)">${Utils.formatCurrency(s.totalDebt||0, settings)}</td>
                  <td style="text-align:right;font-family:var(--font-display);font-weight:700;color:${(s.netWorth||0)>=0?'var(--teal)':'var(--orange)'}">${Utils.formatCurrency(s.netWorth||0, settings)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ---- Helpers ----
  function onAmountInput(input) {
    let raw = input.value.replace(/[^0-9]/g, '');
    if (!raw) { input.value = ''; document.getElementById('nw-amount-hint').style.display='none'; return; }
    raw = String(parseInt(raw, 10));
    input.value = Number(raw).toLocaleString('id-ID');
    const hint = document.getElementById('nw-amount-hint');
    if (hint) { hint.style.display='block'; hint.textContent = Utils.formatCurrency(parseInt(raw), DB.getSettings()); }
  }

  function selectIcon(el, icon) {
    document.querySelectorAll('#nw-item-modal .icon-option').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('nw-item-icon').value = icon;
  }

  function setKind(kind, el) {
    document.getElementById('nw-kind').value = kind;
    document.querySelectorAll('#nw-item-modal .type-toggle-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    // Refresh icon list
    const iconList = document.getElementById('nw-icon-list');
    if (iconList) {
      iconList.innerHTML = (ITEM_ICONS[kind]||ITEM_ICONS.asset).map(icon => `
        <div class="icon-option" data-icon="${icon}" onclick="NetWorthPage.selectIcon(this,'${icon}')">
          <i class="fa-solid ${icon}"></i>
        </div>
      `).join('');
    }
    document.getElementById('nw-modal-title').textContent = kind === 'asset' ? 'Tambah Aset' : 'Tambah Hutang';
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('#page-networth .tab-btn').forEach((b, i) => {
      b.classList.toggle('active', ['overview','assets','debts','history'][i] === tab);
    });
    _renderContent();
  }

  // ---- Modal ----
  function openModal(kindOrId, itemId) {
    // Bisa dipanggil: openModal('asset'), openModal('debt'), openModal('asset','itemId')
    const isEdit = itemId !== undefined;
    editingId = isEdit ? itemId : null;

    let kind = kindOrId;
    if (isEdit) {
      const item = DB.getNetworthItems().find(i => i.id === itemId);
      if (item) {
        kind = item.kind;
        document.getElementById('nw-item-name').value   = item.name || '';
        document.getElementById('nw-item-amount').value = Number(item.amount||0).toLocaleString('id-ID');
        document.getElementById('nw-item-cat').value    = item.category || '';
        document.getElementById('nw-item-desc').value   = item.desc || '';
        document.getElementById('nw-item-icon').value   = item.icon || 'fa-coins';
        document.getElementById('nw-kind').value        = item.kind;
        document.getElementById('nw-amount-hint').style.display = 'none';
        const ic = document.querySelector(`#nw-item-modal .icon-option[data-icon="${item.icon}"]`);
        if (ic) { document.querySelectorAll('#nw-item-modal .icon-option').forEach(s=>s.classList.remove('selected')); ic.classList.add('selected'); }
      }
    } else {
      document.getElementById('nw-item-name').value   = '';
      document.getElementById('nw-item-amount').value = '';
      document.getElementById('nw-item-cat').value    = '';
      document.getElementById('nw-item-desc').value   = '';
      document.getElementById('nw-item-icon').value   = 'fa-coins';
      document.getElementById('nw-kind').value        = kind;
      document.getElementById('nw-amount-hint').style.display = 'none';
    }

    // Sync type toggle and icon list
    document.querySelectorAll('#nw-item-modal .type-toggle-btn').forEach(b => b.classList.remove('active'));
    const activeToggle = document.getElementById(kind === 'asset' ? 'nw-kind-asset' : 'nw-kind-debt');
    if (activeToggle) activeToggle.classList.add('active');
    const iconList = document.getElementById('nw-icon-list');
    if (iconList) {
      iconList.innerHTML = (ITEM_ICONS[kind]||ITEM_ICONS.asset).map(icon => `
        <div class="icon-option" data-icon="${icon}" onclick="NetWorthPage.selectIcon(this,'${icon}')">
          <i class="fa-solid ${icon}"></i>
        </div>
      `).join('');
    }
    document.getElementById('nw-modal-title').textContent = isEdit ? 'Edit Item' : (kind==='asset'?'Tambah Aset':'Tambah Hutang');
    Utils.openModal('nw-item-modal');
  }

  function closeModal() { Utils.closeModal('nw-item-modal'); editingId = null; }

  function saveItem() {
    const name   = document.getElementById('nw-item-name').value.trim();
    const amount = parseInt((document.getElementById('nw-item-amount').value||'0').replace(/[^0-9]/g,''), 10) || 0;
    const cat    = document.getElementById('nw-item-cat').value.trim();
    const desc   = document.getElementById('nw-item-desc').value.trim();
    const icon   = document.getElementById('nw-item-icon').value;
    const kind   = document.getElementById('nw-kind').value;

    if (!name)   { Utils.toast('Nama harus diisi', 'error'); return; }
    if (!amount) { Utils.toast('Nilai harus lebih dari 0', 'error'); return; }

    if (editingId) {
      DB.updateNetworthItem(editingId, { name, amount, category: cat, desc, icon, kind });
      Utils.toast('Item diperbarui', 'success');
    } else {
      DB.addNetworthItem({ name, amount, category: cat, desc, icon, kind });
      Utils.toast('Item ditambahkan', 'success');
    }
    closeModal();
    render();
  }

  function deleteItem(id) {
    Utils.confirm('Hapus Item', 'Item ini akan dihapus dari kalkulasi net worth.', () => {
      DB.deleteNetworthItem(id);
      Utils.toast('Item dihapus', 'success');
      render();
    });
  }

  function recordSnapshot() {
    DB.recordNetworthSnapshot();
    Utils.toast('Snapshot net worth disimpan', 'success');
    if (activeTab === 'history') _renderContent();
  }

  return { render, setTab, openModal, closeModal, saveItem, deleteItem, selectIcon, setKind, onAmountInput, recordSnapshot };
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
            <div class="text-muted text-sm">Versi 2.0.0 · Aplikasi Keuangan Pribadi</div>
            <div class="text-muted text-sm" style="margin-top:4px">Data disimpan di browser (localStorage) | Author : Bagas Aditya</div>
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
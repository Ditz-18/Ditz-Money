/**
 * Ditz AI - Pure JS AI Chat Agent
 * Rule-based NLP engine dengan akses penuh ke data keuangan user
 */

const AIChat = (() => {

  let isOpen    = false;
  let isTyping  = false;
  let messages  = []; // {role:'ai'|'user', text, html}

  // ── Suggestions kontekstual ──────────────────────────────────
  const SUGGESTIONS = [
    'Saldo semua dompet',
    'Pengeluaran bulan ini',
    'Pemasukan bulan ini',
    'Transaksi terbesar',
    'Saving rate bulan ini',
    'Budget yang hampir habis',
    'Transaksi hari ini',
    'Bandingkan bulan ini vs lalu',
    'Kategori terboros',
    'Total pengeluaran minggu ini',
  ];

  // ── Toggle panel ─────────────────────────────────────────────
  function toggle() {
    isOpen = !isOpen;
    const panel  = document.getElementById('ai-chat-panel');
    const fabAI  = document.getElementById('fab-ai');
    const fabIcon = document.getElementById('fab-ai-icon');

    if (isOpen) {
      panel.style.display = 'flex';
      requestAnimationFrame(() => panel.classList.add('open'));
      fabAI.classList.add('open');
      fabIcon.className = 'fa-solid fa-xmark';
      if (!messages.length) _sendWelcome();
      _renderSuggestions();
      setTimeout(() => document.getElementById('ai-chat-input')?.focus(), 300);
    } else {
      panel.classList.remove('open');
      fabAI.classList.remove('open');
      fabIcon.className = 'fa-solid fa-robot';
      setTimeout(() => { panel.style.display = 'none'; }, 250);
    }
  }

  // ── Send message ─────────────────────────────────────────────
  function send() {
    const input = document.getElementById('ai-chat-input');
    const text  = (input?.value || '').trim();
    if (!text || isTyping) return;
    input.value = '';

    _appendMessage('user', text);
    _showTyping();

    setTimeout(() => {
      _hideTyping();
      const response = _processQuery(text);
      _appendMessage('ai', response.text, response.html);
      _renderSuggestions(response.suggestions);
    }, 600 + Math.random() * 400);
  }

  function sendChip(text) {
    const input = document.getElementById('ai-chat-input');
    if (input) input.value = text;
    send();
  }

  function clearHistory() {
    messages = [];
    document.getElementById('ai-chat-messages').innerHTML = '';
    _sendWelcome();
  }

  // ── Welcome message ──────────────────────────────────────────
  function _sendWelcome() {
    const settings = DB.getSettings();
    const name     = settings.appName || 'Ditz Money';
    const now      = new Date();
    const hour     = now.getHours();
    const greeting = hour < 12 ? 'Selamat pagi' : hour < 17 ? 'Selamat siang' : 'Selamat malam';

    _appendMessage('ai',
      `${greeting}! Saya **Ditz AI**, asisten keuangan kamu di ${name}.\n\nSaya bisa membantu kamu:\n• Cek saldo & ringkasan keuangan\n• Analisis pengeluaran & pemasukan\n• Kalkulasi & perbandingan data\n• Catat transaksi via chat\n\nCoba tanyakan sesuatu!`
    );
  }

  // ── Append message to UI ─────────────────────────────────────
  function _appendMessage(role, text, extraHTML) {
    messages.push({ role, text });
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = `ai-msg ${role}`;

    const avatarHTML = role === 'ai'
      ? `<div class="ai-avatar"><i class="fa-solid fa-robot"></i></div>`
      : '';

    const formatted = _formatText(text);
    wrapper.innerHTML = `
      ${avatarHTML}
      <div class="ai-msg-bubble">
        ${formatted}
        ${extraHTML || ''}
      </div>
    `;
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
  }

  function _showTyping() {
    isTyping = true;
    const container = document.getElementById('ai-chat-messages');
    const el = document.createElement('div');
    el.className = 'ai-msg ai';
    el.id = 'ai-typing-indicator';
    el.innerHTML = `
      <div class="ai-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="ai-typing"><span></span><span></span><span></span></div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function _hideTyping() {
    isTyping = false;
    document.getElementById('ai-typing-indicator')?.remove();
  }

  // ── Format text (bold, newline) ──────────────────────────────
  function _formatText(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ── Render suggestion chips ──────────────────────────────────
  function _renderSuggestions(custom) {
    const el   = document.getElementById('ai-chat-suggestions');
    if (!el) return;
    const list = custom || SUGGESTIONS.slice(0, 4);
    el.innerHTML = list.map(s =>
      `<div class="ai-chip" onclick="AIChat.sendChip('${s}')">${s}</div>`
    ).join('');
  }

  // ── CORE: Process query ──────────────────────────────────────
  function _processQuery(input) {
    const q = input.toLowerCase().trim();

    // ── 1. Catat transaksi via chat ────────────────────────────
    const txnResult = _tryParseTransaction(q, input);
    if (txnResult) return txnResult;

    // ── 2. Kalkulator ─────────────────────────────────────────
    const mathResult = _tryMath(q, input);
    if (mathResult) return mathResult;

    // ── 3. Saldo dompet ───────────────────────────────────────
    if (_match(q, ['saldo','dompet','wallet','balance','kas','bank','uang','tabungan'])) {
      return _querySaldo(q);
    }

    // ── 4. Pengeluaran ────────────────────────────────────────
    if (_match(q, ['pengeluaran','keluar','spend','bayar','beli'])) {
      return _queryPengeluaran(q);
    }

    // ── 5. Pemasukan ──────────────────────────────────────────
    if (_match(q, ['pemasukan','masuk','income','gaji','dapat','terima'])) {
      return _queryPemasukan(q);
    }

    // ── 6. Saving rate ────────────────────────────────────────
    if (_match(q, ['saving','tabung','simpan','rate'])) {
      return _querySavingRate(q);
    }

    // ── 7. Transaksi terbesar / terkecil ──────────────────────
    if (_match(q, ['terbesar','terbanyak','tertinggi','terkecil','terendah'])) {
      return _queryExtremeTxn(q);
    }

    // ── 8. Transaksi hari ini / minggu ini ────────────────────
    if (_match(q, ['hari ini','today','tadi','barusan'])) {
      return _queryHariIni();
    }
    if (_match(q, ['minggu ini','week','7 hari','tujuh hari'])) {
      return _queryMingguIni();
    }

    // ── 9. Perbandingan bulan ─────────────────────────────────
    if (_match(q, ['banding','compare','vs','versus','dibanding','selisih bulan'])) {
      return _queryBandingBulan(q);
    }

    // ── 10. Kategori terboros / terbanyak ─────────────────────
    if (_match(q, ['kategori','terboros','paling banyak','terbanyak keluar'])) {
      return _queryKategoriTerboros(q);
    }

    // ── 11. Budget ────────────────────────────────────────────
    if (_match(q, ['budget','anggaran','limit','hampir habis','over'])) {
      return _queryBudget(q);
    }

    // ── 12. Ringkasan / summary ───────────────────────────────
    if (_match(q, ['ringkasan','summary','rekap','laporan','total','semua'])) {
      return _queryRingkasan(q);
    }

    // ── 13. Transaksi terakhir / riwayat ──────────────────────
    if (_match(q, ['terakhir','terbaru','riwayat','history','transaksi'])) {
      return _queryTerakhir(q);
    }

    // ── 14. Info aplikasi ─────────────────────────────────────
    if (_match(q, ['halo','hai','hi','hello','apa kabar','siapa kamu','kamu bisa apa'])) {
      return _queryHelp();
    }

    // ── Fallback ──────────────────────────────────────────────
    return {
      text: `Maaf, saya belum bisa memahami pertanyaan itu.\n\nCoba tanyakan hal seperti:\n• "Saldo semua dompet"\n• "Pengeluaran bulan ini"\n• "Catat makan siang 35rb"\n• "250rb + 150rb berapa?"`,
      suggestions: ['Saldo semua dompet', 'Pengeluaran bulan ini', 'Catat transaksi', 'Ringkasan bulan ini'],
    };
  }

  // ── Helper: keyword matcher ──────────────────────────────────
  function _match(q, keywords) {
    return keywords.some(k => q.includes(k));
  }

  // ── Helper: get period from query ────────────────────────────
  function _getPeriod(q) {
    const now = new Date();
    let year  = now.getFullYear();
    let month = now.getMonth();

    const monthNames = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
    for (let i = 0; i < monthNames.length; i++) {
      if (q.includes(monthNames[i])) { month = i; break; }
    }

    if (q.includes('lalu') || q.includes('kemarin') || q.includes('sebelumnya')) {
      month = month - 1;
      if (month < 0) { month = 11; year--; }
    }
    if (q.includes('tahun lalu')) year--;

    return { year, month };
  }

  // ── Helper: format currency ───────────────────────────────────
  function _fc(amount) {
    return Utils.formatCurrency(amount, DB.getSettings());
  }

  // ── Helper: build data card HTML ─────────────────────────────
  function _dataCard(rows) {
    return `<div class="ai-data-card">${rows.map(([label, val, color]) =>
      `<div class="ai-data-row">
        <span class="ai-data-label">${label}</span>
        <span class="ai-data-val" ${color ? `style="color:${color}"` : ''}>${val}</span>
      </div>`
    ).join('')}</div>`;
  }

  // ════════════════════════════════════════════════════════════
  // QUERY HANDLERS
  // ════════════════════════════════════════════════════════════

  // ── Saldo dompet ─────────────────────────────────────────────
  function _querySaldo(q) {
    const wallets  = DB.getWallets();
    const total    = wallets.reduce((s, w) => s + (w.balance || 0), 0);
    const active   = DB.getActiveWallet();

    // Cari dompet spesifik
    const found = wallets.find(w => q.includes(w.name.toLowerCase()));
    if (found) {
      return {
        text: `Saldo **${found.name}** kamu saat ini:`,
        html: _dataCard([
          ['Dompet', found.name],
          ['Saldo', _fc(found.balance || 0), found.balance >= 0 ? 'var(--cyan)' : 'var(--red)'],
          ['Tipe', found.type || 'cash'],
        ]),
        suggestions: ['Saldo semua dompet', 'Transfer antar dompet', 'Riwayat transaksi'],
      };
    }

    const rows = wallets.map(w => [w.name, _fc(w.balance || 0), (w.balance||0) >= 0 ? 'var(--cyan)' : 'var(--red)']);
    rows.push(['── Total ──', _fc(total), 'var(--yellow)']);

    return {
      text: `Berikut saldo semua dompet kamu:`,
      html: _dataCard(rows),
      suggestions: wallets.map(w => `Saldo ${w.name}`),
    };
  }

  // ── Pengeluaran ───────────────────────────────────────────────
  function _queryPengeluaran(q) {
    const { year, month } = _getPeriod(q);
    const summary  = DB.getSummary(year, month);
    const catTotals = DB.getCategoryTotals(year, month, 'expense');
    const label    = `${Utils.getMonthName(month)} ${year}`;

    const rows = [
      ['Periode', label],
      ['Total Pengeluaran', _fc(summary.expense), 'var(--red)'],
      ['Jumlah Transaksi', summary.count + ' transaksi'],
    ];

    let catHTML = '';
    if (catTotals.length) {
      catHTML = `<div class="ai-data-card" style="margin-top:6px">
        ${catTotals.slice(0,5).map(c =>
          `<div class="ai-data-row">
            <span class="ai-data-label">${c.name}</span>
            <span class="ai-data-val" style="color:${c.color}">${_fc(c.total)}</span>
          </div>`
        ).join('')}
      </div>`;
    }

    return {
      text: `Pengeluaran kamu di **${label}**:`,
      html: _dataCard(rows) + catHTML,
      suggestions: ['Kategori terboros', 'Bandingkan bulan ini vs lalu', 'Pemasukan bulan ini'],
    };
  }

  // ── Pemasukan ─────────────────────────────────────────────────
  function _queryPemasukan(q) {
    const { year, month } = _getPeriod(q);
    const summary   = DB.getSummary(year, month);
    const catTotals = DB.getCategoryTotals(year, month, 'income');
    const label     = `${Utils.getMonthName(month)} ${year}`;

    return {
      text: `Pemasukan kamu di **${label}**:`,
      html: _dataCard([
        ['Periode', label],
        ['Total Pemasukan', _fc(summary.income), 'var(--green)'],
        ['Pengeluaran', _fc(summary.expense), 'var(--red)'],
        ['Selisih Bersih', _fc(summary.net), summary.net >= 0 ? 'var(--teal)' : 'var(--orange)'],
      ]) + (catTotals.length ? `<div class="ai-data-card" style="margin-top:6px">
        ${catTotals.slice(0,4).map(c =>
          `<div class="ai-data-row"><span class="ai-data-label">${c.name}</span>
           <span class="ai-data-val" style="color:${c.color}">${_fc(c.total)}</span></div>`
        ).join('')}</div>` : ''),
      suggestions: ['Saving rate bulan ini', 'Pengeluaran bulan ini', 'Ringkasan bulan ini'],
    };
  }

  // ── Saving rate ───────────────────────────────────────────────
  function _querySavingRate(q) {
    const { year, month } = _getPeriod(q);
    const summary = DB.getSummary(year, month);
    const label   = `${Utils.getMonthName(month)} ${year}`;
    const rate    = summary.income > 0
      ? ((summary.net / summary.income) * 100).toFixed(1)
      : 0;
    const status  = rate >= 20 ? '🟢 Bagus!' : rate >= 0 ? '🟡 Cukup' : '🔴 Defisit';

    return {
      text: `Saving rate kamu di **${label}**:`,
      html: _dataCard([
        ['Pemasukan', _fc(summary.income), 'var(--green)'],
        ['Pengeluaran', _fc(summary.expense), 'var(--red)'],
        ['Selisih', _fc(summary.net), summary.net >= 0 ? 'var(--teal)' : 'var(--orange)'],
        ['Saving Rate', rate + '%', rate >= 20 ? 'var(--green)' : rate >= 0 ? 'var(--yellow)' : 'var(--red)'],
        ['Status', status],
      ]),
      suggestions: ['Kategori terboros', 'Budget yang hampir habis', 'Bandingkan bulan ini vs lalu'],
    };
  }

  // ── Transaksi terbesar/terkecil ───────────────────────────────
  function _queryExtremeTxn(q) {
    const { year, month } = _getPeriod(q);
    const isTerkecil = _match(q, ['terkecil','terendah','paling kecil']);
    const type = _match(q, ['pengeluaran','keluar']) ? 'expense'
               : _match(q, ['pemasukan','masuk'])    ? 'income'
               : null;

    let txns = DB.getTransactionsByPeriod(year, month).filter(t => !t.isTransfer);
    if (type) txns = txns.filter(t => t.type === type);
    if (!txns.length) return { text: 'Tidak ada transaksi di periode ini.', suggestions: ['Catat transaksi'] };

    txns.sort((a, b) => isTerkecil ? a.amount - b.amount : b.amount - a.amount);
    const top = txns.slice(0, 5);
    const label = `${Utils.getMonthName(month)} ${year}`;

    return {
      text: `${isTerkecil ? '5 transaksi terkecil' : '5 transaksi terbesar'} di **${label}**:`,
      html: `<div class="ai-data-card">${top.map(t => {
        const cat = Utils.getCategoryById(t.categoryId);
        return `<div class="ai-data-row">
          <span class="ai-data-label">${cat.name} · ${Utils.formatDate(t.date,'short')}</span>
          <span class="ai-data-val" style="color:${t.type==='income'?'var(--green)':'var(--red)'}">
            ${t.type==='income'?'+':'-'}${_fc(t.amount)}
          </span>
        </div>`;
      }).join('')}</div>`,
      suggestions: ['Pengeluaran bulan ini', 'Kategori terboros'],
    };
  }

  // ── Hari ini ──────────────────────────────────────────────────
  function _queryHariIni() {
    const today = Utils.todayStr();
    const txns  = DB.getTransactions().filter(t => t.date === today && !t.isTransfer);
    const income  = txns.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);

    if (!txns.length) {
      return { text: 'Belum ada transaksi hari ini. Yuk mulai catat!', suggestions: ['Catat transaksi', 'Saldo semua dompet'] };
    }

    return {
      text: `Transaksi kamu **hari ini** (${txns.length} transaksi):`,
      html: _dataCard([
        ['Pemasukan', _fc(income), 'var(--green)'],
        ['Pengeluaran', _fc(expense), 'var(--red)'],
        ['Selisih', _fc(income - expense), income-expense >= 0 ? 'var(--teal)' : 'var(--orange)'],
      ]) + `<div class="ai-data-card" style="margin-top:6px">
        ${txns.slice(0,5).map(t => {
          const cat = Utils.getCategoryById(t.categoryId);
          return `<div class="ai-data-row">
            <span class="ai-data-label">${cat.name}${t.note ? ' · '+Utils.truncate(t.note,15) : ''}</span>
            <span class="ai-data-val" style="color:${t.type==='income'?'var(--green)':'var(--red)'}">
              ${t.type==='income'?'+':'-'}${_fc(t.amount)}
            </span>
          </div>`;
        }).join('')}
      </div>`,
      suggestions: ['Pengeluaran bulan ini', 'Saldo semua dompet'],
    };
  }

  // ── Minggu ini ────────────────────────────────────────────────
  function _queryMingguIni() {
    const now   = new Date();
    const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0);
    const txns  = DB.getTransactions().filter(t => {
      const d = new Date(t.date);
      return d >= start && !t.isTransfer;
    });
    const income  = txns.filter(t => t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expense = txns.filter(t => t.type==='expense').reduce((s,t)=>s+t.amount,0);

    return {
      text: `Transaksi **7 hari terakhir** (${txns.length} transaksi):`,
      html: _dataCard([
        ['Pemasukan', _fc(income), 'var(--green)'],
        ['Pengeluaran', _fc(expense), 'var(--red)'],
        ['Selisih', _fc(income-expense), income-expense>=0?'var(--teal)':'var(--orange)'],
        ['Rata-rata/hari', _fc(Math.round(expense/7)), 'var(--text-muted)'],
      ]),
      suggestions: ['Transaksi terbesar minggu ini', 'Pengeluaran bulan ini'],
    };
  }

  // ── Bandingkan bulan ─────────────────────────────────────────
  function _queryBandingBulan(q) {
    const now   = new Date();
    const curM  = now.getMonth(), curY = now.getFullYear();
    const prevM = curM === 0 ? 11 : curM - 1;
    const prevY = curM === 0 ? curY - 1 : curY;

    const cur  = DB.getSummary(curY, curM);
    const prev = DB.getSummary(prevY, prevM);

    const incChange = prev.income  > 0 ? (((cur.income  - prev.income)  / prev.income)  * 100).toFixed(1) : null;
    const expChange = prev.expense > 0 ? (((cur.expense - prev.expense) / prev.expense) * 100).toFixed(1) : null;

    return {
      text: `Perbandingan **${Utils.getMonthName(curM)}** vs **${Utils.getMonthName(prevM)}**:`,
      html: _dataCard([
        ['', Utils.getMonthName(prevM), 'var(--text-muted)'],
        ['Pemasukan', _fc(prev.income), 'var(--green)'],
        ['Pengeluaran', _fc(prev.expense), 'var(--red)'],
        ['', Utils.getMonthName(curM), 'var(--cyan)'],
        ['Pemasukan', _fc(cur.income), 'var(--green)'],
        ['Pengeluaran', _fc(cur.expense), 'var(--red)'],
        ['── Perubahan ──', ''],
        ['Pemasukan', incChange !== null ? (incChange > 0 ? '▲ ' : '▼ ') + Math.abs(incChange) + '%' : '-', incChange > 0 ? 'var(--green)' : 'var(--red)'],
        ['Pengeluaran', expChange !== null ? (expChange > 0 ? '▲ ' : '▼ ') + Math.abs(expChange) + '%' : '-', expChange > 0 ? 'var(--red)' : 'var(--green)'],
      ]),
      suggestions: ['Saving rate bulan ini', 'Kategori terboros', 'Ringkasan bulan ini'],
    };
  }

  // ── Kategori terboros ─────────────────────────────────────────
  function _queryKategoriTerboros(q) {
    const { year, month } = _getPeriod(q);
    const cats  = DB.getCategoryTotals(year, month, 'expense');
    const label = `${Utils.getMonthName(month)} ${year}`;
    const total = cats.reduce((s,c) => s+c.total, 0);

    if (!cats.length) return { text: `Tidak ada data pengeluaran di **${label}**.`, suggestions: ['Catat transaksi'] };

    return {
      text: `Kategori pengeluaran terboros di **${label}**:`,
      html: `<div class="ai-data-card">${cats.slice(0,6).map((c,i) =>
        `<div class="ai-data-row">
          <span class="ai-data-label">${i+1}. ${c.name}</span>
          <div style="text-align:right">
            <span class="ai-data-val" style="color:${c.color}">${_fc(c.total)}</span>
            <div style="font-size:10px;color:var(--text-muted)">${total>0?((c.total/total)*100).toFixed(1):0}%</div>
          </div>
        </div>`
      ).join('')}</div>`,
      suggestions: ['Pengeluaran bulan ini', 'Budget yang hampir habis'],
    };
  }

  // ── Budget ────────────────────────────────────────────────────
  function _queryBudget(q) {
    const budgets = DB.getBudgets();
    if (!budgets.length) return { text: 'Kamu belum punya budget. Buat di menu **Budget**!', suggestions: ['Pengeluaran bulan ini'] };

    const now = new Date();
    const rows = budgets.map(b => {
      const cat   = Utils.getCategoryById(b.categoryId);
      const spent = DB.getBudgetSpending(b, now.getFullYear(), now.getMonth());
      const pct   = Math.min(100, (spent / b.amount * 100)).toFixed(0);
      const status = pct >= 100 ? '🔴 Habis' : pct >= 80 ? '🟡 Hampir' : '🟢 Aman';
      return [cat.name, `${_fc(spent)} / ${_fc(b.amount)} (${pct}%) ${status}`];
    });

    const overBudget = budgets.filter(b => {
      const spent = DB.getBudgetSpending(b, now.getFullYear(), now.getMonth());
      return spent >= b.amount;
    });

    return {
      text: overBudget.length
        ? `⚠️ Ada **${overBudget.length} budget** yang sudah habis bulan ini!`
        : 'Status budget bulan ini:',
      html: _dataCard(rows),
      suggestions: ['Kategori terboros', 'Pengeluaran bulan ini'],
    };
  }

  // ── Ringkasan ─────────────────────────────────────────────────
  function _queryRingkasan(q) {
    const { year, month } = _getPeriod(q);
    const summary = DB.getSummary(year, month);
    const wallets = DB.getWallets();
    const totalSaldo = wallets.reduce((s,w) => s+(w.balance||0), 0);
    const label   = `${Utils.getMonthName(month)} ${year}`;
    const rate    = summary.income > 0 ? ((summary.net/summary.income)*100).toFixed(1) : 0;

    return {
      text: `Ringkasan keuangan **${label}**:`,
      html: _dataCard([
        ['Total Saldo', _fc(totalSaldo), 'var(--cyan)'],
        ['Pemasukan', _fc(summary.income), 'var(--green)'],
        ['Pengeluaran', _fc(summary.expense), 'var(--red)'],
        ['Selisih Bersih', _fc(summary.net), summary.net>=0?'var(--teal)':'var(--orange)'],
        ['Saving Rate', rate+'%', rate>=20?'var(--green)':rate>=0?'var(--yellow)':'var(--red)'],
        ['Total Transaksi', summary.count+' transaksi'],
      ]),
      suggestions: ['Kategori terboros', 'Budget yang hampir habis', 'Bandingkan bulan ini vs lalu'],
    };
  }

  // ── Transaksi terakhir ────────────────────────────────────────
  function _queryTerakhir(q) {
    const n    = _match(q, ['5','lima']) ? 5 : _match(q, ['10','sepuluh']) ? 10 : 5;
    const txns = DB.getTransactions().filter(t => !t.isTransfer).slice(0, n);
    if (!txns.length) return { text: 'Belum ada transaksi.', suggestions: ['Catat transaksi'] };

    return {
      text: `**${n} transaksi terakhir** kamu:`,
      html: `<div class="ai-data-card">${txns.map(t => {
        const cat = Utils.getCategoryById(t.categoryId);
        return `<div class="ai-data-row">
          <span class="ai-data-label">${cat.name} · ${Utils.relativeDateStr(t.date)}</span>
          <span class="ai-data-val" style="color:${t.type==='income'?'var(--green)':'var(--red)'}">
            ${t.type==='income'?'+':'-'}${_fc(t.amount)}
          </span>
        </div>`;
      }).join('')}</div>`,
      suggestions: ['Pengeluaran bulan ini', 'Transaksi terbesar'],
    };
  }

  // ── Help ──────────────────────────────────────────────────────
  function _queryHelp() {
    return {
      text: `Halo! Saya **Ditz AI** 👋\n\nSaya bisa membantu kamu dengan:\n\n**Data Keuangan:**\n• Cek saldo dompet\n• Ringkasan pemasukan & pengeluaran\n• Analisis per kategori\n• Status budget\n\n**Kalkulasi:**\n• Penjumlahan, pengurangan, perkalian, pembagian\n• Persentase & konversi\n\n**Aksi:**\n• Catat transaksi langsung via chat\n\nContoh: *"catat makan siang 35rb dari kas"*`,
      suggestions: ['Saldo semua dompet', 'Ringkasan bulan ini', 'Pengeluaran bulan ini', 'Catat transaksi'],
    };
  }

  // ════════════════════════════════════════════════════════════
  // MATH PARSER
  // ════════════════════════════════════════════════════════════
  function _tryMath(q, original) {
    // Deteksi: ada angka dan operator
    const mathTriggers = ['+', '-', 'x', '×', '*', '/', '÷', 'kali', 'bagi', 'tambah', 'kurang', 'persen', '%', 'berapa', 'hitung'];
    if (!mathTriggers.some(t => q.includes(t))) return null;
    if (!(/\d/.test(q))) return null;

    try {
      // Normalize text to math expression
      let expr = q
        .replace(/rb/g, '000')
        .replace(/jt/g, '000000')
        .replace(/ribu/g, '000')
        .replace(/juta/g, '000000')
        .replace(/rp\.?\s*/g, '')
        .replace(/×|x\s/g, '*')
        .replace(/÷|bagi/g, '/')
        .replace(/tambah/g, '+')
        .replace(/kurang/g, '-')
        .replace(/kali/g, '*')
        .replace(/[^0-9+\-*/.() ]/g, ' ')
        .trim();

      // Cari ekspresi matematika
      const match = expr.match(/[\d\s+\-*/.()]+/);
      if (!match) return null;

      const clean = match[0].replace(/\s/g, '').trim();
      if (!clean || clean.length < 3) return null;

      // Evaluasi aman (tanpa eval)
      const result = _safeEval(clean);
      if (result === null || isNaN(result) || !isFinite(result)) return null;

      const formatted = Number.isInteger(result)
        ? _fc(result)
        : _fc(Math.round(result));

      // Cek apakah persen
      if (q.includes('persen') || q.includes('%')) {
        const nums = q.match(/[\d.,]+/g);
        if (nums && nums.length >= 2) {
          const a = parseFloat(nums[0].replace(',','.'));
          const b = parseFloat(nums[1].replace(',','.'));
          const pct = ((a / b) * 100).toFixed(2);
          return {
            text: `**${a.toLocaleString('id-ID')}** adalah **${pct}%** dari **${b.toLocaleString('id-ID')}**`,
            suggestions: ['Saving rate bulan ini', 'Pengeluaran bulan ini'],
          };
        }
      }

      return {
        text: `Hasil perhitungan:`,
        html: _dataCard([
          ['Ekspresi', original.replace(/berapa|hitung|\?/gi,'').trim()],
          ['Hasil', formatted, 'var(--cyan)'],
        ]),
        suggestions: ['Saldo semua dompet', 'Pengeluaran bulan ini'],
      };
    } catch { return null; }
  }

  // Safe math evaluator tanpa eval()
  function _safeEval(expr) {
    const tokens = expr.match(/[\d.]+|[+\-*\/()]/g);
    if (!tokens) return null;
    try {
      // Simple recursive descent parser
      let pos = 0;
      function peek() { return tokens[pos]; }
      function consume() { return tokens[pos++]; }
      function parseExpr() {
        let left = parseTerm();
        while (peek() === '+' || peek() === '-') {
          const op = consume();
          const right = parseTerm();
          left = op === '+' ? left + right : left - right;
        }
        return left;
      }
      function parseTerm() {
        let left = parseFactor();
        while (peek() === '*' || peek() === '/') {
          const op = consume();
          const right = parseFactor();
          left = op === '*' ? left * right : left / right;
        }
        return left;
      }
      function parseFactor() {
        if (peek() === '(') {
          consume(); // (
          const val = parseExpr();
          consume(); // )
          return val;
        }
        return parseFloat(consume());
      }
      return parseExpr();
    } catch { return null; }
  }

  // ════════════════════════════════════════════════════════════
  // TRANSACTION PARSER (catat via chat)
  // ════════════════════════════════════════════════════════════
  function _tryParseTransaction(q, original) {
    // Trigger words
    const triggers = ['catat','tambah','input','beli','bayar','terima','dapat','masuk','keluar','pengeluaran','pemasukan'];
    if (!triggers.some(t => q.includes(t))) return null;
    if (!(/\d/.test(q))) return null;

    // Deteksi amount
    let amount = 0;
    const amountMatch = q.match(/(\d[\d.,]*)\s*(rb|ribu|jt|juta|k)?/);
    if (amountMatch) {
      let num = parseFloat(amountMatch[1].replace(',', '.'));
      const unit = amountMatch[2];
      if (unit === 'rb' || unit === 'ribu' || unit === 'k') num *= 1000;
      if (unit === 'jt' || unit === 'juta') num *= 1000000;
      amount = Math.round(num);
    }
    if (!amount) return null;

    // Deteksi tipe
    const incomeWords  = ['pemasukan','masuk','terima','dapat','gaji','income','income'];
    const expenseWords = ['pengeluaran','keluar','beli','bayar','catat','makan','minum','transport','belanja'];
    const type = incomeWords.some(w => q.includes(w)) ? 'income' : 'expense';

    // Deteksi kategori dari kata kunci
    const cats = DB.getCategories().filter(c => c.type === type);
    let catId  = cats[0]?.id;
    for (const cat of cats) {
      if (q.includes(cat.name.toLowerCase())) { catId = cat.id; break; }
    }
    // Extra keyword matching
    const catKeywords = {
      'makanan':['makan','minum','kopi','lunch','dinner','breakfast','sarapan','siang','nasi','bakso'],
      'transport':['bensin','ojek','grab','gojek','bus','transport','angkot','toll','parkir'],
      'belanja':['beli','belanja','shop','toko','market','mall','alfamart','indomaret'],
      'hiburan':['main','game','nonton','cinema','bioskop','karaoke','hiburan'],
      'kesehatan':['obat','dokter','rumah sakit','apotek','sehat','vitamin'],
    };
    for (const [name, words] of Object.entries(catKeywords)) {
      if (words.some(w => q.includes(w))) {
        const found = cats.find(c => c.name.toLowerCase().includes(name));
        if (found) { catId = found.id; break; }
      }
    }

    // Deteksi wallet
    const wallets = DB.getWallets();
    let walletId  = DB.getActiveWallet().id;
    for (const w of wallets) {
      if (q.includes(w.name.toLowerCase())) { walletId = w.id; break; }
    }

    // Deteksi catatan — ambil teks setelah "untuk" / "buat" / "karena"
    let note = '';
    const noteMatch = q.match(/(?:untuk|buat|karena|notes?)\s+(.+?)(?:\s+dari|\s+ke|\s+di|\s*$)/);
    if (noteMatch) note = noteMatch[1].trim();

    const cat    = Utils.getCategoryById(catId);
    const wallet = Utils.getWalletById(walletId);
    const date   = Utils.todayStr();
    const settings = DB.getSettings();

    // Tampilkan konfirmasi dulu, jangan langsung simpan
    const confirmId = 'ai-confirm-' + Date.now();

    const confirmHTML = `
      ${_dataCard([
        ['Jenis', type === 'income' ? '📈 Pemasukan' : '📉 Pengeluaran'],
        ['Jumlah', _fc(amount), type==='income'?'var(--green)':'var(--red)'],
        ['Kategori', cat.name],
        ['Dompet', wallet.name],
        ['Tanggal', date],
        ['Catatan', note || '-'],
      ])}
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-success btn-sm" style="flex:1" onclick="AIChat.confirmSave('${confirmId}',true)">
          <i class="fa-solid fa-check"></i> Simpan
        </button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="AIChat.confirmSave('${confirmId}',false)">
          <i class="fa-solid fa-xmark"></i> Batal
        </button>
      </div>
    `;

    // Simpan data pending ke memory
    window._aiPendingTxn = window._aiPendingTxn || {};
    window._aiPendingTxn[confirmId] = { type, amount, categoryId: catId, walletId, date, note };

    return {
      text: `Saya akan mencatat transaksi ini, konfirmasi dulu ya:`,
      html: confirmHTML,
      suggestions: [],
    };
  }

  // Konfirmasi save transaksi dari chat
  function confirmSave(confirmId, doSave) {
    const txn = window._aiPendingTxn?.[confirmId];
    if (!txn) return;
    delete window._aiPendingTxn[confirmId];

    // Disable tombol
    document.querySelectorAll(`[onclick*="${confirmId}"]`).forEach(b => b.disabled = true);

    if (doSave) {
      DB.addTransaction(txn);
      App.updateTopbarWallet();
      App.markDirty(['dashboard','history','report','budget','wallet']);
      _appendMessage('ai', `✅ Transaksi **${_fc(txn.amount)}** berhasil dicatat ke **${Utils.getCategoryById(txn.categoryId).name}**!`);
    } else {
      _appendMessage('ai', 'Oke, transaksi dibatalkan.');
    }
    _renderSuggestions();
  }

  return { toggle, send, sendChip, clearHistory, confirmSave };
})();

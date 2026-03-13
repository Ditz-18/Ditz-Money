
const App = (() => {
  let currentPage = 'dashboard';
  let pinVerified = false;

  // Cache: track which pages have been rendered & their data fingerprint
  const _pageCache = {};
  const _pageDirty = {};  // pages that need re-render due to data change

  const pages = {
    dashboard:   { title: 'Dashboard',           render: () => Dashboard.render() },
    transaction: { title: 'Catat Transaksi',      render: () => TransactionPage.render() },
    scan:        { title: 'Scan Struk',            render: () => ScanPage.render() },
    history:     { title: 'Riwayat',              render: () => HistoryPage.render() },
    report:      { title: 'Laporan',              render: () => ReportPage.render() },
    budget:      { title: 'Budget Planner',       render: () => BudgetPage.render() },
    wallet:      { title: 'Dompet',               render: () => WalletPage.render() },
    category:    { title: 'Kategori',             render: () => CategoryPage.render() },
    recurring:   { title: 'Transaksi Rutin',      render: () => RecurringPage.render() },
    splitbill:   { title: 'Split Bill',            render: () => SplitBillPage.render() },
    notes:       { title: 'Catatan',               render: () => NotesPage.render() },
    goals:        { title: 'Target Tabungan',        render: () => GoalsPage.render() },
    installment:  { title: 'Cicilan Tracker',         render: () => InstallmentPage.render() },
    networth:     { title: 'Net Worth',                render: () => NetWorthPage.render() },
    help:         { title: 'Panduan & Bantuan',        render: () => HelpPage.render() },
    backup:       { title: 'Backup & Restore',        render: () => BackupPage.render() },
    settings:    { title: 'Pengaturan',           render: () => SettingsPage.render() },
  };

  // Pages that always re-render (real-time data critical)
  const _alwaysRender = new Set(['dashboard', 'transaction', 'history']);

  // Mark pages as dirty (needs re-render) when data changes
  function markDirty(pages) {
    (pages || Object.keys(_pageCache)).forEach(p => { _pageDirty[p] = true; });
  }

  // Track apakah ada form yang belum disimpan
  let _formDirty = false;

  function setFormDirty(val) { _formDirty = val; }

  function init() {
    DB.processRecurring();

    const settings = DB.getSettings();
    document.title = (settings.appName || 'Ditz Money') + ' - Laporan Keuangan';

    if (settings.pinEnabled && settings.pin) {
      _showPinScreen();
    } else {
      _startApp();
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    window._deferredPWAPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      window._deferredPWAPrompt = e;
    });

    window.addEventListener('appinstalled', () => {
      window._deferredPWAPrompt = null;
      Utils.toast('Ditz Money berhasil diinstall!', 'success');
      const btn   = document.getElementById('pwa-install-btn');
      const title = document.getElementById('pwa-install-title');
      const desc  = document.getElementById('pwa-install-desc');
      const icon  = document.getElementById('pwa-install-icon');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Terinstall';
        btn.className = 'btn btn-ghost btn-sm';
        btn.disabled  = true;
        btn.style.color = 'var(--green)';
      }
      if (title) title.textContent = 'Sudah Terinstall';
      if (desc)  desc.textContent  = 'Ditz Money sudah terpasang di layar utama';
      if (icon)  icon.innerHTML    = '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i>';
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });

    // ── Konfirmasi sebelum keluar ──────────────────────────
    // Browser/tab ditutup atau refresh
    window.addEventListener('beforeunload', e => {
      // Hanya tampilkan jika ada form yang belum disimpan atau ada transaksi hari ini
      const hasTodayTxn = DB.getTransactions().some(t => t.date === Utils.todayStr());
      if (_formDirty || hasTodayTxn) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
        return '';
      }
    });

    // Android back button (PWA)
    window.addEventListener('popstate', e => {
      _handleBackButton();
    });

    // Push initial state so popstate fires on back
    history.pushState({ page: 'app' }, '', window.location.href);
  }

  function _showPinScreen() {
    const settings = DB.getSettings();
    const overlay  = document.createElement('div');
    overlay.id     = 'pin-screen';
    overlay.style.cssText = `position:fixed;inset:0;background:var(--bg-base);display:flex;align-items:center;justify-content:center;z-index:9999`;
    overlay.innerHTML = `
      <div style="text-align:center;max-width:320px;width:100%;padding:24px">
        <img src="https://d.top4top.io/p_3721v7lxr0.png" alt="Ditz Money" style="width:72px;height:72px;border-radius:var(--radius-xl);object-fit:cover;margin:0 auto 20px;display:block;box-shadow:0 0 30px rgba(0,229,255,.3)">
        <div style="font-family:var(--font-display);font-size:24px;font-weight:800;margin-bottom:8px">${settings.appName || 'Ditz Money'}</div>
        <div class="text-muted text-sm mb-20">Masukkan PIN untuk membuka aplikasi</div>
        <input type="password" id="pin-input" class="form-control" maxlength="4"
          style="text-align:center;letter-spacing:16px;font-size:28px;padding:16px;margin-bottom:16px"
          placeholder="••••" autofocus>
        <button class="btn btn-primary" style="width:100%" onclick="App.checkPin()">
          <i class="fa-solid fa-unlock"></i> Buka
        </button>
        <div id="pin-error" style="color:var(--red);font-size:13px;margin-top:12px;display:none">PIN salah, coba lagi</div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('pin-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') checkPin();
    });
  }

  function checkPin() {
    const settings = DB.getSettings();
    const input    = document.getElementById('pin-input').value;
    if (input === settings.pin) {
      document.getElementById('pin-screen').remove();
      pinVerified = true;
      _startApp();
    } else {
      document.getElementById('pin-error').style.display = 'block';
      document.getElementById('pin-input').value = '';
      document.getElementById('pin-input').focus();
    }
  }

  function _startApp() {
    // Cek apakah user baru (belum pernah onboarding)
    const hasOnboarded = localStorage.getItem('ditz_onboarded');
    if (!hasOnboarded) {
      _showOnboarding();
      return;
    }
    updateTopbarWallet();
    navigate('dashboard');
    _bindNavEvents();
    _updateAppName();
  }

  function _showOnboarding() {
    const settings = DB.getSettings();
    const appName  = settings.appName || 'Ditz Money';

    const slides = [
      {
        icon:    'https://d.top4top.io/p_3721v7lxr0.png',
        isLogo:  true,
        title:   `Selamat datang di\n${appName}`,
        desc:    'Aplikasi pencatatan keuangan pribadi yang lengkap, cepat, dan mudah digunakan.',
        color:   'var(--cyan)',
      },
      {
        icon:  'fa-wallet',
        title: 'Kelola Dompet',
        desc:  'Catat saldo dari berbagai sumber — kas, bank, e-wallet. Semua terpantau dalam satu tempat.',
        color: 'var(--teal)',
      },
      {
        icon:  'fa-arrow-trend-down',
        title: 'Catat Transaksi',
        desc:  'Catat pengeluaran dan pemasukan dengan mudah. Bisa juga via chat AI langsung!',
        color: 'var(--green)',
      },
      {
        icon:  'fa-chart-pie',
        title: 'Analisis Keuangan',
        desc:  'Lihat laporan, grafik, dan breakdown kategori untuk memahami pola keuanganmu.',
        color: 'var(--purple)',
      },
      {
        icon:  'fa-bullseye',
        title: 'Budget & Kontrol',
        desc:  'Buat budget per kategori, pantau pengeluaran, dan hindari overspending.',
        color: 'var(--orange)',
      },
      {
        icon:  'fa-robot',
        title: 'Ditz AI',
        desc:  'Tanya apapun soal keuanganmu ke Ditz AI — saldo, laporan, kalkulasi, bahkan catat transaksi via chat!',
        color: '#7c3aed',
      },
      {
        icon:  'fa-cloud-arrow-up',
        title: 'Data Aman & Offline',
        desc:  'Semua data tersimpan di perangkatmu. Backup & restore kapan saja. Bisa diinstall sebagai app.',
        color: 'var(--blue)',
      },
    ];

    const overlay = document.createElement('div');
    overlay.id    = 'onboarding-screen';
    overlay.innerHTML = `
      <div class="onb-container">
        <!-- Slides -->
        <div class="onb-slides" id="onb-slides">
          ${slides.map((s, i) => `
            <div class="onb-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
              <div class="onb-icon-wrap" style="--slide-color:${s.color}">
                ${s.isLogo
                  ? `<img src="${s.icon}" alt="${appName}" class="onb-logo-img">`
                  : `<i class="fa-solid ${s.icon}" style="color:${s.color}"></i>`
                }
              </div>
              <h2 class="onb-title">${s.title.replace('\n','<br>')}</h2>
              <p class="onb-desc">${s.desc}</p>
            </div>
          `).join('')}
        </div>

        <!-- Dots -->
        <div class="onb-dots" id="onb-dots">
          ${slides.map((_, i) => `
            <div class="onb-dot ${i === 0 ? 'active' : ''}" onclick="App.onbGoTo(${i})"></div>
          `).join('')}
        </div>

        <!-- Buttons -->
        <div class="onb-actions">
          <button class="btn btn-ghost onb-skip-btn" id="onb-skip-btn" onclick="App.onbFinish()">
            Lewati
          </button>
          <button class="btn btn-primary onb-next-btn" id="onb-next-btn" onclick="App.onbNext()">
            Mulai <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>

        <!-- Progress bar -->
        <div class="onb-progress">
          <div class="onb-progress-fill" id="onb-progress-fill" style="width:${(1/slides.length)*100}%"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    _bindNavEvents(); // bind nav dulu supaya ready setelah onboarding
    _updateAppName();

    // Swipe support
    let touchStartX = 0;
    overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) diff > 0 ? App.onbNext() : App.onbPrev();
    });

    // Store total slides
    overlay.dataset.total = slides.length;
    overlay.dataset.current = 0;
  }

  function onbGoTo(index) {
    const overlay = document.getElementById('onboarding-screen');
    if (!overlay) return;
    const total   = +overlay.dataset.total;
    const current = +overlay.dataset.current;
    if (index < 0 || index >= total) return;

    // Slide animation direction
    const direction = index > current ? 'left' : 'right';
    const allSlides = overlay.querySelectorAll('.onb-slide');
    const allDots   = overlay.querySelectorAll('.onb-dot');

    allSlides[current].classList.remove('active');
    allSlides[current].classList.add(direction === 'left' ? 'exit-left' : 'exit-right');

    setTimeout(() => {
      allSlides[current].classList.remove('exit-left', 'exit-right');
    }, 300);

    allSlides[index].classList.add(direction === 'left' ? 'enter-right' : 'enter-left');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        allSlides[index].classList.remove('enter-right', 'enter-left');
        allSlides[index].classList.add('active');
      });
    });

    allDots.forEach((d, i) => d.classList.toggle('active', i === index));
    overlay.dataset.current = index;

    // Update progress
    const fill = document.getElementById('onb-progress-fill');
    if (fill) fill.style.width = ((index + 1) / total * 100) + '%';

    // Update button label
    const nextBtn  = document.getElementById('onb-next-btn');
    const skipBtn  = document.getElementById('onb-skip-btn');
    const isLast   = index === total - 1;
    if (nextBtn) nextBtn.innerHTML = isLast
      ? '<i class="fa-solid fa-check"></i> Mulai Sekarang'
      : 'Lanjut <i class="fa-solid fa-arrow-right"></i>';
    if (skipBtn) skipBtn.style.opacity = isLast ? '0' : '1';
  }

  function onbNext() {
    const overlay = document.getElementById('onboarding-screen');
    if (!overlay) return;
    const current = +overlay.dataset.current;
    const total   = +overlay.dataset.total;
    if (current >= total - 1) { onbFinish(); return; }
    onbGoTo(current + 1);
  }

  function onbPrev() {
    const overlay = document.getElementById('onboarding-screen');
    if (!overlay) return;
    onbGoTo(+overlay.dataset.current - 1);
  }

  function onbFinish() {
    const overlay = document.getElementById('onboarding-screen');
    if (!overlay) return;

    // Animate out
    overlay.style.transition = 'opacity .4s ease, transform .4s ease';
    overlay.style.opacity    = '0';
    overlay.style.transform  = 'scale(1.04)';

    setTimeout(() => {
      overlay.remove();
      localStorage.setItem('ditz_onboarded', '1');
      updateTopbarWallet();
      navigate('dashboard');
    }, 400);
  }

  function _updateAppName() {
    const settings = DB.getSettings();
    const name = settings.appName || 'Ditz Money';
    const logoText = document.querySelector('.sidebar-logo .logo-text');
    if (logoText) logoText.textContent = name;
    document.title = name + ' - Laporan Keuangan';
  }

  function _bindNavEvents() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.page));
    });
    document.querySelectorAll('.bottom-nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.page));
    });

    const fabToggle   = document.getElementById('fab-toggle');
    const fabMore     = document.getElementById('fab-more');
    const fabBackdrop = document.getElementById('fab-backdrop');
    const fabIcon     = document.getElementById('fab-icon');

    if (fabToggle) {
      fabToggle.addEventListener('click', () => {
        const isOpen = fabMore.classList.contains('open');
        if (isOpen) { _closeFab(); } else {
          fabMore.classList.add('open');
          fabBackdrop.classList.add('open');
          fabToggle.classList.add('open');
          fabIcon.style.transform = 'rotate(45deg)';
        }
      });
    }
    document.querySelectorAll('.fab-item[data-page]').forEach(item => {
      item.addEventListener('click', () => { navigate(item.dataset.page); _closeFab(); });
    });
  }

  function _closeFab() {
    const fabMore     = document.getElementById('fab-more');
    const fabBackdrop = document.getElementById('fab-backdrop');
    const fabToggle   = document.getElementById('fab-toggle');
    const fabIcon     = document.getElementById('fab-icon');
    if (fabMore)     fabMore.classList.remove('open');
    if (fabBackdrop) fabBackdrop.classList.remove('open');
    if (fabToggle)   fabToggle.classList.remove('open');
    if (fabIcon)     fabIcon.style.transform = '';
  }

  function closeFab() { _closeFab(); }

  function navigate(page) {
    if (!pages[page]) return;
    currentPage = page;

    // Show loading skeleton only if page not yet cached
    const pageEl = document.getElementById('page-' + page);

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if (pageEl) pageEl.classList.add('active');

    // Update nav active states
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle) topbarTitle.textContent = pages[page].title;

    // Lazy load: render only if not cached OR dirty OR always-render page
    const needsRender = !_pageCache[page] || _pageDirty[page] || _alwaysRender.has(page);

    if (needsRender) {
      // Show skeleton for non-cached pages (first load feel)
      if (!_pageCache[page] && pageEl && pageEl.innerHTML.trim() === '') {
        pageEl.innerHTML = `<div style="padding:24px"><div class="loading-spinner"></div></div>`;
      }
      // Defer render slightly so UI updates first (smooth transition feel)
      requestAnimationFrame(() => {
        pages[page].render();
        _pageCache[page] = true;
        _pageDirty[page] = false;
      });
    }

    const content = document.querySelector('.page-content');
    if (content) content.scrollTo(0, 0);
    _closeFab();
  }

  function updateTopbarWallet() {
    const wallet   = DB.getActiveWallet();
    const settings = DB.getSettings();
    const badge    = document.getElementById('topbar-wallet-badge');
    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-wallet"></i> ${wallet.name}: ${Utils.formatCurrency(wallet.balance || 0, settings)}`;
    }
    // Mark data-sensitive pages dirty when wallet changes
    markDirty(['dashboard', 'report', 'budget', 'wallet', 'history']);
  }

  function _handleBackButton() {
    // Jika ada modal terbuka, tutup dulu
    const openModal = document.querySelector('.modal-overlay.open');
    if (openModal) {
      openModal.classList.remove('open');
      history.pushState({ page: 'app' }, '', window.location.href);
      return;
    }

    // Jika AI chat terbuka, tutup dulu
    const aiPanel = document.getElementById('ai-chat-panel');
    if (aiPanel && aiPanel.classList.contains('open')) {
      AIChat.toggle();
      history.pushState({ page: 'app' }, '', window.location.href);
      return;
    }

    // Jika FAB menu terbuka, tutup dulu
    const fabMore = document.getElementById('fab-more');
    if (fabMore && fabMore.classList.contains('open')) {
      _closeFab();
      history.pushState({ page: 'app' }, '', window.location.href);
      return;
    }

    // Jika bukan di dashboard, kembali ke dashboard
    if (currentPage !== 'dashboard') {
      navigate('dashboard');
      history.pushState({ page: 'app' }, '', window.location.href);
      return;
    }

    // Sudah di dashboard — tampilkan konfirmasi keluar
    _showExitConfirm();
    history.pushState({ page: 'app' }, '', window.location.href);
  }

  function _showExitConfirm() {
    // Hindari double dialog
    if (document.getElementById('exit-confirm-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id    = 'exit-confirm-overlay';
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="confirm-dialog" style="text-align:center">
        <div class="confirm-icon" style="font-size:44px;margin-bottom:16px">
          <i class="fa-solid fa-right-from-bracket" style="color:var(--orange)"></i>
        </div>
        <div class="confirm-title">Keluar dari Aplikasi?</div>
        <div class="confirm-msg" style="margin-bottom:24px">
          Pastikan semua transaksi sudah tercatat sebelum keluar.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-danger" onclick="App.confirmExit()">
            <i class="fa-solid fa-right-from-bracket"></i> Ya, Keluar
          </button>
          <button class="btn btn-ghost" onclick="App.cancelExit()">
            <i class="fa-solid fa-xmark"></i> Batal, Tetap di App
          </button>
        </div>
      </div>
    `;

    // Tap backdrop to cancel
    overlay.addEventListener('click', e => {
      if (e.target === overlay) App.cancelExit();
    });

    document.body.appendChild(overlay);
  }

  function confirmExit() {
    const overlay = document.getElementById('exit-confirm-overlay');
    if (overlay) overlay.remove();

    // Coba minimize PWA (Android)
    if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
      // Di PWA: gunakan history back sebanyak mungkin untuk minimize
      history.go(-(history.length + 1));
      return;
    }

    // Di browser biasa: tampilkan instruksi tutup manual
    _showCloseInstruction();
  }

  function _showCloseInstruction() {
    if (document.getElementById('close-instruction-overlay')) return;

    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);

    let instruction = '';
    if (isAndroid) {
      instruction = 'Tekan tombol <strong>Recent Apps</strong> lalu swipe app untuk menutup, atau tekan tombol <strong>Back</strong> di browser.';
    } else if (isIOS) {
      instruction = 'Swipe ke atas dari bawah layar lalu swipe app ke atas untuk menutup.';
    } else {
      instruction = 'Tutup tab ini dengan menekan <strong>Ctrl+W</strong> (Windows) atau <strong>Cmd+W</strong> (Mac).';
    }

    const overlay = document.createElement('div');
    overlay.id    = 'close-instruction-overlay';
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="confirm-dialog" style="text-align:center">
        <div style="font-size:44px;margin-bottom:16px">
          <i class="fa-solid fa-circle-info" style="color:var(--cyan)"></i>
        </div>
        <div class="confirm-title" style="margin-bottom:10px">Cara Menutup App</div>
        <div class="confirm-msg" style="margin-bottom:24px;line-height:1.7">
          ${instruction}
        </div>
        <button class="btn btn-primary" style="width:100%" onclick="App.cancelExit()">
          <i class="fa-solid fa-arrow-left"></i> Kembali ke App
        </button>
      </div>
    `;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) App.cancelExit();
    });
    document.body.appendChild(overlay);
  }

  function cancelExit() {
    ['exit-confirm-overlay', 'close-instruction-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.opacity = '0';
        el.style.transition = 'opacity .2s';
        setTimeout(() => el.remove(), 200);
      }
    });
  }

  return { init, navigate, checkPin, updateTopbarWallet, closeFab, markDirty,
           onbNext, onbPrev, onbGoTo, onbFinish,
           confirmExit, cancelExit, setFormDirty };
})();

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
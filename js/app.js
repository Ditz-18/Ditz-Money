/**
 * FinTrack - Main App, Router, PWA
 */

const App = (() => {
  let currentPage = 'dashboard';
  let pinVerified = false;
  
  const pages = {
    dashboard: { title: 'Dashboard', render: () => Dashboard.render() },
    transaction: { title: 'Catat Transaksi', render: () => TransactionPage.render() },
    history: { title: 'Riwayat', render: () => HistoryPage.render() },
    report: { title: 'Laporan', render: () => ReportPage.render() },
    budget: { title: 'Budget Planner', render: () => BudgetPage.render() },
    wallet: { title: 'Dompet', render: () => WalletPage.render() },
    category: { title: 'Kategori', render: () => CategoryPage.render() },
    recurring: { title: 'Transaksi Rutin', render: () => RecurringPage.render() },
    backup: { title: 'Backup & Restore', render: () => BackupPage.render() },
    settings: { title: 'Pengaturan', render: () => SettingsPage.render() },
  };
  
  function init() {
    // Process recurring transactions
    DB.processRecurring();
    
    // Init app name
    const settings = DB.getSettings();
    document.title = (settings.appName || 'Ditz Money') + ' - Laporan Keuangan';
    
    // Check PIN
    if (settings.pinEnabled && settings.pin) {
      _showPinScreen();
    } else {
      _startApp();
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    
    // PWA install prompt — capture and store globally
    window._deferredPWAPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      window._deferredPWAPrompt = e;
    });
    
    // When installed, update settings button if open
    window.addEventListener('appinstalled', () => {
      window._deferredPWAPrompt = null;
      Utils.toast('Ditz Money berhasil diinstall!', 'success');
      const btn = document.getElementById('pwa-install-btn');
      const title = document.getElementById('pwa-install-title');
      const desc = document.getElementById('pwa-install-desc');
      const icon = document.getElementById('pwa-install-icon');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Terinstall';
        btn.className = 'btn btn-ghost btn-sm';
        btn.disabled = true;
        btn.style.color = 'var(--green)';
      }
      if (title) title.textContent = 'Sudah Terinstall';
      if (desc) desc.textContent = 'Ditz Money sudah terpasang di layar utama';
      if (icon) icon.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i>';
    });
    
    // Close modal on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });
  }
  
  function _showPinScreen() {
    const settings = DB.getSettings();
    const overlay = document.createElement('div');
    overlay.id = 'pin-screen';
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
    const input = document.getElementById('pin-input').value;
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
    updateTopbarWallet();
    navigate('dashboard');
    _bindNavEvents();
    _updateAppName();
  }
  
  function _updateAppName() {
    const settings = DB.getSettings();
    const name = settings.appName || 'Ditz Money';
    const logoText = document.querySelector('.sidebar-logo .logo-text');
    if (logoText) logoText.textContent = name;
    document.title = name + ' - Laporan Keuangan';
  }
  
  function _bindNavEvents() {
    // Sidebar nav
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.page));
    });
    
    // Bottom nav
    document.querySelectorAll('.bottom-nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.page));
    });
    
    // FAB toggle
    const fabToggle = document.getElementById('fab-toggle');
    const fabMore = document.getElementById('fab-more');
    const fabBackdrop = document.getElementById('fab-backdrop');
    const fabIcon = document.getElementById('fab-icon');
    
    if (fabToggle) {
      fabToggle.addEventListener('click', () => {
        const isOpen = fabMore.classList.contains('open');
        if (isOpen) {
          _closeFab();
        } else {
          fabMore.classList.add('open');
          fabBackdrop.classList.add('open');
          fabToggle.classList.add('open');
          fabIcon.style.transform = 'rotate(45deg)';
        }
      });
    }
    
    document.querySelectorAll('.fab-item[data-page]').forEach(item => {
      item.addEventListener('click', () => {
        navigate(item.dataset.page);
        _closeFab();
      });
    });
  }
  
  function _closeFab() {
    const fabMore = document.getElementById('fab-more');
    const fabBackdrop = document.getElementById('fab-backdrop');
    const fabToggle = document.getElementById('fab-toggle');
    const fabIcon = document.getElementById('fab-icon');
    if (fabMore) fabMore.classList.remove('open');
    if (fabBackdrop) fabBackdrop.classList.remove('open');
    if (fabToggle) fabToggle.classList.remove('open');
    if (fabIcon) fabIcon.style.transform = '';
  }
  
  function closeFab() { _closeFab(); }
  
  function navigate(page) {
    if (!pages[page]) return;
    currentPage = page;
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Show target page
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
    
    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update topbar title
    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle) topbarTitle.textContent = pages[page].title;
    
    // Render page
    pages[page].render();
    
    // Scroll to top
    const content = document.querySelector('.page-content');
    if (content) content.scrollTo(0, 0);
    
    // Close FAB when navigating
    _closeFab();
  }
  
  function updateTopbarWallet() {
    const wallet = DB.getActiveWallet();
    const settings = DB.getSettings();
    const badge = document.getElementById('topbar-wallet-badge');
    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-wallet"></i> ${wallet.name}: ${Utils.formatCurrency(wallet.balance || 0, settings)}`;
    }
  }
  
  return { init, navigate, checkPin, updateTopbarWallet, closeFab };
})();

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
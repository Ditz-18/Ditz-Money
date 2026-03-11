
const Utils = (() => {

  // --- Currency Formatter ---
  function formatCurrency(amount, settings) {
    settings = settings || DB.getSettings();
    const locale   = settings.locale   || 'id-ID';
    const currency = settings.currency || 'IDR';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency,
        minimumFractionDigits: currency === 'IDR' ? 0 : 2,
        maximumFractionDigits: currency === 'IDR' ? 0 : 2,
      }).format(amount);
    } catch {
      return currency + ' ' + amount.toLocaleString();
    }
  }

  // --- Date helpers ---
  function formatDate(dateStr, format) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return '-';
    const settings = DB.getSettings();
    if (format === 'short') {
      return d.toLocaleDateString(settings.locale || 'id-ID', { day: 'numeric', month: 'short' });
    }
    if (format === 'long') {
      return d.toLocaleDateString(settings.locale || 'id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    return d.toLocaleDateString(settings.locale || 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getMonthName(month, short) {
    const names = short
      ? ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
      : ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return names[month];
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function relativeDateStr(dateStr) {
    const d = new Date(dateStr);
    const today = new Date(); today.setHours(0,0,0,0);
    d.setHours(0,0,0,0);
    const diff = Math.round((today - d) / 86400000);
    if (diff === 0) return 'Hari ini';
    if (diff === 1) return 'Kemarin';
    if (diff < 7)  return diff + ' hari lalu';
    return formatDate(dateStr);
  }

  // --- Number helpers ---
  function parseAmount(str) {
    return parseFloat(str.toString().replace(/[^0-9.]/g, '')) || 0;
  }

  function formatShortNumber(n) {
    if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'M';
    if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'jt';
    if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'rb';
    return n.toString();
  }

  function percentChange(current, previous) {
    if (!previous) return null;
    return ((current - previous) / previous * 100).toFixed(1);
  }

  // --- DOM helpers ---
  function el(selector) { return document.querySelector(selector); }
  function els(selector) { return document.querySelectorAll(selector); }

  function createElement(tag, attrs, children) {
    const elem = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') elem.className = v;
      else if (k === 'html') elem.innerHTML = v;
      else if (k === 'text') elem.textContent = v;
      else elem.setAttribute(k, v);
    });
    if (children) children.forEach(c => c && elem.appendChild(c));
    return elem;
  }

  function emptyElement(el) { el.innerHTML = ''; }

  // --- Toast ---
  function toast(message, type = 'default', duration = 3000) {
    const container = document.getElementById('toast-container');
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', default: 'fa-circle-info' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fa-solid ${icons[type] || icons.default}"></i> <span>${message}</span>`;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(40px)';
      t.style.transition = 'all .3s ease';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  // --- Modal helpers ---
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('open');
  }
  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('open');
  }
  function confirm(title, message, onConfirm, type = 'danger') {
    const icons  = { danger: 'fa-triangle-exclamation', warning: 'fa-circle-question', info: 'fa-circle-info' };
    const colors = { danger: 'var(--red)', warning: 'var(--yellow)', info: 'var(--cyan)' };
    const overlay = document.getElementById('confirm-modal');
    overlay.querySelector('.confirm-icon').innerHTML = `<i class="fa-solid ${icons[type]}" style="color:${colors[type]}"></i>`;
    overlay.querySelector('.confirm-title').textContent = title;
    overlay.querySelector('.confirm-msg').textContent   = message;
    const btn = overlay.querySelector('#confirm-ok-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => { closeModal('confirm-modal'); onConfirm(); };
    openModal('confirm-modal');
  }

  // --- String helpers ---
  function slugify(str) {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '...' : str;
  }

  // --- ID generator ---
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // --- Color contrast ---
  function needsDarkText(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  }

  // --- Category by id ---
  function getCategoryById(id) {
    return DB.getCategories().find(c => c.id === id) || { name: 'Lainnya', color: '#8b92b3', icon: 'fa-ellipsis' };
  }
  function getWalletById(id) {
    return DB.getWallets().find(w => w.id === id) || { name: 'Dompet', color: '#8b92b3', icon: 'fa-wallet' };
  }

  // --- CSV export ---
  function transactionsToCSV(txns) {
    const settings = DB.getSettings();
    const header = ['Tanggal','Jenis','Kategori','Dompet','Jumlah','Catatan'];
    const rows = txns.map(t => {
      const cat    = getCategoryById(t.categoryId);
      const wallet = getWalletById(t.walletId);
      return [
        t.date,
        t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        cat.name,
        wallet.name,
        t.amount,
        (t.note || '').replace(/,/g, ';')
      ];
    });
    return [header, ...rows].map(r => r.join(',')).join('\n');
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    formatCurrency, formatDate, getMonthName, todayStr, relativeDateStr,
    parseAmount, formatShortNumber, percentChange,
    el, els, createElement, emptyElement,
    toast, openModal, closeModal, confirm,
    slugify, truncate, uid,
    needsDarkText, getCategoryById, getWalletById,
    transactionsToCSV, downloadFile,
  };
})();

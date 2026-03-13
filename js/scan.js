/**
 * Ditz Money - Scan Struk
 * OCR dengan Tesseract.js + manual edit + simpan ke transaksi
 */

const ScanPage = (() => {

  // State
  let _imageDataUrl  = null;  // full image for display
  let _thumbDataUrl  = null;  // compressed thumbnail for storage
  let _ocrResult     = null;  // parsed receipt data
  let _isProcessing  = false;
  let _editingTxnId  = null;  // jika attach ke transaksi existing

  // ── Render halaman ────────────────────────────────────────
  function render() {
    const container = document.getElementById('page-scan');
    const settings  = DB.getSettings();
    const wallets   = DB.getWallets();
    const cats      = DB.getCategories().filter(c => c.type === 'expense');

    container.innerHTML = `
      <div class="page-header">
        <h1>Scan Struk</h1>
        <button class="btn btn-ghost btn-sm" onclick="App.navigate('history')">
          <i class="fa-solid fa-clock-rotate-left" style="color:var(--yellow)"></i> Riwayat
        </button>
      </div>
      <p class="text-muted text-sm mb-20">Upload foto struk belanja — AI akan membaca item, harga, dan total secara otomatis.</p>

      <!-- Step 1: Upload -->
      <div class="card mb-16" id="scan-upload-section">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-camera" style="color:var(--cyan)"></i> Langkah 1 — Foto Struk</span>
        </div>

        <!-- Drop zone -->
        <div id="scan-dropzone" class="scan-dropzone"
          onclick="document.getElementById('scan-file-input').click()"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="ScanPage.onDrop(event)">
          <div id="scan-preview-wrap" style="display:none">
            <img id="scan-preview-img" class="scan-preview-img">
            <button class="scan-remove-btn" onclick="event.stopPropagation();ScanPage.removeImage()">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div id="scan-dropzone-placeholder">
            <i class="fa-solid fa-camera-retro" style="font-size:40px;color:var(--text-muted);margin-bottom:12px"></i>
            <div style="font-weight:600;margin-bottom:6px">Tap untuk pilih foto</div>
            <div class="text-muted text-sm">Atau drag & drop gambar struk di sini</div>
            <div class="text-muted text-xs" style="margin-top:8px">JPG, PNG, WEBP — Maks 10MB</div>
          </div>
        </div>

        <input type="file" id="scan-file-input" accept="image/*" capture="environment"
          style="display:none" onchange="ScanPage.onFileSelect(event)">

        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn btn-ghost btn-sm" style="flex:1"
            onclick="document.getElementById('scan-file-input').click()">
            <i class="fa-solid fa-image"></i> Galeri
          </button>
          <button class="btn btn-ghost btn-sm" style="flex:1"
            onclick="ScanPage.openCamera()">
            <i class="fa-solid fa-camera"></i> Kamera
          </button>
          <button class="btn btn-primary btn-sm" style="flex:2" id="scan-ocr-btn"
            onclick="ScanPage.runOCR()" disabled>
            <i class="fa-solid fa-wand-magic-sparkles"></i> Baca Otomatis
          </button>
        </div>

        <!-- OCR Progress -->
        <div id="scan-ocr-progress" style="display:none;margin-top:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div class="loading-spinner" style="width:20px;height:20px;border-width:2px;margin:0"></div>
            <span class="text-sm" id="scan-ocr-status">Memuat engine OCR...</span>
          </div>
          <div class="progress-bar" style="height:6px">
            <div class="progress-fill" id="scan-ocr-bar" style="width:0%;background:var(--cyan);transition:width .3s"></div>
          </div>
        </div>
      </div>

      <!-- Step 2: Edit hasil OCR -->
      <div class="card mb-16" id="scan-result-section" style="display:none">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-receipt" style="color:var(--green)"></i> Langkah 2 — Detail Struk</span>
          <button class="btn btn-ghost btn-sm" onclick="ScanPage.resetResult()">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
        </div>

        <!-- Store & date -->
        <div class="form-row mb-16">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Nama Toko / Merchant</label>
            <input type="text" id="receipt-store" class="form-control" placeholder="Nama toko...">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Tanggal</label>
            <input type="date" id="receipt-date" class="form-control" value="${Utils.todayStr()}">
          </div>
        </div>

        <!-- Items table -->
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <label class="form-label" style="margin-bottom:0">Daftar Item</label>
            <button class="btn btn-ghost btn-sm" onclick="ScanPage.addItem()">
              <i class="fa-solid fa-plus" style="color:var(--green)"></i> Tambah Item
            </button>
          </div>
          <div id="receipt-items-list"></div>
        </div>

        <!-- Subtotal, discount, tax, total -->
        <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span class="text-muted text-sm">Subtotal</span>
            <span style="font-family:var(--font-display);font-weight:700" id="receipt-subtotal-display">Rp 0</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span class="text-muted text-sm">Diskon</span>
            <div style="position:relative;width:140px">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px">Rp</span>
              <input type="text" inputmode="numeric" id="receipt-discount" class="form-control"
                style="padding-left:32px;text-align:right;font-size:13px;padding-right:8px"
                placeholder="0" value="0"
                oninput="ScanPage.onAmountInput(this);ScanPage.recalcTotal()"
                onkeydown="return TransactionPage.onAmountKeydown(event)">
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span class="text-muted text-sm">Pajak / Service</span>
            <div style="position:relative;width:140px">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px">Rp</span>
              <input type="text" inputmode="numeric" id="receipt-tax" class="form-control"
                style="padding-left:32px;text-align:right;font-size:13px;padding-right:8px"
                placeholder="0" value="0"
                oninput="ScanPage.onAmountInput(this);ScanPage.recalcTotal()"
                onkeydown="return TransactionPage.onAmountKeydown(event)">
            </div>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700">Total</span>
            <span style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--cyan)" id="receipt-total-display">Rp 0</span>
          </div>
        </div>

        <!-- Catatan -->
        <div class="form-group">
          <label class="form-label">Catatan <span class="text-muted">(opsional)</span></label>
          <input type="text" id="receipt-note" class="form-control" placeholder="Keterangan tambahan...">
        </div>
      </div>

      <!-- Step 3: Simpan ke transaksi -->
      <div class="card mb-16" id="scan-save-section" style="display:none">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-floppy-disk" style="color:var(--purple)"></i> Langkah 3 — Catat Transaksi</span>
        </div>
        <div class="form-row mb-0">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select id="receipt-category" class="form-control">
              ${cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Dompet</label>
            <select id="receipt-wallet" class="form-control">
              ${wallets.map(w => `<option value="${w.id}" ${w.id===DB.getActiveWallet().id?'selected':''}>${w.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-success" style="width:100%;justify-content:center;margin-top:8px"
          onclick="ScanPage.saveReceipt()">
          <i class="fa-solid fa-check"></i> Simpan Transaksi dari Struk
        </button>
      </div>

      <!-- Camera modal -->
      <div class="modal-overlay" id="scan-camera-modal" onclick="if(event.target===this)ScanPage.closeCamera()">
        <div class="modal" style="max-width:480px">
          <div class="modal-header">
            <div class="modal-title"><i class="fa-solid fa-camera" style="color:var(--cyan)"></i> Ambil Foto Struk</div>
            <button class="btn-icon" onclick="ScanPage.closeCamera()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body" style="padding:12px">
            <video id="scan-video" style="width:100%;border-radius:var(--radius-md);background:#000;max-height:60vh" autoplay playsinline></video>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="ScanPage.closeCamera()">Batal</button>
            <button class="btn btn-primary" onclick="ScanPage.capturePhoto()">
              <i class="fa-solid fa-camera"></i> Ambil Foto
            </button>
          </div>
        </div>
      </div>
    `;

    _renderItems();
  }

  // ── Image handling ────────────────────────────────────────
  function onFileSelect(e) {
    const file = e.target.files[0];
    if (file) _loadImage(file);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    document.getElementById('scan-dropzone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) _loadImage(file);
    else Utils.toast('File harus berupa gambar', 'error');
  }

  function _loadImage(file) {
    if (file.size > 10 * 1024 * 1024) { Utils.toast('Ukuran file maks 10MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = async e => {
      _imageDataUrl = e.target.result;
      _thumbDataUrl = await DB.compressImage(_imageDataUrl, 300, 0.6);
      _showPreview(_imageDataUrl);
    };
    reader.readAsDataURL(file);
  }

  function _showPreview(dataUrl) {
    const img  = document.getElementById('scan-preview-img');
    const wrap = document.getElementById('scan-preview-wrap');
    const ph   = document.getElementById('scan-dropzone-placeholder');
    const btn  = document.getElementById('scan-ocr-btn');
    if (img)  img.src = dataUrl;
    if (wrap) wrap.style.display = 'flex';
    if (ph)   ph.style.display   = 'none';
    if (btn)  btn.disabled = false;
  }

  function removeImage() {
    _imageDataUrl = null;
    _thumbDataUrl = null;
    document.getElementById('scan-preview-wrap').style.display   = 'none';
    document.getElementById('scan-dropzone-placeholder').style.display = '';
    document.getElementById('scan-ocr-btn').disabled = true;
    document.getElementById('scan-file-input').value = '';
  }

  // ── Camera ────────────────────────────────────────────────
  let _stream = null;

  function openCamera() {
    Utils.openModal('scan-camera-modal');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        _stream = stream;
        const video = document.getElementById('scan-video');
        if (video) { video.srcObject = stream; video.play(); }
      })
      .catch(() => {
        closeCamera();
        Utils.toast('Tidak bisa akses kamera — coba upload dari galeri', 'warning');
      });
  }

  function closeCamera() {
    if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    Utils.closeModal('scan-camera-modal');
  }

  function capturePhoto() {
    const video  = document.getElementById('scan-video');
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    _imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    DB.compressImage(_imageDataUrl, 300, 0.6).then(thumb => {
      _thumbDataUrl = thumb;
      _showPreview(_imageDataUrl);
      closeCamera();
    });
  }

  // ── OCR ───────────────────────────────────────────────────
  async function runOCR() {
    if (!_imageDataUrl || _isProcessing) return;
    _isProcessing = true;

    const progressEl = document.getElementById('scan-ocr-progress');
    const statusEl   = document.getElementById('scan-ocr-status');
    const barEl      = document.getElementById('scan-ocr-bar');
    const ocrBtn     = document.getElementById('scan-ocr-btn');

    if (progressEl) progressEl.style.display = 'block';
    if (ocrBtn)     ocrBtn.disabled = true;

    try {
      // Load Tesseract.js dynamically
      if (!window.Tesseract) {
        if (statusEl) statusEl.textContent = 'Memuat engine OCR...';
        if (barEl)    barEl.style.width = '10%';
        await _loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      }

      if (statusEl) statusEl.textContent = 'Membaca teks dari gambar...';
      if (barEl)    barEl.style.width = '30%';

      const result = await Tesseract.recognize(_imageDataUrl, 'ind+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 60) + 30;
            if (barEl) barEl.style.width = pct + '%';
            if (statusEl) statusEl.textContent = 'Membaca teks... ' + Math.round((m.progress||0)*100) + '%';
          }
        }
      });

      if (statusEl) statusEl.textContent = 'Menganalisis struk...';
      if (barEl)    barEl.style.width = '95%';

      const parsed = _parseReceiptText(result.data.text);
      _ocrResult   = parsed;
      _fillForm(parsed);

      if (barEl)    barEl.style.width = '100%';
      if (statusEl) statusEl.textContent = 'Selesai!';

      setTimeout(() => {
        if (progressEl) progressEl.style.display = 'none';
      }, 1000);

      Utils.toast(`Berhasil membaca ${parsed.items.length} item dari struk`, 'success');

    } catch(err) {
      if (progressEl) progressEl.style.display = 'none';
      Utils.toast('Gagal membaca struk. Coba isi manual.', 'error');
      // Tetap tampilkan form kosong
      _fillForm({ storeName:'', date: Utils.todayStr(), items:[], subtotal:0, tax:0, discount:0, total:0 });
    } finally {
      _isProcessing = false;
      if (ocrBtn) ocrBtn.disabled = false;
    }
  }

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── Parse OCR text → structured receipt ──────────────────
  function _parseReceiptText(text) {
    const lines   = text.split('\n').map(l => l.trim()).filter(Boolean);
    const items   = [];
    let storeName = '';
    let date      = Utils.todayStr();
    let total     = 0;
    let subtotal  = 0;
    let tax       = 0;
    let discount  = 0;

    // Extract store name (biasanya baris pertama yang panjang & uppercase)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].length > 3 && /[A-Za-z]/.test(lines[i])) {
        storeName = lines[i].replace(/[^a-zA-Z0-9\s&.'-]/g, '').trim();
        if (storeName.length > 2) break;
      }
    }

    // Extract date
    const datePatterns = [
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
      /(\d{2,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
    ];
    for (const line of lines) {
      for (const pat of datePatterns) {
        const m = line.match(pat);
        if (m) {
          try {
            const d = new Date(m[0].replace(/\./g, '/'));
            if (!isNaN(d)) { date = d.toISOString().slice(0,10); break; }
          } catch {}
        }
      }
    }

    // Extract items & prices
    // Pattern: teks ... angka (harga)
    const pricePattern = /^(.+?)\s+([\d.,]{3,})\s*$/;
    const skipWords    = /total|subtotal|sub total|pajak|tax|service|diskon|discount|bayar|kembalian|tunai|change|cash|ppn|pbxx/i;
    const totalWords   = /^(total|grand total|jumlah)/i;
    const taxWords     = /^(pajak|tax|service|ppn|pb1)/i;
    const discWords    = /^(diskon|discount|promo|potongan)/i;
    const subWords     = /^(subtotal|sub total|sub-total)/i;

    for (const line of lines) {
      const m = line.match(pricePattern);
      if (!m) continue;

      const name  = m[1].trim();
      const price = _parseNumber(m[2]);
      if (!price || price < 100) continue;

      if (totalWords.test(name)) { total = price; continue; }
      if (taxWords.test(name))   { tax   = price; continue; }
      if (discWords.test(name))  { discount = price; continue; }
      if (subWords.test(name))   { subtotal = price; continue; }
      if (skipWords.test(name))  continue;

      // Cek apakah ada qty (format: "nama x2 harga" atau "2x nama harga")
      const qtyMatch = name.match(/^(\d+)\s*[xX]\s+(.+)/) || name.match(/^(.+)\s+(\d+)\s*[xX]$/);
      if (qtyMatch) {
        const qty  = parseInt(qtyMatch[1]);
        const nm   = qtyMatch[2] || qtyMatch[1];
        items.push({ name: nm.trim(), qty, price: Math.round(price / (qty||1)), total: price });
      } else {
        items.push({ name, qty: 1, price, total: price });
      }
    }

    // Hitung subtotal dari items jika tidak terdeteksi
    if (!subtotal && items.length) {
      subtotal = items.reduce((s, i) => s + i.total, 0);
    }
    // Hitung total jika tidak terdeteksi
    if (!total) {
      total = subtotal + tax - discount;
    }

    return { storeName, date, items, subtotal, tax, discount, total };
  }

  function _parseNumber(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[.,]/g, '').replace(/\D/g, '')) || 0;
  }

  // ── Fill form dengan hasil OCR ────────────────────────────
  function _fillForm(data) {
    _ocrResult = data;

    document.getElementById('scan-result-section').style.display = '';
    document.getElementById('scan-save-section').style.display   = '';

    const storeEl = document.getElementById('receipt-store');
    const dateEl  = document.getElementById('receipt-date');
    const discEl  = document.getElementById('receipt-discount');
    const taxEl   = document.getElementById('receipt-tax');

    if (storeEl) storeEl.value = data.storeName || '';
    if (dateEl)  dateEl.value  = data.date || Utils.todayStr();
    if (discEl)  discEl.value  = data.discount ? Number(data.discount).toLocaleString('id-ID') : '0';
    if (taxEl)   taxEl.value   = data.tax ? Number(data.tax).toLocaleString('id-ID') : '0';

    _renderItems();
    recalcTotal();
  }

  // ── Items rendering ───────────────────────────────────────
  function _renderItems() {
    const el = document.getElementById('receipt-items-list');
    if (!el || !_ocrResult) return;

    const settings = DB.getSettings();
    const items    = _ocrResult.items || [];

    if (!items.length) {
      el.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">
          <i class="fa-solid fa-receipt" style="font-size:24px;margin-bottom:8px;display:block;opacity:.4"></i>
          Belum ada item. Tap "+ Tambah Item" atau jalankan Baca Otomatis.
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="receipt-items-table">
        <div class="receipt-item-header">
          <span style="flex:1">Nama Item</span>
          <span style="width:50px;text-align:center">Qty</span>
          <span style="width:110px;text-align:right">Harga</span>
          <span style="width:110px;text-align:right">Subtotal</span>
          <span style="width:28px"></span>
        </div>
        ${items.map((item, i) => `
          <div class="receipt-item-row" id="receipt-item-${i}">
            <input type="text" class="receipt-item-name" value="${item.name}"
              onchange="ScanPage.updateItem(${i},'name',this.value)" placeholder="Nama item...">
            <input type="number" class="receipt-item-qty" value="${item.qty||1}" min="1"
              onchange="ScanPage.updateItem(${i},'qty',this.value)">
            <input type="text" inputmode="numeric" class="receipt-item-price"
              value="${Number(item.price||0).toLocaleString('id-ID')}"
              oninput="ScanPage.onAmountInput(this);ScanPage.updateItem(${i},'price',this.value)"
              onkeydown="return TransactionPage.onAmountKeydown(event)">
            <span class="receipt-item-total">${Utils.formatCurrency(item.total||0, settings)}</span>
            <button class="receipt-item-del" onclick="ScanPage.removeItem(${i})">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function addItem() {
    if (!_ocrResult) _ocrResult = { storeName:'', date:Utils.todayStr(), items:[], subtotal:0, tax:0, discount:0, total:0 };
    _ocrResult.items.push({ name:'', qty:1, price:0, total:0 });
    _renderItems();
    recalcTotal();
    // Focus on last item name
    setTimeout(() => {
      const inputs = document.querySelectorAll('.receipt-item-name');
      if (inputs.length) inputs[inputs.length-1].focus();
    }, 50);
  }

  function removeItem(index) {
    if (!_ocrResult) return;
    _ocrResult.items.splice(index, 1);
    _renderItems();
    recalcTotal();
  }

  function updateItem(index, field, value) {
    if (!_ocrResult || !_ocrResult.items[index]) return;
    const item = _ocrResult.items[index];
    if (field === 'name')  { item.name  = value; }
    if (field === 'qty')   { item.qty   = parseInt(value) || 1; item.total = item.price * item.qty; }
    if (field === 'price') {
      item.price = parseInt(value.replace(/[^0-9]/g,''), 10) || 0;
      item.total = item.price * (item.qty || 1);
    }
    // Update total display on row
    const totalEl = document.querySelector(`#receipt-item-${index} .receipt-item-total`);
    if (totalEl) totalEl.textContent = Utils.formatCurrency(item.total, DB.getSettings());
    recalcTotal();
  }

  function recalcTotal() {
    if (!_ocrResult) return;
    const settings  = DB.getSettings();
    const subtotal  = (_ocrResult.items||[]).reduce((s,i) => s+(i.total||0), 0);
    const discount  = parseInt((document.getElementById('receipt-discount')?.value||'0').replace(/[^0-9]/g,''),10)||0;
    const tax       = parseInt((document.getElementById('receipt-tax')?.value||'0').replace(/[^0-9]/g,''),10)||0;
    const total     = subtotal - discount + tax;

    _ocrResult.subtotal  = subtotal;
    _ocrResult.discount  = discount;
    _ocrResult.tax       = tax;
    _ocrResult.total     = Math.max(0, total);

    const subtotalEl = document.getElementById('receipt-subtotal-display');
    const totalEl    = document.getElementById('receipt-total-display');
    if (subtotalEl) subtotalEl.textContent = Utils.formatCurrency(subtotal, settings);
    if (totalEl)    totalEl.textContent    = Utils.formatCurrency(Math.max(0, total), settings);
  }

  function onAmountInput(input) {
    let raw = input.value.replace(/[^0-9]/g, '');
    if (!raw) { input.value = '0'; return; }
    raw = String(parseInt(raw, 10));
    input.value = Number(raw).toLocaleString('id-ID');
  }

  function resetResult() {
    _ocrResult = null;
    document.getElementById('scan-result-section').style.display = 'none';
    document.getElementById('scan-save-section').style.display   = 'none';
  }

  // ── Save receipt → transaction ────────────────────────────
  async function saveReceipt() {
    if (!_ocrResult) { Utils.toast('Belum ada data struk', 'error'); return; }

    const storeName = document.getElementById('receipt-store')?.value.trim() || '';
    const date      = document.getElementById('receipt-date')?.value || Utils.todayStr();
    const catId     = document.getElementById('receipt-category')?.value;
    const walletId  = document.getElementById('receipt-wallet')?.value;
    const note      = document.getElementById('receipt-note')?.value.trim() || '';

    const total = _ocrResult.total || 0;
    if (!total) { Utils.toast('Total struk harus lebih dari 0', 'error'); return; }
    if (!catId)    { Utils.toast('Pilih kategori', 'error'); return; }
    if (!walletId) { Utils.toast('Pilih dompet', 'error'); return; }

    // Simpan transaksi
    const txn = DB.addTransaction({
      type:        'expense',
      amount:      total,
      categoryId:  catId,
      walletId,
      date,
      note:        note || (storeName ? 'Struk: ' + storeName : 'Struk belanja'),
      hasReceipt:  true,
    });

    // Simpan receipt
    DB.addReceipt({
      transactionId: txn.id,
      storeName,
      date,
      items:    _ocrResult.items || [],
      subtotal: _ocrResult.subtotal || 0,
      tax:      _ocrResult.tax      || 0,
      discount: _ocrResult.discount || 0,
      total,
      thumbnail: _thumbDataUrl || null,
      note,
    });

    App.updateTopbarWallet();
    App.markDirty(['dashboard','history','report','budget','wallet']);
    Utils.toast(`Struk ${storeName ? '"'+storeName+'"' : ''} berhasil disimpan!`, 'success');

    // Reset
    removeImage();
    resetResult();
    document.getElementById('receipt-note').value = '';
  }

  // ── Attach struk ke transaksi existing ───────────────────
  function attachToTransaction(txnId) {
    _editingTxnId = txnId;
    App.navigate('scan');
    setTimeout(() => {
      Utils.toast('Upload foto struk lalu tap "Baca Otomatis" atau langsung simpan', 'default');
    }, 300);
  }

  return {
    render, onFileSelect, onDrop, removeImage,
    openCamera, closeCamera, capturePhoto,
    runOCR, addItem, removeItem, updateItem,
    recalcTotal, onAmountInput, resetResult,
    saveReceipt, attachToTransaction,
  };
})();

// ── Receipt Detail Modal ──────────────────────────────────────
const ReceiptModal = (() => {

  function show(txnId) {
    const receipt  = DB.getReceiptByTransactionId(txnId);
    const txn      = DB.getTransactions().find(t => t.id === txnId);
    const settings = DB.getSettings();

    if (!receipt && !txn) return;

    // Build or reuse modal
    let overlay = document.getElementById('receipt-detail-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id        = 'receipt-detail-modal';
      overlay.className = 'modal-overlay';
      overlay.onclick   = e => { if (e.target === overlay) close(); };
      document.body.appendChild(overlay);
    }

    const cat    = txn ? Utils.getCategoryById(txn.categoryId) : null;
    const wallet = txn ? Utils.getWalletById(txn.walletId)     : null;

    overlay.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div class="modal-header" style="border-bottom:3px solid var(--cyan)">
          <div>
            <div class="modal-title">
              <i class="fa-solid fa-receipt" style="color:var(--cyan)"></i>
              ${receipt?.storeName || 'Detail Struk'}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
              ${Utils.formatDate(receipt?.date || txn?.date || '')}
            </div>
          </div>
          <div style="display:flex;gap:6px">
            ${receipt ? `
              <button class="btn-icon" onclick="ScanPage.attachToTransaction('${txnId}')" title="Ganti foto struk">
                <i class="fa-solid fa-camera" style="color:var(--purple)"></i>
              </button>
            ` : `
              <button class="btn btn-ghost btn-sm" onclick="ReceiptModal.close();ScanPage.attachToTransaction('${txnId}')">
                <i class="fa-solid fa-camera"></i> Attach Struk
              </button>
            `}
            <button class="btn-icon" onclick="ReceiptModal.close()"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">

          ${receipt?.thumbnail ? `
            <div style="margin-bottom:16px;text-align:center">
              <img src="${receipt.thumbnail}" alt="Struk"
                style="max-width:100%;max-height:200px;border-radius:var(--radius-md);object-fit:contain;cursor:zoom-in;border:1px solid var(--border)"
                onclick="ReceiptModal.zoomImage('${receipt.thumbnail}')">
              <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Tap untuk perbesar</div>
            </div>
          ` : ''}

          ${txn ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
              <div style="padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md)">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Kategori</div>
                <div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">
                  <i class="fa-solid ${cat?.icon||'fa-tag'}" style="color:${cat?.color||'var(--cyan)'}"></i>
                  ${cat?.name||'-'}
                </div>
              </div>
              <div style="padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md)">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Dompet</div>
                <div style="font-size:13px;font-weight:600">${wallet?.name||'-'}</div>
              </div>
            </div>
          ` : ''}

          ${receipt?.items?.length ? `
            <div style="margin-bottom:16px">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">
                Daftar Item (${receipt.items.length})
              </div>
              <div style="display:flex;flex-direction:column;gap:1px">
                ${receipt.items.map(item => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                    <div style="flex:1;min-width:0">
                      <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</div>
                      ${item.qty > 1 ? `<div style="font-size:11px;color:var(--text-muted)">${item.qty}x @ ${Utils.formatCurrency(item.price, settings)}</div>` : ''}
                    </div>
                    <div style="font-family:var(--font-display);font-weight:700;flex-shrink:0;margin-left:12px">
                      ${Utils.formatCurrency(item.total||item.price, settings)}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:12px">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                <span style="color:var(--text-muted)">Subtotal</span>
                <span>${Utils.formatCurrency(receipt.subtotal||0, settings)}</span>
              </div>
              ${receipt.discount ? `
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                  <span style="color:var(--green)">Diskon</span>
                  <span style="color:var(--green)">-${Utils.formatCurrency(receipt.discount, settings)}</span>
                </div>
              ` : ''}
              ${receipt.tax ? `
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                  <span style="color:var(--text-muted)">Pajak / Service</span>
                  <span>+${Utils.formatCurrency(receipt.tax, settings)}</span>
                </div>
              ` : ''}
              <div style="border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:700">Total</span>
                <span style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--red)">
                  ${Utils.formatCurrency(receipt.total||txn?.amount||0, settings)}
                </span>
              </div>
            </div>
          ` : txn ? `
            <div style="text-align:center;padding:24px;color:var(--text-muted)">
              <i class="fa-solid fa-receipt" style="font-size:32px;margin-bottom:12px;opacity:.4;display:block"></i>
              <p class="text-sm">Tidak ada detail item</p>
              <button class="btn btn-ghost btn-sm" style="margin-top:12px"
                onclick="ReceiptModal.close();ScanPage.attachToTransaction('${txnId}')">
                <i class="fa-solid fa-camera"></i> Upload Struk
              </button>
            </div>
          ` : ''}

          ${receipt?.note ? `
            <div style="margin-top:12px;padding:10px 14px;background:var(--bg-elevated);border-radius:var(--radius-md);font-size:13px;color:var(--text-secondary)">
              <i class="fa-solid fa-note-sticky" style="color:var(--yellow);margin-right:6px"></i>
              ${receipt.note}
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          ${receipt ? `
            <button class="btn btn-ghost btn-sm" onclick="ReceiptModal.deleteReceipt('${receipt.id}','${txnId}')" style="color:var(--red)">
              <i class="fa-solid fa-trash"></i> Hapus Struk
            </button>
          ` : ''}
          <button class="btn btn-primary" onclick="ReceiptModal.close()">Tutup</button>
        </div>
      </div>
    `;

    overlay.classList.add('open');
  }

  function close() {
    const overlay = document.getElementById('receipt-detail-modal');
    if (overlay) overlay.classList.remove('open');
  }

  function zoomImage(src) {
    const zoom = document.createElement('div');
    zoom.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:16px';
    zoom.onclick = () => zoom.remove();
    zoom.innerHTML = `<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:var(--radius-md)">`;
    document.body.appendChild(zoom);
  }

  function deleteReceipt(receiptId, txnId) {
    Utils.confirm('Hapus Struk', 'Foto dan data struk akan dihapus. Transaksi tetap ada.', () => {
      DB.deleteReceipt(receiptId);
      // Update transaksi — hapus flag hasReceipt
      const txn = DB.getTransactions().find(t => t.id === txnId);
      if (txn) DB.updateTransaction(txnId, { hasReceipt: false });
      close();
      Utils.toast('Struk dihapus', 'success');
      App.markDirty(['history']);
    });
  }

  return { show, close, zoomImage, deleteReceipt };
})();

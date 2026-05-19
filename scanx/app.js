/* ═══════════════════════════════════════════
   ScanX — app.js
   Scan · Identify Part Number · Generate
═══════════════════════════════════════════ */

// ─── STATE ────────────────────────────────
const S = {
  torchOn: false,
  facingMode: 'environment',
  history: JSON.parse(localStorage.getItem('scanx-h') || '[]'),
  stream: null,
  reader: null,
  lastScan: null,
  cooldown: false,
  genFormat: 'CODE128',
  genQty: 1,
  genOpts: { prefix: true, checkdigit: false, upper: false, dashes: false },
  lastGenerated: [],
  currentPage: 'page-scan',
};

// ─── FORMAT DEFINITIONS ───────────────────
const FORMATS = {
  CODE128:  { name:'Code 128',     desc:'Logística / Industrial',  len:'Variable',  alpha:true,  jsFmt:'CODE128'  },
  EAN13:    { name:'EAN-13',       desc:'Retail / Supermercado',   len:'13 dígitos',alpha:false, jsFmt:'EAN13'    },
  EAN8:     { name:'EAN-8',        desc:'Productos pequeños',       len:'8 dígitos', alpha:false, jsFmt:'EAN8'     },
  UPCA:     { name:'UPC-A',        desc:'Retail EE.UU.',           len:'12 dígitos',alpha:false, jsFmt:'UPC'      },
  CODE39:   { name:'Code 39',      desc:'Automotriz / Gov.',        len:'Variable',  alpha:true,  jsFmt:'CODE39'   },
  ITF:      { name:'ITF-14',       desc:'Cajas / Pallets',         len:'14 dígitos',alpha:false, jsFmt:'ITF14'    },
  QR:       { name:'QR Code',      desc:'URLs / Texto / Datos',    len:'Variable',  alpha:true,  jsFmt:null       },
  CODABAR:  { name:'Codabar',      desc:'Biblioteca / Médico',     len:'Variable',  alpha:false, jsFmt:'codabar'  },
};

// ─── GS1 COUNTRY PREFIXES ─────────────────
const GS1 = [
  { r:[0,19],   c:'EE.UU. / Canadá',      ind:'Retail general' },
  { r:[20,29],  c:'Uso interno (tienda)',  ind:'Retail interno' },
  { r:[30,37],  c:'Francia',              ind:'Retail / Alimentos' },
  { r:[40,44],  c:'Alemania',             ind:'Manufactura / Retail' },
  { r:[45,49],  c:'Japón',               ind:'Electrónica / Retail' },
  { r:[50,59],  c:'Reino Unido',          ind:'Retail / Alimentos' },
  { r:[60,69],  c:'EE.UU.',              ind:'Retail / CPG' },
  { r:[70,79],  c:'Escandinavia',         ind:'Retail / Pesca' },
  { r:[80,83],  c:'Italia',              ind:'Moda / Retail' },
  { r:[84,84],  c:'España',              ind:'Retail / Alimentos' },
  { r:[85,85],  c:'Cuba',               ind:'Retail' },
  { r:[859,859],c:'República Checa',     ind:'Retail' },
  { r:[869,869],c:'Turquía',            ind:'Retail' },
  { r:[880,880],c:'Corea del Sur',      ind:'Electrónica / Retail' },
  { r:[885,885],c:'Tailandia',          ind:'Retail' },
  { r:[888,888],c:'Singapur',           ind:'Retail / Manufactura' },
  { r:[890,890],c:'India',              ind:'Retail / Farmacéutica' },
  { r:[893,893],c:'Vietnam',            ind:'Retail / Agroindustria' },
  { r:[899,899],c:'Indonesia',          ind:'Retail' },
  { r:[900,919],c:'Austria',            ind:'Retail / Farmacéutica' },
  { r:[930,939],c:'Australia',          ind:'Retail / Alimentos' },
  { r:[940,949],c:'Nueva Zelanda',      ind:'Retail / Agro' },
  { r:[750,759],c:'México',            ind:'Retail / Alimentos / Manufactura' },
  { r:[770,771],c:'Colombia',          ind:'Retail' },
  { r:[773,773],c:'Uruguay',           ind:'Retail' },
  { r:[775,775],c:'Perú',             ind:'Retail' },
  { r:[777,777],c:'Bolivia',           ind:'Retail' },
  { r:[779,779],c:'Argentina',         ind:'Retail / Agro' },
  { r:[780,780],c:'Chile',            ind:'Retail / Agroindustria' },
  { r:[784,784],c:'Paraguay',          ind:'Retail' },
  { r:[786,786],c:'Ecuador',           ind:'Retail / Banana' },
  { r:[789,790],c:'Brasil',           ind:'Retail / Manufactura' },
];

function getGS1(prefix3) {
  const p3 = parseInt(prefix3.substring(0,3));
  const p2 = parseInt(prefix3.substring(0,2));
  for (const g of GS1) {
    if (p3 >= g.r[0] && p3 <= g.r[1]) return g;
  }
  for (const g of GS1) {
    if (p2 >= g.r[0] && p2 <= g.r[1]) return g;
  }
  return { c: 'Internacional', ind: 'Retail general' };
}

// ─── BARCODE FORMAT ICONS ─────────────────
const FMT_ICONS = {
  QR_CODE:'◉', EAN_13:'▋▋', EAN_8:'▌▌', CODE_128:'╎╎',
  CODE_39:'║║', UPC_A:'⚊⚊', UPC_E:'⚋⚋', ITF:'⏸',
  DATA_MATRIX:'⊞', PDF_417:'▤', AZTEC:'◈', CODABAR:'⑃',
};
const FMT_LABELS = {
  QR_CODE:'QR Code', EAN_13:'EAN-13', EAN_8:'EAN-8', CODE_128:'Code 128',
  CODE_39:'Code 39', UPC_A:'UPC-A', UPC_E:'UPC-E', ITF:'ITF',
  DATA_MATRIX:'Data Matrix', PDF_417:'PDF 417', AZTEC:'Aztec', CODABAR:'Codabar',
};

// ─── DOM SHORTCUTS ────────────────────────
const $  = id => document.getElementById(id);
const qs = s  => document.querySelector(s);

// ─── TABS ─────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const page = $( tab.dataset.page );
    if (page) page.classList.add('active');
    S.currentPage = tab.dataset.page;
  });
});

// ─── HEADER BUTTONS ───────────────────────
$('h-torch').onclick = toggleTorch;
$('h-flip').onclick  = flipCamera;
$('h-clear').onclick = clearHistory;
$('c-torch').onclick = toggleTorch;
$('c-flip').onclick  = flipCamera;

// ─── CAMERA ───────────────────────────────
async function initCamera() {
  setSbar('INICIANDO...', '');
  $('no-cam').classList.remove('show');
  $('scanner-wrap').style.display = '';

  // Detener decoder y stream previos
  _stopDecoder();
  if (S.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; }

  // Constraints específicos para Safari iOS
  // iOS requiere exactamente { video: true } o facingMode simple para el primer intento
  const constraints = {
    video: {
      facingMode: S.facingMode,   // Safari prefiere string simple, no { ideal: }
      width:  { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720,  max: 1080 },
    },
    audio: false,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    S.stream = stream;
    const vid = $('video');
    vid.srcObject = stream;
    // Safari iOS necesita el atributo playsinline y llamar play() dentro de un evento de usuario
    // pero desde initCamera (click del usuario) funciona si usamos el promise de play
    vid.setAttribute('playsinline', true);
    vid.setAttribute('muted', true);
    vid.muted = true;
    await vid.play();
    setSbar('ESCANEANDO', 'scanning');
    // Esperar un frame antes de iniciar el decoder (Safari necesita que el video tenga dimensiones)
    requestAnimationFrame(() => requestAnimationFrame(startDecoder));
  } catch(err) {
    console.error('Camera error:', err.name, err.message);
    // Segundo intento con constraints mínimos (Safari muy restrictivo a veces)
    if (err.name === 'OverconstrainedError' || err.name === 'NotReadableError') {
      try {
        const stream2 = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        S.stream = stream2;
        const vid = $('video');
        vid.srcObject = stream2;
        vid.muted = true;
        await vid.play();
        setSbar('ESCANEANDO', 'scanning');
        requestAnimationFrame(() => requestAnimationFrame(startDecoder));
        return;
      } catch(e2) { console.error('Fallback camera error:', e2); }
    }
    setSbar('ERROR CÁMARA', 'error');
    $('scanner-wrap').style.display = 'none';
    $('no-cam').classList.add('show');
  }
}

// ─── DECODER — triple estrategia Safari-compatible ───
// 1. BarcodeDetector API nativa (iOS 16+, Chrome Android)
// 2. ZXing frame-by-frame via canvas (fallback universal)
// 3. Aviso si ninguna funciona

let _scanCanvas = null;
let _scanCtx    = null;
let _rafId      = null;
let _nativeDetector = null;

function startDecoder() {
  // Canvas oculto para captura de frames
  if (!_scanCanvas) {
    _scanCanvas = document.createElement('canvas');
    _scanCtx    = _scanCanvas.getContext('2d', { willReadFrequently: true });
  }

  // Intentar BarcodeDetector nativo primero (iOS 16.4+, Chrome 83+)
  if ('BarcodeDetector' in window) {
    BarcodeDetector.getSupportedFormats().then(fmts => {
      _nativeDetector = new BarcodeDetector({ formats: fmts });
      setSbar('ESCANEANDO', 'scanning');
      _rafLoop_native();
    }).catch(() => _startZXing());
  } else {
    _startZXing();
  }
}

// ── Loop nativo (BarcodeDetector) ────────────────
function _rafLoop_native() {
  const video = $('video');
  if (!S.stream || video.readyState < 2) {
    _rafId = requestAnimationFrame(_rafLoop_native);
    return;
  }
  _nativeDetector.detect(video).then(results => {
    if (results.length && !S.cooldown) {
      const r = results[0];
      const fmt = (r.format || 'barcode').toUpperCase().replace(/-/g,'_');
      _handleResult(r.rawValue, fmt);
    }
  }).catch(() => {}).finally(() => {
    if (S.stream) _rafId = requestAnimationFrame(_rafLoop_native);
  });
}

// ── ZXing frame-by-frame (Safari fallback) ────────
function _startZXing() {
  if (!window.ZXing) {
    // ZXing aún no cargó — esperar
    setTimeout(_startZXing, 400);
    return;
  }
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.QR_CODE,  ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.CODE_39,  ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.DATA_MATRIX, ZXing.BarcodeFormat.PDF_417,
    ZXing.BarcodeFormat.AZTEC,    ZXing.BarcodeFormat.CODABAR,
  ]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

  // En Safari usamos MultiFormatReader manual sobre canvas
  // en lugar de decodeFromVideoElement (que no funciona en iOS)
  const reader = new ZXing.MultiFormatReader();
  reader.setHints(hints);
  S.reader = reader;

  setSbar('ESCANEANDO', 'scanning');
  _rafLoop_zxing(reader);
}

function _rafLoop_zxing(reader) {
  const video = $('video');
  if (!S.stream) return;

  if (video.readyState >= 2 && video.videoWidth > 0) {
    const w = video.videoWidth;
    const h = video.videoHeight;
    _scanCanvas.width  = w;
    _scanCanvas.height = h;
    _scanCtx.drawImage(video, 0, 0, w, h);

    try {
      const imgData = _scanCtx.getImageData(0, 0, w, h);
      const luminance = new ZXing.RGBLuminanceSource(imgData.data, w, h);
      const bitmap    = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
      const result    = reader.decode(bitmap);
      if (result && !S.cooldown) {
        const fmtKey = Object.keys(ZXing.BarcodeFormat)
          .find(k => ZXing.BarcodeFormat[k] === result.getBarcodeFormat()) || 'CODE_128';
        _handleResult(result.getText(), fmtKey);
      }
    } catch(e) {
      // NotFoundException es normal cuando no hay código visible — ignorar
    }
  }

  // ~15 fps — suficiente para escaneo, no drena batería
  _rafId = setTimeout(() => {
    if (S.stream) _rafLoop_zxing(reader);
  }, 66);
}

function _handleResult(text, fmtKey) {
  if (!text || text === S.lastScan) return;
  S.lastScan  = text;
  S.cooldown  = true;
  setTimeout(() => { S.cooldown = false; S.lastScan = null; }, 2000);
  onDetected(text, fmtKey);
}

function _stopDecoder() {
  if (_rafId) { cancelAnimationFrame(_rafId); clearTimeout(_rafId); _rafId = null; }
  if (S.reader && S.reader.reset) { try { S.reader.reset(); } catch(e){} }
  S.reader = null;
  _nativeDetector = null;
}

function onDetected(value, fmtKey) {
  if (navigator.vibrate) navigator.vibrate([60,30,60]);
  $('sflash').classList.add('show');
  setTimeout(() => $('sflash').classList.remove('show'), 300);
  setSbar('¡DETECTADO!', 'found');
  setTimeout(() => setSbar('ESCANEANDO','scanning'), 2000);

  const label = FMT_LABELS[fmtKey] || fmtKey;
  $('sr-type').textContent = label;
  $('sr-val').textContent  = value;
  $('scan-result').classList.add('show');

  const isUrl = /^https?:\/\//i.test(value) || /^www\./i.test(value);
  $('sr-open').style.display = isUrl ? '' : 'none';
  $('sr-open').onclick = () => window.open(isUrl && !value.startsWith('http') ? 'https://'+value : value, '_blank');

  const entry = { value, fmtKey, label, ts: Date.now() };
  S.history.unshift(entry);
  if (S.history.length > 50) S.history.pop();
  localStorage.setItem('scanx-h', JSON.stringify(S.history));
  renderHistory();
}

$('sr-copy').onclick = () => copyText($('sr-val').textContent, $('sr-copy'));
$('sr-identify').onclick = () => {
  const val = $('sr-val').textContent;
  $('lk-input').value = val;
  // Switch to lookup tab
  document.querySelector('[data-page="page-lookup"]').click();
  analyzePart(val);
};

// ─── TORCH ────────────────────────────────
async function toggleTorch() {
  if (!S.stream) return;
  const track = S.stream.getVideoTracks()[0];
  if (!track) return;
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  if (!caps.torch) return;
  S.torchOn = !S.torchOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: S.torchOn }] });
    [$('h-torch'), $('c-torch')].forEach(b => b.classList.toggle('torch-on', S.torchOn));
  } catch(e) {}
}

function flipCamera() {
  _stopDecoder();
  S.facingMode = S.facingMode === 'environment' ? 'user' : 'environment';
  initCamera();
}

function clearHistory() {
  if (!S.history.length) return;
  if (!confirm('¿Limpiar historial?')) return;
  S.history = [];
  localStorage.removeItem('scanx-h');
  $('scan-result').classList.remove('show');
  renderHistory();
}

function setSbar(text, cls) {
  const el = $('sbar');
  el.textContent = text;
  el.className = cls;
}

function renderHistory() {
  const el = $('hist-bar');
  if (!S.history.length) {
    el.innerHTML = `<div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--muted);padding:4px 0;text-align:center">Sin escaneos aún</div>`;
    return;
  }
  el.innerHTML = S.history.slice(0,6).map((e,i) => `
    <div class="hm" onclick="selectHist(${i})">
      <span class="hm-t">${e.label||e.fmtKey}</span>
      <span class="hm-v">${esc(e.value)}</span>
      <span class="hm-ts">${fmtTime(e.ts)}</span>
    </div>`).join('');
}
window.selectHist = i => {
  const e = S.history[i];
  if (!e) return;
  $('sr-type').textContent = e.label;
  $('sr-val').textContent  = e.value;
  $('scan-result').classList.add('show');
  const isUrl = /^https?:\/\//i.test(e.value);
  $('sr-open').style.display = isUrl ? '' : 'none';
};

// ─── PART NUMBER LOOKUP ───────────────────
$('lk-btn').onclick = () => {
  const v = $('lk-input').value.trim();
  if (v) analyzePart(v);
};
$('lk-clr').onclick = () => {
  $('lk-input').value = '';
  $('lk-card').classList.remove('show');
};
$('lk-input').addEventListener('keydown', e => { if (e.key==='Enter') $('lk-btn').click(); });

function analyzePart(code) {
  code = code.trim();
  if (!code) return;

  const result = identifyPartNumber(code);

  $('lk-ico').textContent     = result.icon;
  $('lk-title').textContent   = result.formatName;
  $('lk-sub').textContent     = result.description;
  $('lk-pn').textContent      = result.partNumber;
  $('lk-fmt').textContent     = result.format;
  $('lk-ind').textContent     = result.industry;
  $('lk-country').textContent = result.country;
  $('lk-pfx').textContent     = result.prefix;
  $('lk-len').textContent     = `${code.length} caracteres`;
  $('lk-chk').textContent     = result.checkDigit;
  $('lk-conf').textContent    = result.confidence + '%';
  $('lk-cbar').style.width    = result.confidence + '%';

  if (result.notes) {
    $('lk-notes-row').style.display = '';
    $('lk-notes').textContent = result.notes;
  } else {
    $('lk-notes-row').style.display = 'none';
  }

  $('lk-card').classList.add('show');

  $('lk-cp').onclick = () => copyText(code, $('lk-cp'));
  $('lk-gosim').onclick = () => {
    // Switch to generator, set similar format
    const fmtMap = {
      'EAN-13':'EAN13','EAN-8':'EAN8','UPC-A':'UPCA',
      'Code 128':'CODE128','Code 39':'CODE39','ITF-14':'ITF',
      'QR Code':'QR','Codabar':'CODABAR'
    };
    const f = fmtMap[result.formatName] || 'CODE128';
    S.genFormat = f;
    document.querySelectorAll('.fcard').forEach(c => {
      c.classList.toggle('sel', c.dataset.fmt === f);
    });
    document.querySelector('[data-page="page-gen"]').click();
    generateCodes();
  };
}

function identifyPartNumber(code) {
  const digits  = code.replace(/\D/g,'');
  const len     = code.length;
  const allNum  = /^\d+$/.test(code);
  const hasAlpha= /[A-Za-z]/.test(code);

  // ── EAN-13 ──
  if (allNum && len === 13) {
    const check = ean13Check(code);
    const gs1   = getGS1(code.substring(0,3));
    return {
      icon: '▋▋', formatName:'EAN-13', format:'GS1 EAN-13', description:'Código de barras internacional',
      partNumber: code, industry: gs1.ind, country: gs1.c,
      prefix: `${code.substring(0,3)} (GS1)`, checkDigit: check ? '✓ Válido' : '✗ Inválido',
      confidence: check ? 98 : 60, notes: check ? null : 'Check digit no coincide — posible error de tipeo',
    };
  }

  // ── EAN-8 ──
  if (allNum && len === 8) {
    const check = ean8Check(code);
    const gs1   = getGS1(code.substring(0,2)+'0');
    return {
      icon: '▌▌', formatName:'EAN-8', format:'GS1 EAN-8', description:'Producto de tamaño reducido',
      partNumber: code, industry: gs1.ind || 'Retail / Productos pequeños', country: gs1.c,
      prefix: code.substring(0,2), checkDigit: check ? '✓ Válido' : '✗ Inválido',
      confidence: check ? 95 : 58, notes: null,
    };
  }

  // ── UPC-A ──
  if (allNum && len === 12) {
    const check = upcaCheck(code);
    const gs1   = getGS1('0' + code.substring(0,2));
    return {
      icon: '⚊⚊', formatName:'UPC-A', format:'GS1 UPC-A', description:'Retail norteamericano',
      partNumber: code, industry: 'Retail / EE.UU.', country: 'EE.UU. / Canadá',
      prefix: '0' + code.substring(0,5), checkDigit: check ? '✓ Válido' : '✗ Inválido',
      confidence: check ? 97 : 62, notes: null,
    };
  }

  // ── ITF-14 ──
  if (allNum && len === 14) {
    return {
      icon: '⏸', formatName:'ITF-14', format:'GS1 ITF-14', description:'Caja de cartón / Pallet',
      partNumber: code, industry: 'Logística / Almacén', country: getGS1(code.substring(1,4)).c,
      prefix: code.substring(0,2), checkDigit: itfCheck(code) ? '✓ Válido' : '✗ Inválido',
      confidence: 90, notes: 'Envuelve un EAN-13 con dígito adicional',
    };
  }

  // ── CODE 39 (solo mayúsculas, dígitos, algunos símbolos) ──
  if (/^[A-Z0-9 \-\.$/+%]+$/.test(code) && len >= 3 && len <= 43) {
    return {
      icon: '║║', formatName:'Code 39', format:'ANSI/AIM Code 39', description:'Automotriz · Gobierno · Salud',
      partNumber: code, industry: detectCode39Industry(code), country: 'Internacional',
      prefix: code.substring(0,4), checkDigit: 'Opcional (mod 43)',
      confidence: 85, notes: 'Alfanumérico; común en piezas de repuesto automotriz',
    };
  }

  // ── QR (largo, cualquier char) ──
  if (len > 30 || /^https?:\/\//i.test(code) || /[@#;,|]/.test(code)) {
    return {
      icon: '◉', formatName:'QR Code', format:'ISO 18004 QR', description:'Datos estructurados / URL',
      partNumber: code.length > 30 ? code.substring(0,20)+'…' : code,
      industry: /^https?:\/\//i.test(code) ? 'Web / Marketing digital' : 'General / Datos',
      country: 'Global', prefix: '—', checkDigit: 'Incluido (Reed-Solomon)',
      confidence: 92, notes: code.length > 100 ? 'Contenido extenso — posible vCard, URL larga o datos industriales' : null,
    };
  }

  // ── CODABAR (solo dígitos y -$:/.+) ──
  if (/^[0-9\-\$:\/\.+]+$/.test(code) && len >= 4 && len <= 20) {
    return {
      icon: '⑃', formatName:'Codabar', format:'NW-7 / Codabar', description:'Biblioteca · Banco de sangre · FedEx',
      partNumber: code, industry: 'Salud / Logística / Biblioteca',
      country: 'EE.UU. / Japón', prefix: code.substring(0,2),
      checkDigit: 'Mod 16 (opcional)', confidence: 70,
      notes: 'Formato heredado, aún en uso en hospitales y bibliotecas',
    };
  }

  // ── CODE 128 (cualquier ASCII) ──
  return {
    icon: '╎╎', formatName:'Code 128', format:'ISO 15417 Code 128', description:'Uso general · Alta densidad',
    partNumber: code, industry: detectCode128Industry(code), country: 'Internacional',
    prefix: code.substring(0,3), checkDigit: 'Mod 103 (automático)',
    confidence: 80, notes: 'Formato más versátil; acepta ASCII completo',
  };
}

function detectCode39Industry(code) {
  if (/^(VIN|WMI|[A-HJ-NPR-Z]{3}[A-HJ-NPR-Z0-9]{14})/.test(code)) return 'Automotriz (VIN)';
  if (/^N[0-9]{9}/.test(code) || /NSN/.test(code)) return 'Defensa / Gobierno (NSN)';
  if (/^[0-9]{6}-[0-9]{2}-[0-9]{3}$/.test(code)) return 'Farmacéutica (NDC)';
  return 'Industrial / Manufactura';
}

function detectCode128Industry(code) {
  if (/^1Z/.test(code)) return 'UPS / Paquetería';
  if (/^JD/.test(code)) return 'FedEx / Courier';
  if (/^\d{20,22}$/.test(code)) return 'USPS / Correos';
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) return 'Postal internacional (S10)';
  if (/^(LOT|LOTE|SN|S\/N)/i.test(code)) return 'Manufactura / Trazabilidad';
  return 'Logística / Industrial';
}

// ─── CHECK DIGIT CALCULATORS ──────────────
function ean13Check(code) {
  let s = 0;
  for (let i=0; i<12; i++) s += parseInt(code[i]) * (i%2===0 ? 1 : 3);
  const chk = (10 - (s%10)) % 10;
  return chk === parseInt(code[12]);
}
function ean8Check(code) {
  let s = 0;
  for (let i=0; i<7; i++) s += parseInt(code[i]) * (i%2===0 ? 3 : 1);
  return ((10-(s%10))%10) === parseInt(code[7]);
}
function upcaCheck(code) {
  let s = 0;
  for (let i=0; i<11; i++) s += parseInt(code[i]) * (i%2===0 ? 3 : 1);
  return ((10-(s%10))%10) === parseInt(code[11]);
}
function itfCheck(code) {
  let s = 0;
  for (let i=0; i<13; i++) s += parseInt(code[i]) * (i%2===0 ? 3 : 1);
  return ((10-(s%10))%10) === parseInt(code[13]);
}

// ─── GENERATOR ────────────────────────────

// Format cards
const FMT_ORDER = ['CODE128','EAN13','EAN8','UPCA','CODE39','ITF','QR','CODABAR'];
const fmtGrid = $('fmt-grid');
FMT_ORDER.forEach(key => {
  const f = FORMATS[key];
  const el = document.createElement('button');
  el.className = 'fcard' + (key === S.genFormat ? ' sel' : '');
  el.dataset.fmt = key;
  el.innerHTML = `<div class="fcard-name">${f.name}</div>
    <div class="fcard-desc">${f.desc}</div>
    <div class="fcard-len">${f.len}</div>`;
  el.onclick = () => {
    document.querySelectorAll('.fcard').forEach(c=>c.classList.remove('sel'));
    el.classList.add('sel');
    S.genFormat = key;
  };
  fmtGrid.appendChild(el);
});

// Options chips
document.querySelectorAll('#gen-opts .chip').forEach(c => {
  c.onclick = () => {
    c.classList.toggle('on');
    S.genOpts[c.dataset.opt] = c.classList.contains('on');
  };
});

// Qty chips
document.querySelectorAll('#qty-opts .chip').forEach(c => {
  c.onclick = () => {
    document.querySelectorAll('#qty-opts .chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on');
    S.genQty = parseInt(c.dataset.qty);
  };
});

$('gen-btn').onclick = generateCodes;

function generateCodes() {
  const codes = [];
  for (let i = 0; i < S.genQty; i++) {
    codes.push(generateOne(S.genFormat));
  }
  S.lastGenerated = codes;

  if (S.genQty === 1) {
    showSingleCode(codes[0]);
    $('batch-wrap').style.display = 'none';
    $('gen-cpall').style.display = 'none';
  } else {
    $('gdisplay').classList.remove('show');
    showBatch(codes);
    $('gen-cpall').style.display = '';
  }
}

function generateOne(fmt) {
  const f       = FORMATS[fmt];
  const custom  = $('g-prefix').value.trim();
  const usePrefix = S.genOpts.prefix;
  const useDash   = S.genOpts.dashes;
  const useUpper  = S.genOpts.upper;

  let code = '';

  if (fmt === 'EAN13') {
    // 750 = México prefix
    const prefix = '750';
    const body   = rndDigits(9);
    const raw    = prefix + body;
    code = raw + ean13Digit(raw);
  } else if (fmt === 'EAN8') {
    const raw = rndDigits(7);
    code = raw + ean8Digit(raw);
  } else if (fmt === 'UPCA') {
    const raw = '0' + rndDigits(10);
    code = raw + upcaDigit(raw);
  } else if (fmt === 'ITF') {
    const raw = '0' + '750' + rndDigits(9);
    code = raw + itfDigit(raw);
  } else if (fmt === 'CODE39') {
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    const pfx   = custom || (usePrefix ? 'MX' : '');
    const body  = Array.from({length: 8}, () => alpha[rndInt(0, alpha.length-1)]).join('');
    code = (pfx ? pfx + '-' : '') + body;
    if (useDash) code = code.replace(/(.{4})(?=.)/g, '$1-');
  } else if (fmt === 'CODABAR') {
    const pfx = custom || (usePrefix ? '750' : '');
    code = (pfx || '') + rndDigits(10);
  } else if (fmt === 'QR') {
    const pfx = custom || (usePrefix ? 'MX-' : '');
    code = pfx + randomAlphaNum(12);
  } else {
    // CODE128 default
    const pfx   = custom || (usePrefix ? 'MX-' : '');
    const chars = useUpper || !f.alpha
      ? 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
      : 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz0123456789';
    const body  = Array.from({length:10}, () => chars[rndInt(0,chars.length-1)]).join('');
    code = pfx + (useDash ? body.replace(/(.{4})(?=.)/g,'$1-') : body);
  }

  if (useUpper) code = code.toUpperCase();
  return code;
}

function showSingleCode(code) {
  $('gdisplay').classList.add('show');
  $('gval').textContent = code;

  const f   = FORMATS[S.genFormat];
  const canvas = $('bc-canvas');

  // Render barcode
  if (S.genFormat === 'QR') {
    renderQR(canvas, code);
  } else if (f.jsFmt) {
    try {
      JsBarcode(canvas, code, {
        format: f.jsFmt, lineColor:'#000', background:'#fff',
        width: 2, height: 80, displayValue: true,
        fontSize: 13, margin: 10,
      });
    } catch(e) {
      canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
      console.warn('JsBarcode error:', e.message);
    }
  }

  // Meta tags
  $('gmeta').innerHTML = `
    <span class="gtag a">${f.name}</span>
    <span class="gtag">${code.length} chars</span>
    <span class="gtag">${f.desc}</span>`;

  $('g-cp1').onclick  = () => copyText(code, $('g-cp1'));
  $('g-save').onclick = () => saveCanvas(canvas, code);
}

function showBatch(codes) {
  $('batch-wrap').style.display = '';
  const list = $('batch-list');
  list.innerHTML = codes.map((c,i) => `
    <div class="batch-item">
      <span class="batch-val">${esc(c)}</span>
      <span class="batch-copy" onclick="copyText('${esc(c)}', this)" title="Copiar">📋</span>
    </div>`).join('');
  $('gen-cpall').onclick = () => copyText(codes.join('\n'), $('gen-cpall'));
}

// ─── QR renderer (canvas, simple matrix via API) ──
async function renderQR(canvas, text) {
  // Use an online QR API rendered as image, then draw to canvas
  const img = new Image();
  const size = 200;
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,size,size);
    ctx.drawImage(img,0,0,size,size);
  };
  img.onerror = () => {
    // Fallback: draw placeholder
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,200,200);
    ctx.fillStyle = '#000'; ctx.font = '13px monospace';
    ctx.fillText('QR: ' + text.substring(0,20), 10, 100);
  };
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

// ─── SAVE CANVAS AS PNG ───────────────────
function saveCanvas(canvas, name) {
  try {
    const link = document.createElement('a');
    link.download = `scanx-${name.substring(0,15)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch(e) {
    alert('No se pudo guardar: ' + e.message);
  }
}

// ─── CHECK DIGIT GENERATORS ───────────────
function ean13Digit(s12) {
  let t = 0;
  for (let i=0;i<12;i++) t += parseInt(s12[i]) * (i%2===0?1:3);
  return String((10-(t%10))%10);
}
function ean8Digit(s7) {
  let t=0;
  for(let i=0;i<7;i++) t+=parseInt(s7[i])*(i%2===0?3:1);
  return String((10-(t%10))%10);
}
function upcaDigit(s11) {
  let t=0;
  for(let i=0;i<11;i++) t+=parseInt(s11[i])*(i%2===0?3:1);
  return String((10-(t%10))%10);
}
function itfDigit(s13) {
  let t=0;
  for(let i=0;i<13;i++) t+=parseInt(s13[i])*(i%2===0?3:1);
  return String((10-(t%10))%10);
}

// ─── UTILS ────────────────────────────────
function rndDigits(n) { return Array.from({length:n},()=>rndInt(0,9)).join(''); }
function rndInt(a,b)  { return Math.floor(Math.random()*(b-a+1))+a; }
function randomAlphaNum(n) {
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  return Array.from({length:n},()=>c[rndInt(0,c.length-1)]).join('');
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtTime(ts) {
  const d=Math.floor((Date.now()-ts)/60000);
  return d<1?'ahora':d<60?`${d}m`:d<1440?`${Math.floor(d/60)}h`:`${Math.floor(d/1440)}d`;
}
async function copyText(val, btn) {
  try { await navigator.clipboard.writeText(val); }
  catch { const t=document.createElement('textarea');t.value=val;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove(); }
  if (btn) {
    const orig = btn.textContent || btn.innerHTML;
    btn.textContent = '✅ Copiado';
    setTimeout(()=>{ btn.textContent = orig; }, 1500);
  }
}
window.copyText = copyText;

// ─── SERVICE WORKER ───────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

// ─── INIT ─────────────────────────────────
renderHistory();
initCamera();

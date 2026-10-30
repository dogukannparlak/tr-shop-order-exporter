// Ortak yardımcılar ve isim alanı. Dosyalar klasik <script> ile yüklenir (file:// üzerinde de çalışsın diye ES module yok).
window.SD = { adapters: {}, views: {} };

(function (SD) {
  const AYLAR = { ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6, temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12 };

  // 1299 | "1.299,00 TL" | "Bedava" | "-" -> sayı ya da null
  function parseTL(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    if (/bedava|ücretsiz/i.test(v)) return 0;
    const m = v.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/);
    return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null;
  }

  // "2026-09-25 21:15" | "2026-09-22" | "05 Ekim 2026" -> "YYYY-MM-DD" ya da null
  function parseDate(v) {
    if (typeof v !== 'string') return null;
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = v.toLocaleLowerCase('tr').match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/);
    if (m && AYLAR[m[2]]) return `${m[3]}-${String(AYLAR[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }

  // Ham durum metni -> 'iptal' | 'iade' | 'ok' (vault üreticisiyle aynı kural: "iade penceresi" iade değildir)
  function classify(...texts) {
    for (const raw of texts) {
      if (!raw || raw === '-') continue;
      const t = raw.toLocaleLowerCase('tr');   // /i bayrağı "İ"yi "i" saymaz
      if (/iptal/.test(t)) return 'iptal';
      if (/iade/.test(t) && !/pencere/.test(t)) return 'iade';
    }
    return 'ok';
  }

  const nf = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtTL = x => (x == null ? '—' : nf.format(x) + ' TL');
  const fmtUSD = x => (x == null ? '—' : '$' + nf.format(x));
  const fmtInt = x => new Intl.NumberFormat('tr-TR').format(x);
  const dash = v => (v == null || v === '' || v === '-' ? null : String(v));

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Küçük DOM yardımcısı: h('div', {class: 'x'}, 'metin', çocukEleman)
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }

  const norm = s => String(s ?? '').toLocaleLowerCase('tr');

  Object.assign(SD, { parseTL, parseDate, classify, fmtTL, fmtUSD, fmtInt, dash, esc, h, norm });
})(window.SD);

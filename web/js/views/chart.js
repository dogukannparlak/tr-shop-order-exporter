// Aylık harcama çubuk grafiği (SVG). TL / Dolar arasında geçiş yapılabilir. Çubuğun üstüne gelince tutar görünür.
(function (SD) {
  const { h } = SD;
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };

  SD.views.chart = function (root) {
    let unit = 'tl', last = [];
    const toggle = h('div', { class: 'seg' },
      ['tl', 'usd'].map(u => h('button', { type: 'button', 'data-u': u, onclick: () => { unit = u; draw(last); } }, u === 'tl' ? 'TL' : 'Dolar')));
    const box = h('div', { class: 'chart' });
    root.replaceChildren(h('div', { class: 'card-head' }, h('h3', {}, 'Aylık harcama'), toggle), box);

    function months(items) {
      const m = new Map();
      for (const it of items) if (SD.data.spent(it) && it.date) {
        const k = it.date.slice(0, 7);
        const v = m.get(k) || { tl: 0, usd: 0, n: 0 };
        v.tl += it.total; v.usd += it.usd || 0; v.n++;
        m.set(k, v);
      }
      if (!m.size) return [];
      // Boş ayları da göster ki zaman ekseni kopmasın
      const keys = [...m.keys()].sort();
      const out = [];
      let [y, mo] = keys[0].split('-').map(Number);
      const end = keys[keys.length - 1];
      for (;;) {
        const k = `${y}-${String(mo).padStart(2, '0')}`;
        out.push({ k, ...(m.get(k) || { tl: 0, usd: 0, n: 0 }) });
        if (k >= end) break;
        if (++mo > 12) { mo = 1; y++; }
      }
      return out;
    }

    function draw(items) {
      last = items;
      for (const b of toggle.children) b.classList.toggle('on', b.dataset.u === unit);
      const data = months(items);
      if (!data.length) { box.replaceChildren(h('p', { class: 'muted' }, 'Grafik için veri yok.')); return; }
      const bw = 18, H = 220, P = { l: 8, r: 8, t: 12, b: 26 };   // sabit çubuk genişliği; çok ay varsa yatay kaydırma
      const W = P.l + P.r + data.length * bw;
      const max = Math.max(...data.map(d => d[unit])) || 1;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'bars', role: 'img', 'aria-label': 'Aylık harcama grafiği' });
      data.forEach((d, i) => {
        const bh = (d[unit] / max) * (H - P.t - P.b);
        const x = P.l + i * bw;
        const r = s('rect', { x: x + 1, y: H - P.b - bh, width: Math.max(1, bw - 2), height: bh, rx: 2 });
        const t = s('title', {});
        t.textContent = `${d.k}: ${SD.fmtTL(d.tl)} ≈ ${SD.fmtUSD(d.usd)} · ${d.n} ürün`;
        r.append(t);
        svg.append(r);
        if (d.k.endsWith('-01') || i === 0) {
          const lab = s('text', { x: x + 1, y: H - 8, class: 'axis' });
          lab.textContent = d.k.slice(0, 4);
          svg.append(lab);
        }
      });
      const fmt = unit === 'tl' ? SD.fmtTL : SD.fmtUSD;
      const peak = data.reduce((a, d) => (d[unit] > a[unit] ? d : a));
      box.replaceChildren(svg, h('p', { class: 'muted small' }, `En yüksek ay: ${peak.k} · ${fmt(peak[unit])}`));
      box.scrollLeft = box.scrollWidth;   // en yeni aylar görünsün
    }

    return draw;
  };
})(window.SD);

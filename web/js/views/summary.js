// Özet satırı: "131 ürün · 2022-08-08 → 2026-09-22 · harcama X TL ≈ $Y (iade/iptal hariç; n ürün) · fiyatı bilinmeyen k ürün"
// ve altında birkaç gösterge kartı.
(function (SD) {
  const { h } = SD;
  const b = (txt) => h('strong', { class: 'hl' }, txt);

  SD.views.summary = function (root) {
    return (items) => {
      if (!items.length) { root.replaceChildren(h('p', { class: 'muted' }, 'Filtreye uyan ürün yok.')); return; }
      const spent = items.filter(SD.data.spent);
      const tl = spent.reduce((a, i) => a + i.total, 0);
      const usd = spent.reduce((a, i) => a + (i.usd || 0), 0);
      const noUsd = spent.filter(i => i.usd == null).length;
      const bad = items.filter(i => i.state !== 'ok').length;
      const badTl = items.filter(i => i.state !== 'ok' && i.total != null).reduce((a, i) => a + i.total, 0);
      const noPrice = items.filter(i => i.total == null).length;
      const est = items.filter(i => i.estimated).length;
      const dates = items.map(i => i.date).filter(Boolean).sort();
      const orders = new Set(spent.map(i => i.store + i.orderNo)).size;
      const top = spent.reduce((m, i) => (!m || i.total > m.total ? i : m), null);

      const line = h('p', { class: 'summary-line' },
        b(`${SD.fmtInt(items.length)} ürün`), ' · ',
        dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : 'tarih yok', ' · harcama ',
        b(SD.fmtTL(tl)), ' ≈ ', b(SD.fmtUSD(usd)),
        h('span', { class: 'muted' }, ` (iade/iptal hariç${bad ? `; ${SD.fmtInt(bad)} ürün` : ''})`),
        noPrice ? ` · fiyatı bilinmeyen ${noPrice} ürün` : '',
        est ? h('span', { class: 'muted' }, ` · ${est} ürünün fiyatı sipariş toplamından (≈)`) : '',
        noUsd ? h('span', { class: 'warn' }, ` · ${noUsd} ürünün kuru yok`) : '');

      const tile = (k, v, sub) => h('div', { class: 'tile' }, h('div', { class: 'tile-k' }, k), h('div', { class: 'tile-v' }, v), sub ? h('div', { class: 'tile-s' }, sub) : null);
      const tiles = h('div', { class: 'tiles' },
        tile('Sipariş', SD.fmtInt(orders), 'iade/iptal hariç'),
        tile('Ortalama sipariş', orders ? SD.fmtTL(tl / orders) : '—', orders ? SD.fmtUSD(usd / orders) : null),
        tile('İade/iptal', SD.fmtTL(badTl), `${SD.fmtInt(bad)} ürün`),
        tile('En pahalı', top ? SD.fmtTL(top.total) : '—', top ? top.name.slice(0, 48) + (top.name.length > 48 ? '…' : '') : null));

      const note = h('p', { class: 'muted small rate-note' },
        'Dolar: alış gününün USD/TRY kuru, Frankfurter (açık kaynak API, Avrupa Merkez Bankası referans kuru; hafta sonu ve tatilde önceki iş günü). ',
        'Bankanın uyguladığı kurdan farklıdır, API hatalı ya da eksik veri dönebilir: dolar tutarları yaklaşıktır.');
      // Temu dökümü yalnız Temu tek seçiliyken: ürün tutarı + gümrük vergisi → ödenen − iade = net (harcamaya net girer)
      const st = SD.data.state.stores;
      const temu = st.size === 1 && st.has('temu') ? items.filter(i => i.paid != null) : [];
      const sum = k => temu.reduce((a, i) => a + (i[k] || 0), 0);
      const temuLine = temu.length ? h('p', { class: 'temu-line' },
        h('strong', {}, 'Temu net: '), `ürün ${SD.fmtTL(sum('line'))} + gümrük vergisi ${SD.fmtTL(sum('tax'))} → ödenen ${SD.fmtTL(sum('paid'))} − iade ${SD.fmtTL(sum('refund'))} = net `,
        b(SD.fmtTL(sum('net'))),
        h('span', { class: 'muted' }, ' (vergi ve iade ürünlere orantılı dağıtılır; ürün başına tutarlar çıkarımdır)')) : null;

      root.replaceChildren(line, tiles, temuLine, note);
    };
  };
})(window.SD);

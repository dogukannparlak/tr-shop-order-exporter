// Tüm ürünler tablosu + satıra tıklayınca açılan ayrıntı penceresi.
(function (SD) {
  const { h } = SD;
  const STATE = { ok: 'Harcama', iade: 'İade', iptal: 'İptal' };

  function detail(dialog, it) {
    const row = (k, v) => (v == null || v === '' ? null : h('tr', {}, h('th', {}, k), h('td', {}, v)));
    dialog.replaceChildren(h('form', { method: 'dialog', class: 'dlg' },
      h('div', { class: 'dlg-head' },
        it.image ? h('img', { src: it.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
        h('h3', {}, it.name)),
      h('table', { class: 'kv' }, h('tbody', {},
        row('Mağaza', SD.data.label(it.store)),
        row('Sipariş no', it.orderNo),
        row('Tarih', it.date),
        row('Alıcı', it.recipient),
        row('Adet', it.qty),
        row('Birim fiyat', SD.fmtTL(it.unit)),
        row('Tutar', (it.estimated ? '≈ ' : '') + SD.fmtTL(it.total)),
        it.tax ? row('Vergi/kupon payı (çıkarım)', SD.fmtTL(it.tax)) : null,
        it.refund ? row('İade payı (çıkarım)', SD.fmtTL(it.refund)) : null,
        row('Dolar', it.usd != null ? SD.fmtUSD(it.usd) : null),
        row('Kur (USD/TRY)', it.rate ? it.rate.toFixed(4).replace('.', ',') : null),
        row('Banka', it.bank),
        row('Kart', it.card !== '—' ? '•••• ' + it.card : null),
        row('Kategori', it.category),
        row('Satıcı', it.seller),
        row('Varyant', it.variant),
        row('Durum', it.statusText),
        row('Link', it.url ? h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer' }, 'Ürün sayfası ↗') : null))),
      h('div', { class: 'dlg-foot' }, h('button', { class: 'tb-btn', value: 'close' }, 'Kapat'))));
    dialog.showModal();
  }

  SD.views.items = function (root) {
    const dialog = h('dialog', { class: 'modal' });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    const t = SD.table({
      unit: 'ürün', pageSize: 50,
      filterKey: 'recipient', filterLabel: 'Alıcı',
      searchPlaceholder: 'Ara: ürün, alıcı, kategori, sipariş no…',
      sort: { key: 'date', dir: -1 },
      onRow: it => detail(dialog, it),
      columns: [
        { key: 'date', label: 'Tarih', cls: 'nowrap' },
        { key: 'name', label: 'Ürün', cls: 'name', render: it => h('span', { class: 'name-cell' },
          it.image ? h('img', { src: it.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('span', { class: 'noimg' }),
          h('span', {}, it.name)) },
        { key: 'storeLabel', label: 'Mağaza', text: it => SD.data.label(it.store), sortValue: it => SD.data.label(it.store),
          render: it => h('span', { class: `tag store-${it.store}` }, SD.data.label(it.store)) },
        { key: 'recipient', label: 'Alıcı' },
        { key: 'category', label: 'Kategori' },
        { key: 'qty', label: 'Adet', num: true },
        { key: 'total', label: 'Tutar', num: true, cls: 'nowrap', render: it => (it.estimated ? '≈ ' : '') + SD.fmtTL(it.total) },
        { key: 'usd', label: 'Dolar', num: true, cls: 'nowrap', fmt: SD.fmtUSD },
        { key: 'bank', label: 'Banka', cls: 'nowrap' },
        { key: 'card', label: 'Kart' },
        { key: 'state', label: 'Durum', text: it => `${STATE[it.state]} ${it.statusText || ''}`,
          render: it => h('span', { class: `badge st-${it.state}`, title: it.statusText || '' }, STATE[it.state]) },
      ],
    });
    root.replaceChildren(h('h3', {}, 'Tüm ürünler'), t.el, dialog);
    return items => t.update(items);
  };
})(window.SD);

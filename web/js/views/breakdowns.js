// Grup özetleri (Alıcı, Mağaza, Banka ve kart, Yıl, Kategori). Adet tüm satırları sayar; TL ve Dolar yalnız harcamayı (iade/iptal hariç).
(function (SD) {
  const { h } = SD;

  const GROUPS = [
    { id: 'recipient', title: 'Alıcı', keys: [['recipient', 'Alıcı']], filter: 'recipient' },
    { id: 'store', title: 'Mağaza', keys: [['storeLabel', 'Mağaza']], filter: 'storeLabel', minGroups: 2 },
    { id: 'card', title: 'Banka ve kart', keys: [['bank', 'Banka'], ['card', 'Kart']], filter: 'bank' },
    { id: 'year', title: 'Yıl', keys: [['year', 'Yıl']], sort: { key: 'year', dir: -1 } },
    { id: 'category', title: 'Kategori', keys: [['category', 'Kategori']], filter: null, skipEmpty: true },
  ];

  function group(items, keys) {
    const m = new Map();
    for (const it of items) {
      const vals = keys.map(([k]) => (k === 'storeLabel' ? SD.data.label(it.store) : it[k]) ?? '—');
      const id = vals.join('\u0000');
      if (!m.has(id)) m.set(id, Object.assign(Object.fromEntries(keys.map(([k], i) => [k, vals[i]])), { n: 0, tl: 0, usd: 0 }));
      const g = m.get(id);
      g.n++;
      if (SD.data.spent(it)) { g.tl += it.total; g.usd += it.usd || 0; }
    }
    return [...m.values()];
  }

  SD.views.breakdowns = function (root) {
    const cards = GROUPS.map(g => {
      const t = SD.table({
        unit: 'satır',
        filterKey: g.filter, filterLabel: g.keys[0][1],
        searchPlaceholder: `Ara: ${g.keys.map(k => k[1].toLocaleLowerCase('tr')).join(', ')}…`,
        sort: g.sort || { key: 'usd', dir: -1 },
        columns: [
          ...g.keys.map(([k, l]) => ({ key: k, label: l })),
          { key: 'n', label: 'Adet', num: true, fmt: SD.fmtInt },
          { key: 'tl', label: 'TL', num: true, fmt: SD.fmtTL },
          { key: 'usd', label: 'Dolar', num: true, fmt: SD.fmtUSD },
        ],
      });
      const card = h('section', { class: 'card' }, h('h3', {}, g.title), t.el);
      return { g, t, card };
    });
    root.replaceChildren(...cards.map(c => c.card));

    return (items) => {
      for (const { g, t, card } of cards) {
        const rows = group(items, g.keys);
        const hide = (g.minGroups && rows.length < g.minGroups) ||
          (g.skipEmpty && rows.every(r => r[g.keys[0][0]] === '—'));
        card.hidden = !!hide;
        if (!hide) t.update(rows);
      }
    };
  };
})(window.SD);

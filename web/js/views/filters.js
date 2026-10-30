// Genel filtreler: mağaza çipleri, yıl, iade/iptal görünürlüğü. Tüm görünümleri etkiler.
(function (SD) {
  const { h } = SD;

  SD.views.filters = function (root) {
    root.addEventListener('click', e => {
      const chip = e.target.closest('[data-store]');
      if (!chip) return;
      const s = new Set(SD.data.state.stores);
      s.has(chip.dataset.store) ? s.delete(chip.dataset.store) : s.add(chip.dataset.store);
      SD.data.set({ stores: s });
    });

    return (_, all) => {
      const st = SD.data.state;
      const counts = {};
      for (const it of all) counts[it.store] = (counts[it.store] || 0) + 1;
      const years = [...new Set(all.map(i => i.year))].sort().reverse();
      if (st.year !== 'all' && !years.includes(st.year)) st.year = 'all';

      const chips = SD.data.STORE_ORDER.filter(s => counts[s]).map(s =>
        h('button', { type: 'button', class: `chip store-${s}${st.stores.has(s) ? ' on' : ''}`, 'data-store': s, 'aria-pressed': st.stores.has(s) },
          SD.data.label(s), h('span', { class: 'chip-n' }, SD.fmtInt(counts[s]))));

      const year = h('select', { class: 'tb-select', onchange: e => SD.data.set({ year: e.target.value }) },
        h('option', { value: 'all' }, 'Yıl: hepsi'), years.map(y => h('option', { value: y, selected: y === st.year }, y)));

      const bad = h('label', { class: 'toggle' },
        h('input', { type: 'checkbox', checked: st.includeBad, onchange: e => SD.data.set({ includeBad: e.target.checked }) }),
        ' İade/iptal satırlarını göster');

      root.replaceChildren(
        h('div', { class: 'chips' }, chips,
          st.stores.size ? h('button', { type: 'button', class: 'tb-btn', onclick: () => SD.data.set({ stores: new Set() }) }, 'Tüm mağazalar') : null),
        h('div', { class: 'filter-row' }, year, bad));
    };
  };
})(window.SD);

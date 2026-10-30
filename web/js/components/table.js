// Filtrelenebilir, sıralanabilir tablo bileşeni: arama kutusu + tek seçmeli filtre + Temizle + "n / m" sayacı.
// Kullanım: const t = SD.table({ columns, unit, filterKey, filterLabel, pageSize, onRow }); t.el'i yerleştir, t.update(rows) çağır.
// Sütunda when(rows) varsa sütun yalnız true dönünce görünür (ör. yalnız Temu satırlarında olan Gümrük/İade).
(function (SD) {
  const { h } = SD;

  SD.table = function ({ columns, unit = 'satır', filterKey, filterLabel, sort, pageSize = 0, onRow, searchPlaceholder }) {
    let rows = [], q = '', sel = '', page = 0;
    let sortKey = sort?.key ?? null, sortDir = sort?.dir ?? -1;

    const search = h('input', { type: 'search', class: 'tb-search', placeholder: searchPlaceholder || 'Ara…' });
    const select = filterKey ? h('select', { class: 'tb-select' }) : null;
    const clear = h('button', { class: 'tb-btn', type: 'button' }, 'Temizle');
    const count = h('div', { class: 'tb-count' });
    const thead = h('thead');
    const tbody = h('tbody');
    const pager = h('div', { class: 'tb-pager' });
    const el = h('div', { class: 'tb' },
      h('div', { class: 'tb-bar' }, search, select, clear),
      count,
      h('div', { class: 'tb-scroll' }, h('table', {}, thead, tbody)),
      pager);

    search.addEventListener('input', () => { q = search.value; page = 0; render(); });
    select?.addEventListener('change', () => { sel = select.value; page = 0; render(); });
    clear.addEventListener('click', () => { q = sel = ''; search.value = ''; if (select) select.value = ''; page = 0; render(); });

    const visible = () => columns.filter(c => !c.when || c.when(rows));

    function header() {
      thead.replaceChildren(h('tr', {}, visible().map(c => {
        const active = sortKey === c.key;
        return h('th', {
          class: [c.num && 'num', c.sortable !== false && 'sortable', active && 'active'].filter(Boolean).join(' '),
          title: c.sortable !== false ? 'Sırala' : null,
          onclick: c.sortable === false ? null : () => {
            sortDir = active ? -sortDir : (c.num ? -1 : 1); sortKey = c.key; render();
          },
        }, c.label, active ? (sortDir > 0 ? ' ▲' : ' ▼') : '');
      })));
    }

    function options() {
      if (!select) return;
      const vals = [...new Set(rows.map(r => r[filterKey]).filter(v => v != null))].sort((a, b) => String(a).localeCompare(String(b), 'tr'));
      if (sel && !vals.includes(sel)) sel = '';
      select.replaceChildren(h('option', { value: '' }, `${filterLabel}: hepsi`), ...vals.map(v => h('option', { value: v, selected: v === sel }, v)));
    }

    function render() {
      header();
      const nq = SD.norm(q);
      let list = rows.filter(r => (!sel || r[filterKey] === sel) &&
        (!nq || SD.norm(columns.map(c => c.text ? c.text(r) : r[c.key]).join(' ')).includes(nq)));
      if (sortKey != null) {
        const col = columns.find(c => c.key === sortKey);
        const val = col?.sortValue || (r => r[sortKey]);
        list = list.slice().sort((a, b) => {
          const x = val(a), y = val(b);
          if (x == null) return 1; if (y == null) return -1;
          return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'tr')) * sortDir;
        });
      }
      count.textContent = `${SD.fmtInt(list.length)} / ${SD.fmtInt(rows.length)} ${unit}`;
      const pages = pageSize ? Math.max(1, Math.ceil(list.length / pageSize)) : 1;
      page = Math.min(page, pages - 1);
      const shown = pageSize ? list.slice(page * pageSize, (page + 1) * pageSize) : list;
      tbody.replaceChildren(...shown.map(r => {
        const tr = h('tr', { class: onRow ? 'clickable' : null, onclick: onRow ? () => onRow(r) : null },
          visible().map(c => {
            const v = c.render ? c.render(r) : (c.fmt ? c.fmt(r[c.key]) : r[c.key] ?? '—');
            return h('td', { class: [c.num && 'num', c.cls].filter(Boolean).join(' ') || null }, v);
          }));
        return tr;
      }));
      if (!shown.length) tbody.append(h('tr', {}, h('td', { colspan: visible().length, class: 'empty' }, 'Sonuç yok')));
      pager.replaceChildren();
      if (pages > 1) {
        const btn = (txt, p, dis) => h('button', { class: 'tb-btn', type: 'button', disabled: dis, onclick: () => { page = p; render(); } }, txt);
        pager.append(btn('‹ Önceki', page - 1, page === 0), h('span', {}, `${page + 1} / ${pages}`), btn('Sonraki ›', page + 1, page >= pages - 1));
      }
    }

    return { el, update(next) { rows = next; options(); render(); } };
  };
})(window.SD);

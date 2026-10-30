// Uygulama girişi: klasör/dosya yükleme ve görünümlerin bağlanması.
(function (SD) {
  const { h } = SD;
  const $ = id => document.getElementById(id);

  const views = [
    SD.views.filters($('filters')),
    SD.views.summary($('summary')),
    SD.views.chart($('chart')),
    SD.views.breakdowns($('breakdowns')),
    SD.views.items($('items')),
  ];

  SD.data.onChange((filtered, all) => {
    const has = all.length > 0;
    $('dashboard').hidden = !has;
    $('empty').hidden = has;
    const src = SD.data.STORE_ORDER.filter(s => SD.data.sources[s]).map(s => [s, SD.data.sources[s]]);
    $('sources').replaceChildren(...src.map(([s, v]) =>
      h('span', { class: `tag store-${s}`, title: v.file }, `${SD.data.label(s)} · ${SD.fmtInt(v.orders.length)} sipariş`)));
    $('clear-all').hidden = !src.length;
    if (has) for (const v of views) v(filtered, all);
  });

  function report(lines) {
    $('report').replaceChildren(...lines.map(l => h('li', { class: l[0] === '✓' ? 'ok' : 'err' }, l)));
  }

  async function load(files) { if (files.length) report(await SD.data.addFiles(files)); }

  $('file').addEventListener('change', e => { load([...e.target.files]); e.target.value = ''; });

  // Sürükle-bırak: tüm sayfa bırakma alanı
  let depth = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); depth++; document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
    load([...e.dataTransfer.files].filter(f => /\.json$/i.test(f.name)));
  });

  $('clear-all').addEventListener('click', () => { SD.data.clearAll(); report([]); });

  // --- Klasörden yükleme (web/js/folder.js) ---
  let saved = false;   // hatırlanan klasör var mı ("Yenile" onu yeniden okur)

  function setFolder(text, { reconnect = false } = {}) {
    $('folder-status').textContent = text || '';
    $('reconnect').hidden = !reconnect;
    $('reload').hidden = !saved || reconnect;
  }

  async function loadFolder(res, label) {
    if (!res) return;
    if (!res.files.length) { setFolder(`${label}: tanınan JSON yok`); return; }
    report(await SD.data.addFiles(res.files, { replace: true }));
    setFolder(`${label} · ${res.files.length} dosya · ${new Date().toLocaleTimeString('tr-TR')}`);
  }

  async function fromSaved() {
    const r = await SD.folder.fromSaved().catch(() => null);
    if (!r) return;
    saved = true;
    if (r.needsPermission) { setFolder(`Kayıtlı klasör: ${r.name}`, { reconnect: true }); return; }
    await loadFolder(r, `${r.name} klasörü`);
  }

  $('pick-folder').addEventListener('click', async () => {
    try {
      const r = await SD.folder.pick();
      if (!r) return;
      saved = !!r.remembered;
      await loadFolder(r, `${r.name} klasörü${r.remembered ? ' (hatırlanacak)' : ''}`);
    } catch (e) { if (e.name !== 'AbortError') report([`✗ Klasör okunamadı: ${e.message}`]); }
  });

  $('reconnect').addEventListener('click', async () => {
    const r = await SD.folder.reconnect().catch(() => null);
    if (r) { $('reconnect').hidden = true; await loadFolder(r, `${r.name} klasörü`); }
  });

  $('reload').addEventListener('click', fromSaved);

  // Açılışta: hatırlanan klasör varsa (Chrome/Edge) oku ya da "Klasörü oku" düğmesini göster
  fromSaved();

  // Kırık görselleri gizle (silinmiş ürün görselleri vb.)
  document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.classList.add('broken'); }, true);
})(window.SD);

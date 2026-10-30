// Veri katmanı: yüklenen dosyaları tanır, ürün satırlarına çevirir, filtre durumunu tutar ve değişince görünümlere haber verir.
(function (SD) {
  const STORE_ORDER = ['hepsiburada', 'trendyol', 'trendyol-milla', 'amazon', 'temu'];
  const sources = {};          // store -> { file, orders }
  let items = [];
  const listeners = [];

  const state = { stores: new Set(), year: 'all', search: '', includeBad: true };

  const label = s => SD.adapters[s]?.label || s;

  // Dosya adı önce, yoksa içerik yapısı
  function detect(name, json) {
    const n = name.toLowerCase();
    if (!Array.isArray(json)) return null;
    for (const s of ['trendyol-milla', 'hepsiburada', 'trendyol', 'amazon', 'temu'])
      if (n.includes(s)) return { kind: 'orders', store: s };
    const o = json.find(x => x && !x.error);
    const s = ['temu', 'trendyol-milla', 'trendyol', 'hepsiburada', 'amazon'].find(k => SD.adapters[k].detect(o));
    return s ? { kind: 'orders', store: s } : null;
  }

  function rebuild() {
    const raw = [];
    for (const s of STORE_ORDER) {
      if (!sources[s]) continue;
      for (const o of sources[s].orders) if (!o.error) raw.push(...SD.adapters[s].toItems(o));
    }
    // Tek ürünlü siparişte fiyat yoksa sipariş toplamı tahmin olarak alınır
    const perOrder = {};
    for (const it of raw) perOrder[it.store + it.orderNo] = (perOrder[it.store + it.orderNo] || 0) + 1;
    items = raw.map((it, i) => {
      if (it.total == null && perOrder[it.store + it.orderNo] === 1 && it.orderTotal != null) { it.total = it.orderTotal; it.estimated = true; }
      return {
        ...it, id: i,
        year: it.date ? it.date.slice(0, 4) : '—',
        recipient: it.recipient || 'belirtilmemiş',
        // Banka yalnız sitenin verdiği bilgidir (şu an yalnız Trendyol); yoksa kartlı ödemede '—', kartsızda ödeme yöntemi
        bank: it.pay.bank || (it.pay.last4 ? '—' : it.pay.method || '—'), card: it.pay.last4 || '—',
        usd: SD.rates.usd(it.total, it.date),
        rate: SD.rates.rate(it.date),
      };
    });
    emit();
  }

  function refreshRates() {
    for (const it of items) { it.usd = SD.rates.usd(it.total, it.date); it.rate = SD.rates.rate(it.date); }
  }

  const spent = it => it.state === 'ok' && it.total != null;

  function filtered() {
    const q = SD.norm(state.search);
    return items.filter(it =>
      (!state.stores.size || state.stores.has(it.store)) &&
      (state.year === 'all' || it.year === state.year) &&
      (state.includeBad || it.state === 'ok') &&
      (!q || SD.norm([it.name, it.recipient, it.category, it.seller, it.orderNo, label(it.store)].join(' ')).includes(q)));
  }

  function emit() { const f = filtered(); for (const fn of listeners) fn(f, items); }

  // replace: önce her şeyi boşalt (klasör yeniden okunurken). Aynı yüklemede aynı siteden birden çok dosya
  // (ör. Amazon sayfa dosyaları) sipariş no'ya göre tekilleştirilip birleştirilir; sonraki yükleme o siteyi değiştirir.
  async function addFiles(fileList, { replace = false } = {}) {
    if (replace) for (const k of Object.keys(sources)) delete sources[k];
    const report = [], batch = new Set();
    for (const file of fileList) {
      let json;
      try { json = JSON.parse(await file.text()); } catch { report.push(`✗ ${file.name}: JSON okunamadı`); continue; }
      const d = detect(file.name, json);
      if (!d) { report.push(`✗ ${file.name}: hangi siteye ait olduğu anlaşılamadı`); continue; }
      if (batch.has(d.store)) {
        const prev = sources[d.store], seen = new Set(prev.orders.map(o => o.orderNo));
        prev.orders.push(...json.filter(o => !seen.has(o.orderNo)));
        prev.file += ', ' + file.name;
      } else sources[d.store] = { file: file.name, orders: json.slice() };
      batch.add(d.store);
      const errs = json.filter(o => o?.error).length;
      report.push(`✓ ${file.name}: ${label(d.store)}, ${json.length} sipariş${errs ? `, ${errs} hatalı kayıt atlandı` : ''}`);
    }
    rebuild();
    const dates = items.map(i => i.date).filter(Boolean).sort();
    const rateMsg = await SD.rates.ensure(dates[0], dates[dates.length - 1]);
    if (rateMsg !== 'ok' && rateMsg !== 'cache') report.push('⚠ ' + rateMsg);
    refreshRates();
    emit();
    return report;
  }

  function clearAll() { for (const k of Object.keys(sources)) delete sources[k]; rebuild(); }

  SD.data = {
    STORE_ORDER, label, state, spent, addFiles, clearAll,
    get items() { return items; },
    get sources() { return sources; },
    set(patch) { Object.assign(state, patch); emit(); },
    onChange(fn) { listeners.push(fn); },
  };
})(window.SD);

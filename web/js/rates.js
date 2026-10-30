// USD/TRY günlük kur: Frankfurter (açık kaynak API, Avrupa Merkez Bankası referans kurları).
// Alış günü kuru yoksa (hafta sonu, tatil) önceki iş günü kullanılır. Kurlar localStorage'da önbelleklenir;
// API'ye yalnız tarih aralığı gönderilir. Banka/kart kurundan farklıdır: dolar tutarları yaklaşıktır.
(function (SD) {
  const KEY = 'sd-kurlar-usd-try';
  let dates = [], map = {};

  function set(json) {
    const rates = json?.rates || {};
    for (const [d, r] of Object.entries(rates)) if (r?.TRY) map[d] = r.TRY;
    dates = Object.keys(map).sort();
  }

  function rate(date) {
    if (!date || !dates.length) return null;
    let lo = 0, hi = dates.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (dates[mid] <= date) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans >= 0 ? map[dates[ans]] : null;
  }

  const usd = (tl, date) => { const k = rate(date); return tl == null || !k ? null : tl / k; };
  const covers = (from, to) => dates.length && dates[0] <= from && dates[dates.length - 1] >= addDays(to, -4);
  const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

  function loadCache() { try { set(JSON.parse(localStorage.getItem(KEY))); } catch { /* önbellek yok */ } }
  function saveCache() { try { localStorage.setItem(KEY, JSON.stringify({ rates: Object.fromEntries(dates.map(d => [d, { TRY: map[d] }])) })); } catch { /* kota */ } }

  // Eksik aralığı API'den tamamlar. Dönüş: 'ok' | 'cache' | hata metni
  async function ensure(from, to) {
    if (!from) return 'ok';
    if (covers(from, to)) return 'cache';
    const url = `https://api.frankfurter.dev/v1/${addDays(from, -7)}..${to}?base=USD&symbols=TRY`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      set(await r.json());
      saveCache();
      return 'ok';
    } catch (e) {
      return 'Kur alınamadı (' + e.message + '). Dolar sütunları boş kalır.';
    }
  }

  loadCache();
  SD.rates = { rate, usd, ensure, get lastDate() { return dates[dates.length - 1]; } };
})(window.SD);

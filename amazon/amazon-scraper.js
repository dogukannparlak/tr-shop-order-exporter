// Amazon.com.tr "Siparişlerim" -> JSON (amazon-siparisler.json)
// Kullanım: amazon.com.tr'ye giriş yap, Siparişlerim sayfasını aç, DevTools Console'a yapıştır.
// Console filtresine [AMZ] yaz: sadece ilerleme ve hatalar görünür.
// Yapıştırınca çıkan kutudan tarih aralığı / son N sipariş seçilir (tümü de seçilebilir).
// (Fonksiyon içinde çalışır: aynı sayfada tekrar yapıştırınca "already declared" hatası vermez.)
(async () => {
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = el => el?.textContent.replace(/[\s\u00a0\u200b\u200c\u200e\u200f]+/g, ' ').trim() || '-';
const comp = (root, name) => root.querySelector(`[data-component="${name}"]`);
const parseTR = s => {
  const m = String(s).match(/(-?)\s*(\d[\d.]*,\d{2})/);
  return m ? (m[1] ? -1 : 1) * parseFloat(m[2].replace(/\./g, '').replace(',', '.')) : '-';
};
const MONTHS = { Ocak: 1, Şubat: 2, Mart: 3, Nisan: 4, Mayıs: 5, Haziran: 6, Temmuz: 7, Ağustos: 8, Eylül: 9, Ekim: 10, Kasım: 11, Aralık: 12 };
const isoDate = s => {
  const m = String(s).match(/(\d{1,2})\s+(\p{L}+)\s+(\d{4})/u);
  const mo = m && MONTHS[m[2]];
  return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` : '-';
};

function readAddress(doc) {
  const el = comp(doc, 'shippingAddress');
  if (!el) return { name: '-', street: '-', city: '-', neighborhood: '-', district: '-', postalCode: '-', country: '-', raw: '-' };
  const lis = [...el.querySelectorAll('li')];
  const lines = li => {
    const c = li.cloneNode(true);
    c.querySelectorAll('br').forEach(b => b.replaceWith('\u0001'));
    return c.textContent.split('\u0001').map(x => x.replace(/[\s\u00a0\u200b\u200c]+/g, ' ').trim()).filter(Boolean);
  };
  const addrLines = lis[1] ? lines(lis[1]) : [];
  const region = addrLines.length ? addrLines[addrLines.length - 1] : '';
  const m = region.match(/^(.*?),\s*(.*?),\s*(.*?)\s+(\d{5})$/);
  const m2 = !m && region.match(/^(.*?),\s*(.*?)\s+(\d{5})$/);   // ilçe yoksa: "İL, MAHALLE 12345"
  return {
    name: lis[0] ? txt(lis[0]) : '-',
    street: addrLines.length > 1 ? addrLines.slice(0, -1).join(' ') : (addrLines[0] || '-'),
    city: m ? m[1] : (m2 ? m2[1] : '-'),
    neighborhood: m ? m[2] : (m2 ? m2[2] : '-'),
    district: m ? m[3] : '-',
    postalCode: m ? m[4] : (m2 ? m2[3] : '-'),
    country: lis[2] ? txt(lis[2]) : '-',
    raw: lis.map(li => lines(li).join(' / ')).join(' | '),
  };
}

function readPayment(doc) {
  const el = comp(doc, 'viewPaymentPlanSummaryWidget');
  if (!el) return { method: '-', last4: '-', extra: '-', text: '-' };
  const c = el.cloneNode(true);
  c.querySelectorAll('script,style').forEach(e => e.remove());   // sayfa kodu metne karışmasın
  const t = txt(c);
  const m = t.match(/Ödeme aracı\s*(.+?)\s*(\d{4})\s*ile biten\s*(.*)$/);
  if (m) return { method: m[1], last4: m[2], extra: m[3] || '-', text: t };
  const plain = t.replace(/^Ödeme aracı\s*/, '');
  return { method: (!plain || /Mevcut ücret yok/i.test(plain)) ? '-' : plain, last4: '-', extra: '-', text: t };   // örn. "Hediye Çeki"
}

function readAmounts(doc) {
  const o = {};
  const cs = comp(doc, 'chargeSummary');
  if (!cs) return o;
  cs.querySelectorAll('.a-row').forEach(row => {
    const m = txt(row).match(/^(.+?):\s*(-?\s*\d[\d.]*,\d{2})\s*TL$/);
    if (m && !(m[1] in o)) o[m[1]] = parseTR(m[2]);
  });
  return o;
}

function readItem(rg, status, statusText) {
  const a = rg.querySelector('a[href*="/dp/"]');
  const asin = a?.getAttribute('href')?.match(/\/dp\/(\w+)/)?.[1] || '-';
  const row = rg.parentElement;
  const img = row?.querySelector('[data-component="purchasedItemsLeftGrid"] img');
  // adet: görselin üstündeki rozet (yoksa 1 adet)
  const qty = parseInt(txt(row?.querySelector('.od-item-view-qty span')).match(/\d+/)?.[0] || '1', 10);
  const returnText = txt(comp(rg, 'itemReturnEligibility'));
  // Amazon eski siparişlerde durum metni vermiyor; iade/değişim penceresi bilgisi varsa teslim edilmiş sayılır (çıkarım)
  if (status === '-' && returnText !== '-') { status = 'Teslim edildi (çıkarım)'; statusText = returnText; }
  const price = parseTR(txt(comp(rg, 'unitPrice')));         // birim fiyat (adetle çarpılırsa satır toplamı)
  return {
    name: txt(comp(rg, 'itemTitle')),
    asin,
    url: asin === '-' ? '-' : `https://www.amazon.com.tr/dp/${asin}`,
    image: img?.getAttribute('src') || img?.getAttribute('data-src') || '-',
    seller: txt(comp(rg, 'orderedMerchant')).replace(/^Satıcı:\s*/, ''),
    quantity: qty,
    unitPrice: price,
    lineTotal: typeof price === 'number' ? Math.round(price * qty * 100) / 100 : '-',
    status,
    statusText,
  };
}

function readOrder(doc) {
  const items = [];
  const packs = [...doc.querySelectorAll('[data-component="purchasedItems"]')];
  for (const pi of packs) {
    const st = [...(pi.parentElement?.children || [])].find(c => c.getAttribute('data-component') === 'shipmentStatus');
    const statusText = st ? txt(st) : '-';
    const status = statusText.split(':')[0].trim() || '-';
    pi.querySelectorAll('[data-component="purchasedItemsRightGrid"]').forEach(rg => items.push(readItem(rg, status, statusText)));
  }
  if (!packs.length) {  // paket bölümü yoksa (örn. iptal) tüm ürünleri al
    const cancelled = txt(comp(doc, 'cancelled'));
    doc.querySelectorAll('[data-component="purchasedItemsRightGrid"]').forEach(rg => items.push(readItem(rg, cancelled !== '-' ? cancelled : '-', cancelled)));
  }
  const amounts = readAmounts(doc);
  const dateText = txt(comp(doc, 'orderDate'));
  // kontrol: ürün satır toplamları, "Ürün Ara Toplamı" (KDV hariç olabilir) ya da "Toplam - Kargo" (KDV dahil) ile tutuyor mu
  const itemsSum = Math.round(items.reduce((s, i) => s + (typeof i.lineTotal === 'number' ? i.lineTotal : 0), 0) * 100) / 100;
  const sub = amounts['Ürün Ara Toplamı'];
  const taxIncl = typeof amounts['Toplam'] === 'number' ? Math.round((amounts['Toplam'] - (amounts['Kargo ve Paketleme'] || 0)) * 100) / 100 : '-';
  const hit = v => typeof v === 'number' && Math.abs(itemsSum - v) < 0.02;
  return {
    orderNo: txt(comp(doc, 'orderId')),
    date: isoDate(dateText),
    dateText,
    total: amounts['Genel Toplam'] ?? '-',
    amounts,
    check: { itemsSum, subTotal: sub ?? '-', totalMinusShipping: taxIncl, match: (sub === undefined && taxIncl === '-') ? '-' : (hit(sub) || hit(taxIncl)) },
    address: readAddress(doc),
    payment: readPayment(doc),
    items: items.length ? items : [{ name: '-', quantity: '-', unitPrice: '-', lineTotal: '-' }],
  };
}

// ---- ÇALIŞTIR ----
// ---- AYAR: hangi siparişler alınsın? Sayfada çıkan kutudan seçilir ----
// Kutuyu atlamak için yapıştırmadan önce window.RANGE = { months, from, to, last } tanımla (hepsi null = tüm siparişler).
const askRange = site => window.RANGE ? Promise.resolve(window.RANGE) : new Promise(resolve => {
  document.getElementById('range-panel')?.remove();
  const p = document.createElement('div');
  p.id = 'range-panel';
  p.style.cssText = 'position:fixed;left:50%;top:15%;transform:translateX(-50%);z-index:999999;background:#fff;color:#222;padding:20px 22px;border-radius:12px;font:14px/1.5 system-ui,sans-serif;width:340px;box-shadow:0 10px 40px #0006';
  const chip = 'padding:8px 4px;border:1px solid #bbb;border-radius:8px;background:#f5f5f5;color:#222;font:inherit;cursor:pointer';
  const fld = 'width:100%;box-sizing:border-box;margin:2px 0 10px;padding:7px;font:inherit;border:1px solid #bbb;border-radius:6px';
  const MODES = [['all', 'Tümü'], ['1', 'Son 1 ay'], ['3', 'Son 3 ay'], ['6', 'Son 6 ay'], ['12', 'Son 1 yıl'], ['custom', 'Tarih aralığı'], ['last', 'Son N sipariş']];
  p.innerHTML = `<div style="font-size:16px;font-weight:600">${site}: hangi siparişler indirilsin?</div>
    <div style="color:#666;margin:2px 0 12px">Bir seçenek seç, sonra <b>İndirmeyi başlat</b>'a bas.</div>
    <div id="rp-chips" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">${MODES.map(([v, t]) => `<button type="button" data-m="${v}" style="${chip}">${t}</button>`).join('')}</div>
    <div id="rp-custom" style="display:none">Başlangıç tarihi<input id="rp-from" type="date" style="${fld}">Bitiş tarihi (boşsa bugün)<input id="rp-to" type="date" style="${fld}"></div>
    <div id="rp-last" style="display:none">Kaç sipariş? (en yeniden başlayarak)<input id="rp-n" type="number" min="1" value="20" style="${fld}"></div>
    <div id="rp-sum" style="background:#eef4ff;border-radius:6px;padding:8px 10px;margin-bottom:12px"></div>
    <button id="rp-go" type="button" style="width:100%;padding:10px;font:inherit;font-weight:600;cursor:pointer;border:0;border-radius:8px;background:#f27a1a;color:#fff">İndirmeyi başlat</button>`;
  document.body.appendChild(p);
  const $ = id => p.querySelector('#' + id);
  const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  let mode = 'all';
  const refresh = () => {
    p.querySelectorAll('[data-m]').forEach(b => {
      const on = b.dataset.m === mode;
      b.style.background = on ? '#f27a1a' : '#f5f5f5'; b.style.color = on ? '#fff' : '#222'; b.style.borderColor = on ? '#f27a1a' : '#bbb';
    });
    $('rp-custom').style.display = mode === 'custom' ? '' : 'none';
    $('rp-last').style.display = mode === 'last' ? '' : 'none';
    const f = $('rp-from').value, t = $('rp-to').value, n = +$('rp-n').value;
    $('rp-sum').textContent = mode === 'all' ? 'Hesaptaki tüm siparişler indirilecek.'
      : /^\d+$/.test(mode) ? `${fmt((d => (d.setMonth(d.getMonth() - +mode), d))(new Date()))} – bugün arası siparişler indirilecek.`
      : mode === 'last' ? `En yeni ${n > 0 ? n : '?'} sipariş indirilecek.`
      : !f ? 'Başlangıç tarihini seç.' : `${fmt(new Date(f))} – ${t ? fmt(new Date(t)) : 'bugün'} arası siparişler indirilecek.`;
  };
  p.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; refresh(); } });
  p.addEventListener('input', refresh);
  refresh();
  $('rp-go').onclick = () => {
    if (mode === 'custom' && !$('rp-from').value) return $('rp-from').focus();
    if (mode === 'last' && !(+$('rp-n').value > 0)) return $('rp-n').focus();
    p.remove();
    resolve({
      months: /^\d+$/.test(mode) ? +mode : null,
      from: mode === 'custom' ? $('rp-from').value || null : null,
      to: mode === 'custom' ? $('rp-to').value || null : null,
      last: mode === 'last' ? +$('rp-n').value : null,
    });
  };
});
const RANGE = await askRange('Amazon TR');
const rangeFrom = RANGE.from || (RANGE.months ? (d => (d.setMonth(d.getMonth() - RANGE.months), d.toLocaleDateString('sv-SE')))(new Date()) : null);
const rangeTo = RANGE.to || null;
// 'YYYY-AA-GG…' -> -1: aralıktan eski, 1: aralıktan yeni, 0: içinde (tarihi okunamayan da 0)
const rangePos = date => { const d = String(date).slice(0, 10); return !/^\d{4}-/.test(d) ? 0 : rangeFrom && d < rangeFrom ? -1 : rangeTo && d > rangeTo ? 1 : 0; };

// AUTO = true (varsayılan): yılları ve sayfaları kendisi gezer. AUTO = false: sadece AÇIK sayfadaki siparişleri alır.
const AUTO = true;
const parseHtml = html => new DOMParser().parseFromString(html, 'text/html');
// Sipariş numaraları: kartın data-csa-c-slot-id değerinden ("...order-card.404-1234567-1234567").
// Ham HTML'de "orderID=" bağlantıları yok (sayfa kodu sonradan üretiyor), bu yüzden bağlantılar yedek.
const idsFrom = doc => [...new Set([
  ...[...doc.querySelectorAll('.order-card[data-csa-c-slot-id]')]
    .map(c => c.getAttribute('data-csa-c-slot-id').match(/order-card\.([\w-]+)$/)?.[1]),
  ...[...doc.querySelectorAll('a[href*="orderID="]')]
    .map(a => a.getAttribute('href').match(/orderID=([\w-]+)/)?.[1]),
].filter(Boolean))];
const isCaptcha = html => /validateCaptcha|Type the characters you see|Karakterleri yazın|api-services-support@amazon/i.test(html);

// İlerleme kutusu
document.getElementById('amz-progress')?.remove();
const box = document.createElement('div');
box.id = 'amz-progress';
box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:999999;background:#222;color:#fff;padding:10px 14px;border-radius:8px;font:14px/1.4 monospace;max-width:420px';
document.body.appendChild(box);
const say = t => { box.textContent = t; console.log('[AMZ] ' + t); };

window.data = [];
window.errors = [];

function download() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const q = new URLSearchParams(location.search);
  a.download = AUTO ? 'amazon-siparisler.json' : `amazon-siparisler-${q.get('timeFilter') || 'sayfa'}-page${q.get('page') ?? '0'}.json`;
  a.click();
}

let stopped = false;      // captcha: her şeyi durdur
let listFailed = false;   // liste isteği hatası: sadece liste gezmeyi bırak, toplananlarla detaylara geç
try {
  // 1) Sipariş numaraları
  //    AUTO = true (varsayılan): yılları ve sayfaları kendisi gezer (2026'dan geriye, art arda 3 boş yılda durur).
  //    AUTO = false: sadece AÇIK sayfadaki siparişleri alır; yılı/sayfayı sen değiştirip tekrar çalıştırırsın.
  const ids = new Map();
  if (!AUTO) idsFrom(document).forEach(id => ids.set(id, 0));
  const thisYear = Math.min(new Date().getFullYear(), rangeTo ? +rangeTo.slice(0, 4) : 9999);
  const firstYear = rangeFrom ? +rangeFrom.slice(0, 4) : 2010;
  let emptyStreak = 0;
  for (let year = thisYear; AUTO && year >= firstYear && emptyStreak < 3 && !(RANGE.last && ids.size >= RANGE.last) && !stopped && !listFailed; year--) {
    let yearCount = 0;
    for (let page = 0; page < 100; page++) {
      let html;
      try {
        const r = await fetch(`/your-orders/orders?timeFilter=year-${year}&page=${page}`, { credentials: 'include' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        html = await r.text();
      } catch (e) {   // liste hatasında dur ama o ana kadar toplananlarla detaylara geç
        errors.push({ orderNo: null, error: `liste ${year} sayfa ${page}: ${e}` });
        listFailed = true; break;
      }
      if (isCaptcha(html)) { errors.push({ orderNo: null, error: 'captcha (liste)' }); stopped = true; break; }
      const fresh = idsFrom(parseHtml(html)).filter(id => !ids.has(id));
      if (!fresh.length) break;
      fresh.forEach(id => ids.set(id, year));
      yearCount += fresh.length;
      say(`Liste: ${year} sayfa ${page}, toplam ${ids.size} sipariş`);
      if (RANGE.last && ids.size >= RANGE.last) break;
      await sleep(1500);
    }
    emptyStreak = yearCount ? 0 : emptyStreak + 1;
  }

  // 2) Her sipariş için detay sayfası
  const list = [...ids.keys()].slice(0, RANGE.last || undefined);
  for (const [i, id] of list.entries()) {
    if (stopped) break;
    try {
      let order;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await fetch(`/your-orders/order-details?orderID=${id}`, { credentials: 'include' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const html = await r.text();
          const doc = parseHtml(html);
          if (!comp(doc, 'orderId')) {
            if (isCaptcha(html)) { stopped = true; throw new Error('captcha'); }
            throw new Error('sipariş alanı bulunamadı');
          }
          order = readOrder(doc);
          break;
        } catch (e) {
          if (attempt === 2 || stopped) throw e;
          await sleep(3000);
        }
      }
      const pos = rangePos(order.date);
      if (pos < 0) break;   // yıl/sayfa sırası yeniden eskiye
      if (pos === 0) data.push(order);
    } catch (e) {
      errors.push({ orderNo: id, error: String(e) });
      data.push({ orderNo: id, date: '-', total: '-', items: [], error: String(e) });
    }
    say(`${i + 1}/${list.length} | kayıt: ${data.length} | hata: ${errors.length}`);
    await sleep(2000);
  }
} catch (e) {
  errors.push({ orderNo: null, error: 'genel hata: ' + String(e) });
  console.error('[AMZ] genel hata', e);
} finally {
  download();
  say(`BİTTİ${stopped ? ' (captcha nedeniyle durduruldu)' : ''}. ${data.length} sipariş, hata ${errors.length}`);
  console.log('[AMZ] hatalar:', errors.length ? errors : 'yok');
}
})();

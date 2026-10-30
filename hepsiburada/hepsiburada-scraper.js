// Hepsiburada "Siparişlerim" sayfası -> JSON (hepsiburada-siparisler.json)
// Kullanım: hepsiburada.com/siparislerim sayfasında DevTools Console'a yapıştır (önce F5).
// Console filtresine [HB] yaz: sadece ilerleme ve hatalar görünür, sayfanın kendi hataları gizlenir.
// Yapıştırınca çıkan kutudan tarih aralığı / son N sipariş seçilir (tümü de seçilebilir).
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = el => el?.textContent.replace(/\s+/g, ' ').trim() || '-';
const parseTR = s => { const n = parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
const fmtTR = n => n == null ? '-' : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';


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
const RANGE = await askRange('Hepsiburada');
const rangeFrom = RANGE.from || (RANGE.months ? (d => (d.setMonth(d.getMonth() - RANGE.months), d.toLocaleDateString('sv-SE')))(new Date()) : null);
const rangeTo = RANGE.to || null;
// 'YYYY-AA-GG…' -> -1: aralıktan eski, 1: aralıktan yeni, 0: içinde (tarihi okunamayan da 0)
const rangePos = date => { const d = String(date).slice(0, 10); return !/^\d{4}-/.test(d) ? 0 : rangeFrom && d < rangeFrom ? -1 : rangeTo && d > rangeTo ? 1 : 0; };

// İlerleme kutusu
document.getElementById('hb-progress')?.remove();
const box = document.createElement('div');
box.id = 'hb-progress';
box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:999999;background:#222;color:#fff;padding:10px 14px;border-radius:8px;font:14px/1.4 monospace;max-width:420px';
document.body.appendChild(box);
const say = t => { box.textContent = t; console.log('[HB] ' + t); };

window.data = [];
window.errors = [];

function download() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'hepsiburada-siparisler.json';
  a.click();
}

// "21 Ağustos 2026" -> "2026-08-21"
const MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const rowDate = r => {
  const m = clean(r.querySelector('.order-row__summary__price-and-date span')).toLocaleLowerCase('tr').match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  const mo = m ? MONTHS.indexOf(m[2]) + 1 : 0;
  return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}` : '-';
};
const allRows = () => [...document.querySelectorAll('.order-row')];

function readItem(c) {
  const a = c.querySelector('.product-card__content__title a');
  const href = a?.href || '-';
  const quantity = Number(c.querySelector('.product-card__image .solo-badge')?.textContent.match(/x(\d+)/)?.[1] || 1);
  const price = clean(c.querySelector('.product-card__content__price span'));
  const total = parseTR(price);
  return {
    name: clean(a),
    quantity,                                   // rozet yoksa 1 varsayıldı
    price,                                      // satır toplamı (adet dahil)
    unitPrice: total == null ? '-' : fmtTR(total / quantity),
    productCode: href.match(/-p-([A-Za-z0-9]+)/)?.[1] || '-',
    url: href,
    image: c.querySelector('.product-card__image img')?.src || '-',
  };
}

function readShipments(r) {
  const groups = [...r.querySelectorAll('.order-detail-cards__item-container')];
  const roots = groups.length ? groups : [r];
  return roots.map(g => {
    const dateEls = g.querySelectorAll('.lineitem-content__header__content .date b');
    return {
      seller: clean(g.querySelector('.merchant-bar__merchant a span')),
      deliveryStatus: clean(g.querySelector('.lineitem-content__header__content .title')),
      deliveryDate: dateEls[0] ? clean(dateEls[0]) : '-',
      receivedBy: dateEls[1] ? clean(dateEls[1]) : '-',
      trackingCode: g.querySelector('a.action-button--cargo-tracking')?.getAttribute('href')?.split('/').pop() || '-',
      items: [...g.querySelectorAll('.product-card')].map(readItem),
    };
  });
}

function readAddress(r) {
  const el = r.querySelector('.order-information__column--shipping-address address');
  if (!el) return { label: '-', detail: '-', region: '-', recipient: '-' };
  return {
    label: clean(el.querySelector('p:not([data-highlight-binder]) b')),
    detail: clean(el.querySelector('p[data-highlight-binder="shippingAddress.addressDetail"]')),
    region: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim() || '-',
    recipient: clean([...el.children].filter(e => e.tagName === 'B').pop()),
  };
}

function readPayments(r) {
  return [...r.querySelectorAll('.payment-info-card')].map(p => ({
    amount: clean(p.querySelector('.payment-info-card__info__amount')),
    method: clean(p.querySelector('.payment-info-card__info__detail')),
    card: clean(p.querySelector('.payment-info-card__info__card-number')),
  }));
}

function readAmounts(r) {
  const o = {};
  r.querySelectorAll('.order-information__group').forEach(g => {
    const k = g.querySelector('.order-information__group__key');
    const v = g.querySelector('.order-information__group__value');
    if (k && v) o[clean(k)] = clean(v);
  });
  return o;
}

function readCampaigns(r) {
  return [...r.querySelectorAll('.order-info-campaign__group')].map(c => ({
    name: clean(c.querySelector('.order-info-campaign__group__name')),
    discount: clean(c.querySelector('.order-info-campaign__group__discount-amount')),
  }));
}

try {
  // 1) Hepsini yükle
  // (liste yeniden eskiye sıralı: yeterince sipariş ya da aralıktan eski sipariş gelince yüklemeyi bırak)
  let last = -1;
  while (allRows().length !== last) {
    last = allRows().length;
    if ((RANGE.last && last >= RANGE.last) || (last && rangePos(rowDate(allRows()[last - 1])) < 0)) break;
    say(`Yükleniyor… ${last} sipariş`);
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1500);
  }

  // 2) Her satırı aç ve oku
  const rows = allRows().filter(r => rangePos(rowDate(r)) === 0).slice(0, RANGE.last || undefined);
  for (const [i, r] of rows.entries()) {
    const orderNo = clean(r.querySelector('.order-number b')).replace(/\s/g, '');
    try {
      if (!r.querySelector('.product-card')) {
        r.querySelector('.order-row__summary').click();
      }
      // ürün kartı + adres gelene kadar bekle (en fazla 6 sn)
      for (let t = 0; t < 30; t++) {
        if (r.querySelector('.product-card') && r.querySelector('.order-information__column--shipping-address address')) break;
        await sleep(200);
      }

      const shipments = readShipments(r);
      const address = readAddress(r);
      // düz ürün listesi: her ürüne satıcı + kendi kargo durumu/takip kodu
      const items = shipments.flatMap(s => s.items.map(it => ({
        ...it,
        seller: s.seller,
        deliveryStatus: s.deliveryStatus,
        trackingCode: s.trackingCode,
      })));

      data.push({
        orderNo,
        status: clean(r.querySelector('.order-row-summary__single-status span') || r.querySelector('.order-row__summary__progress-bar')),
        date: clean(r.querySelector('.order-row__summary__price-and-date span')),
        total: clean(r.querySelector('.order-row__summary__price-and-date b')),
        address,
        shipments,
        payments: readPayments(r),
        amounts: readAmounts(r),
        campaigns: readCampaigns(r),
        items: items.length ? items : [{ name: '-', quantity: '-', price: '-', unitPrice: '-' }],
      });

      if (!items.length) errors.push({ orderNo, error: 'ürün gelmedi' });
      if (address.detail === '-') errors.push({ orderNo, error: 'adres gelmedi' });
    } catch (e) {
      errors.push({ orderNo, error: String(e) });
      data.push({ orderNo, status: '-', date: '-', total: '-', address: { label: '-', detail: '-', region: '-', recipient: '-' }, shipments: [], payments: [], amounts: {}, campaigns: [], items: [{ name: '-', quantity: '-', price: '-', unitPrice: '-' }], error: String(e) });
    }
    say(`${i + 1}/${rows.length} | kayıt: ${data.length} | hata: ${errors.length}`);
  }
} catch (e) {
  errors.push({ orderNo: null, error: 'genel hata: ' + String(e) });
  console.error('[HB] genel hata', e);
} finally {
  download();
  say(`BİTTİ. ${data.length} kayıt, hata ${errors.length}`);
  console.log('[HB] hatalar:', errors.length ? errors : 'yok');
}

// Hepsiburada "Siparişlerim" sayfası -> JSON (hepsiburada-siparisler.json)
// Kullanım: hepsiburada.com/siparislerim sayfasında DevTools Console'a yapıştır (önce F5).
// Console filtresine [HB] yaz: sadece ilerleme ve hatalar görünür, sayfanın kendi hataları gizlenir.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = el => el?.textContent.replace(/\s+/g, ' ').trim() || '-';
const parseTR = s => { const n = parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
const fmtTR = n => n == null ? '-' : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';

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
  let last = -1;
  while (document.querySelectorAll('.order-row').length !== last) {
    last = document.querySelectorAll('.order-row').length;
    say(`Yükleniyor… ${last} sipariş`);
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1500);
  }

  // 2) Her satırı aç ve oku
  const rows = [...document.querySelectorAll('.order-row')];
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

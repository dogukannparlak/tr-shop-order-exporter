// Trendyol Milla "Siparişlerim" sayfası -> JSON (trendyol-milla-siparisler.json)
// Kullanım: trendyol-milla.com/hesabim/siparislerim LİSTE sayfasında DevTools Console'a yapıştır.
// Console filtresine [MILLA] yaz: sadece ilerleme ve hatalar görünür.
// (Fonksiyon içinde çalışır: aynı sayfada tekrar yapıştırınca "already declared" hatası vermez.)
(async () => {
const dt = ms => ms > 0 ? new Date(ms).toLocaleString('sv-SE', { hour12: false }).slice(0, 16) : '-';
const num = x => (x === undefined || x === null || x === '') ? '-' : Number(x);
const val = x => (x === undefined || x === null || x === '') ? '-' : x;

const STATUS_TR = {
  ORDER_COMPLETE: 'Sipariş tamamlandı', CREATING_ORDER: 'Sipariş hazırlanıyor', OUTBOUND_CREATED: 'Sipariş oluşturuldu',
  OUTBOUND_PREPARING: 'Hazırlanıyor', OUTBOUND_SHIPPED: 'Kargoya verildi', OUTBOUND_SHIPPED_INSTANT: 'Kargoya verildi',
  OUTBOUND_DELIVERED: 'Teslim edildi', OUTBOUND_UNDELIVERED: 'Teslim edilemedi', OUTBOUND_RETURNED: 'Geri gönderildi',
  OUTBOUND_ATCOLLECTIONPOINT: 'Gel Al noktasında', CANCEL: 'İptal edildi', INBOUND_CREATED: 'İade talebi oluşturuldu',
  INBOUND_SHIPPED: 'İade kargoda', INBOUND_WAITINGINACTION: 'İade inceleniyor', INBOUND_ACCEPTED: 'İade edildi',
  INBOUND_REJECTED: 'İade reddedildi',
};
const PAY_TYPE_TR = { PAY_WITH_CARD: 'Kart', PAY_WITH_WALLET: 'Cüzdan' };
const statusTr = k => STATUS_TR[k] || k || '-';

function parseProps(json) {
  const m = json.main;
  const k = 'window["__m-order-detail__PROPS"]=';
  const i = m.indexOf(k);
  if (i < 0) throw new Error('props bulunamadı');
  const s = m.indexOf('{', i);
  const e = m.indexOf('</script>', s);
  return JSON.parse(m.slice(s, e).replace(/;\s*$/, ''));
}

const fmtAddr = a => !a ? { fullName: '-', address: '-', neighborhood: '-', district: '-', city: '-', phone: '-' } : {
  fullName: [a.firstName, a.lastName].filter(Boolean).join(' ') || '-',
  address: [a.address1, a.address2].filter(Boolean).join(' ') || '-',
  neighborhood: val(a.neighborhood), district: val(a.district), city: val(a.city), phone: val(a.maskedPhone),
};

function addToUrlMap(map, list) {
  for (const o of list) for (const p of (o.products || [])) {
    const id = p.productUrl?.match(/-p-(\d+)/)?.[1];
    if (id) map.set(`${o.id}:${id}`, 'https://www.trendyol-milla.com' + p.productUrl);
  }
}

function buildOrder(props, urlMap) {
  const od = props.orderDetail;
  const order = od.order;
  const pay = od.payment?.paymentDetail || {};
  const items = [];
  for (const [no, sh] of Object.entries(od.shipments || {})) {
    const sd = sh.shipmentDetails || {};
    const ob = sd.outbound || {};
    const d = sd.shipmentDateDetails || {};
    for (const [state, lines] of Object.entries(sh.products || {})) {
      for (const l of lines) {
        const p = l.product || {};
        const pr = p.price || {};
        const quantity = l.quantity ?? '-';
        const priceRaw = [pr.finalPrice, pr.sellingPrice, pr.discountedPrice, pr.originalPrice].find(x => x !== undefined && x !== null && x !== '');
        const unitPrice = num(priceRaw);
        items.push({
          name: [p.brand?.name, p.name].filter(Boolean).join(' ') || '-',
          quantity,
          unitPrice,
          lineTotal: (typeof quantity === 'number' && typeof unitPrice === 'number') ? Math.round(quantity * unitPrice * 100) / 100 : '-',
          productId: val(p.productContentId),
          url: urlMap.get(`${order.orderNumber}:${p.productContentId}`) || '-',
          image: p.images?.[0] || '-',
          seller: val(p.supplier?.name || sd.supplier?.name),
          variant: val(p.variant?.name),
          category: val(l.productCategory),
          status: statusTr(state),
          cargoCompany: val(ob.cargoProviderName),
          trackingNumber: val(ob.cargoTrackingNumber),
          deliveredAt: dt(d.deliveredDate),
          deliveredTo: val(ob.deliveredTo),
        });
      }
    }
  }
  // tek ürün satırlı siparişte fiyat hiç yoksa ara toplamdan hesapla (priceEstimated: true)
  const sub = num(pay.productSubTotal);
  if (items.length === 1 && items[0].unitPrice === '-' && typeof sub === 'number' && typeof items[0].quantity === 'number' && items[0].quantity > 0) {
    items[0].unitPrice = Math.round(sub / items[0].quantity * 100) / 100;
    items[0].lineTotal = sub;
    items[0].priceEstimated = true;
  }
  return {
    orderNo: order.orderNumber,
    date: dt(order.orderDate),
    status: statusTr(order.orderState),
    total: num(pay.totalCharges),
    address: fmtAddr(od.address?.commonShipmentAddress),
    payment: {
      type: PAY_TYPE_TR[pay.paymentOptionName] || val(pay.paymentOptionName),
      method: pay.installmentCount > 1 ? `${pay.installmentCount} taksit` : (pay.installmentCount === 1 ? 'Tek çekim' : (PAY_TYPE_TR[pay.paymentOptionName] || '-')),
      card: val(pay.maskedCardNumber), cardType: val(pay.cardType), bank: val(pay.creditCardBankName),
      subTotal: num(pay.productSubTotal), cargo: num(pay.cargo), bonus: num(pay.reward?.usableAmount),
      serviceFee: num(pay.paymentServiceFee), installmentFee: num(pay.installmentCost), additionalFee: num(pay.additionalFee),
      total: num(pay.totalCharges),
    },
    discounts: [...(od.payment?.discounts || []), ...(od.payment?.coupons || [])].map(x => ({ name: x.name, amount: x.amount })),
    items: items.length ? items : [{ name: '-', quantity: '-', unitPrice: '-', lineTotal: '-' }],
  };
}

// ---- AYAR: hangi siparişler alınsın? (hepsi null = tüm siparişler) ----
// months: son N ay (1, 3, 6, 12…) · from / to: özel aralık, 'YYYY-AA-GG' · last: en yeni N sipariş
const RANGE = { months: null, from: null, to: null, last: null };
const rangeFrom = RANGE.from || (RANGE.months ? (d => (d.setMonth(d.getMonth() - RANGE.months), d.toLocaleDateString('sv-SE')))(new Date()) : null);
const rangeTo = RANGE.to || null;
// 'YYYY-AA-GG…' -> -1: aralıktan eski, 1: aralıktan yeni, 0: içinde (tarihi okunamayan da 0)
const rangePos = date => { const d = String(date).slice(0, 10); return !/^\d{4}-/.test(d) ? 0 : rangeFrom && d < rangeFrom ? -1 : rangeTo && d > rangeTo ? 1 : 0; };

const GW = 'https://apigw.trendyol-milla.com/discovery-sfint-order-service';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// İlerleme kutusu
document.getElementById('milla-progress')?.remove();
const box = document.createElement('div');
box.id = 'milla-progress';
box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:999999;background:#222;color:#fff;padding:10px 14px;border-radius:8px;font:14px/1.4 monospace;max-width:420px';
document.body.appendChild(box);
const say = t => { box.textContent = t; console.log('[MILLA] ' + t); };

window.data = [];
window.errors = [];

function download() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'trendyol-milla-siparisler.json';
  a.click();
}

try {
  // 1) Liste API'sinden tüm sipariş numaraları + ürün linkleri
  const ids = [];
  const urlMap = new Map();
  for (let page = 1; page <= 100; page++) {
    const r = await fetch(`${GW}/api/orders/?page=${page}&limit=20&channelId=8`, { credentials: 'include' });
    if (!r.ok) throw new Error(`liste sayfa ${page}: HTTP ${r.status}`);
    const list = await r.json();
    if (!Array.isArray(list) || !list.length) break;
    list.forEach(o => ids.push(o.id));
    addToUrlMap(urlMap, list);
    if (RANGE.last && ids.length >= RANGE.last) break;
    say(`Liste okunuyor… sayfa ${page}, toplam ${ids.length} sipariş`);
    if (list.length < 20) break;
    await sleep(400);
  }

  if (RANGE.last) ids.length = Math.min(ids.length, RANGE.last);

  // 2) Her sipariş için detay (liste yeniden eskiye sıralı: aralıktan eskiye inince dur)
  for (const [i, id] of ids.entries()) {
    try {
      let props;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const u = `${GW}/m-order-detail/hesabim/siparislerim/${id}?__renderMode=stream&if=true&app=false&channelId=8&storefrontId=1&language=tr&countryCode=TR&tld=.com&subPathStrategy=no-subpath`;
          const r = await fetch(u, { credentials: 'include' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          props = parseProps(await r.json());
          break;
        } catch (e) {
          if (attempt === 2) throw e;
          await sleep(1500);
        }
      }
      const order = buildOrder(props, urlMap);
      const pos = rangePos(order.date);
      if (pos < 0) break;
      if (pos === 0) data.push(order);
    } catch (e) {
      errors.push({ orderNo: id, error: String(e) });
      data.push({ orderNo: id, date: '-', status: '-', total: '-', items: [], error: String(e) });
    }
    say(`${i + 1}/${ids.length} | kayıt: ${data.length} | hata: ${errors.length}`);
    await sleep(500);
  }
} catch (e) {
  errors.push({ orderNo: null, error: 'genel hata: ' + String(e) });
  console.error('[MILLA] genel hata', e);
} finally {
  download();
  say(`BİTTİ. ${data.length} sipariş, hata ${errors.length}`);
  console.log('[MILLA] hatalar:', errors.length ? errors : 'yok');
}
})();

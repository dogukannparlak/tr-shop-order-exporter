// Temu "Siparişlerin" sayfası -> JSON (temu-siparisler.json)
// Kullanım: temu.com/tr/bgt_orders.html sayfasında (giriş yapılmış) DevTools Console'a yapıştır.
// Console filtresine [TEMU] yaz: sadece ilerleme ve hatalar görünür.
// Liste: api/bg/aristotle/user_order_list (POST, imzasız çalışıyor). Detay: bgt_order_detail.html içindeki window.rawData.
// İadeler: api/bg/jayce/parent_after_sales_list ("İadeler" sekmesi); ürüne alt sipariş no (subOrderNo) ile işlenir.
// (Fonksiyon içinde çalışır: aynı sayfada tekrar yapıştırınca "already declared" hatası vermez.)
(async () => {
const dt = s => s > 0 ? new Date(s * 1000).toLocaleString('sv-SE', { hour12: false }).slice(0, 16) : '-';
const dtMs = ms => dt(Math.floor((ms || 0) / 1000));
const val = x => (x === undefined || x === null || x === '') ? '-' : x;
const kurus = x => (typeof x === 'number') ? Math.round(x) / 100 : '-';
// "1.234,56 TL" -> 1234.56, "-529,82 TL" -> -529.82, "ÜCRETSİZ" -> 0
const money = s => {
  if (s === undefined || s === null) return '-';
  if (/ücretsiz/.test(String(s).toLocaleLowerCase('tr'))) return 0;
  const m = String(s).replace(/\s/g, '').match(/-?[\d.]+(,\d+)?/);
  return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : '-';
};
const maskPhone = p => p ? String(p).replace(/^(\d{3})\d+(\d{2})$/, (_, a, b) => a + '*****' + b) : '-';
const absUrl = u => !u ? '-' : /^https?:/.test(u) ? u : 'https://www.temu.com/tr/' + u.replace(/^\/(tr\/)?/, '');

// rawData'yı HTML'den çıkar: JSON'dan sonra başka kod geldiği için parantez sayarak kes
function parseRawData(h) {
  const i = h.indexOf('window.rawData');
  if (i < 0) throw new Error('rawData bulunamadı (oturum düşmüş olabilir)');
  const s = h.indexOf('{', i);
  let d = 0, inS = false, esc = false;
  for (let k = s; k < h.length; k++) {
    const c = h[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') inS = true;
    else if (c === '{') d++;
    else if (c === '}' && --d === 0) return JSON.parse(h.slice(s, k + 1));
  }
  throw new Error('rawData kapanmadı');
}

const fmtAddr = a => !a ? { fullName: '-', address: '-', neighborhood: '-', district: '-', city: '-', phone: '-' } : {
  fullName: val(a.receiveName),
  address: [a.addressLine1, a.addressLine2].filter(Boolean).join(' ') || '-',
  neighborhood: val(a.regionName4), district: val(a.regionName3), city: val(a.regionName2), phone: maskPhone(a.contactMobile),
};

function buildOrder(listOrder, store, refunds) {
  const c = store.combineOrderDetail || {};
  const pay = store.paymentInfo || {};
  const status = val(c.orderStatus?.orderStatusPrompt || listOrder.status_prompt);
  // Ödeme dökümü: Satış Fiyatı, Kargo, İthalat vergisi, Fiyat Avantajı, kuponlar…
  const breakdown = (pay.paymentContentList || []).map(r => ({
    name: String(r.key?.displayContent ?? '-').replace(/:\s*$/, ''),
    amount: money(r.value?.displayContent),
  }));
  const pick = re => breakdown.find(b => re.test(b.name))?.amount ?? '-';
  const methods = pay.paymentMethodList || [];
  // "Visa ...1234", "Mastercard", "Kredi bakiyesi" (Temu kredisi); kart = son 4 hanesi olan ilk yöntem
  const accts = methods.map(m => String(m.payAccountDetail || '').trim()).filter(Boolean);
  const cardAcct = accts.find(a => /\d{4}$/.test(a)) || accts.find(a => !/bakiye/i.test(a)) || '';
  const total = methods.length ? Math.round(methods.reduce((s, m) => s + (m.payAmount || 0), 0)) / 100 : money(listOrder.price_desc?.display_amount);
  const listSn = new Map((listOrder.order_list || []).map(l => [l.order_sn, l]));
  const items = (store.orderInfoList || []).map(o => {
    const after = (o.afterSalesInfoList || []).map(a => a.statusPrompt).filter(Boolean).join('; ');
    const quantity = o.goodsNumber ?? '-';
    // goodsPrice birim fiyat, goodsAmount satır toplamı (kuruş)
    const unitPrice = kurus(o.goodsPrice);
    const lineTotal = kurus(o.goodsAmount ?? listSn.get(o.orderSn)?.goods_amount);
    // alt sipariş no detayda "PO-203-…", iade listesinde "203-…"
    const itemRefunds = [...(refunds.bySub.get(String(o.orderSn).replace(/^PO-/, '')) || [])];
    // İptal edilen ürünlerin iadesi "İadeler" listesinde yok; satır tutarı kadar iade sayılır
    const cancelled = /İptal edilen/i.test(after);
    if (cancelled && !itemRefunds.some(r => r.amount > 0)) {
      itemRefunds.push({ refundNo: '-', date: '-', status: 'İptal edildi', quantity: quantity, amount: lineTotal, estimated: true });
    }
    const done = itemRefunds.filter(r => r.amount > 0);
    return {
      name: val(o.goodsName),
      quantity,
      unitPrice,
      lineTotal,
      retailPrice: kurus(o.goodsRetailPrice),
      productId: val(o.goodsId),
      skuId: val(o.skuId),
      subOrderNo: val(o.orderSn),
      url: absUrl(o.goodsLinkUrl),
      image: val(o.thumbUrl),
      seller: '-',
      sellerId: val(o.mallId),
      variant: val(o.spec),
      category: '-',
      status: after || status,
      cancelled,
      refundedQty: done.reduce((t, r) => t + r.quantity, 0),
      refundedAmount: Math.round(done.reduce((t, r) => t + r.amount, 0) * 100) / 100,
      refunds: itemRefunds,
    };
  });
  const parentRefunds = refunds.byParent.get(listOrder.parent_order_sn) || [];
  // Tamamı iptal edilen siparişte ödenen toplamın hepsi geri döner (iade listesinde kaydı yok)
  const allCancelled = items.length > 0 && items.every(i => i.cancelled);
  return {
    orderNo: listOrder.parent_order_sn,
    date: dt(listOrder.parent_order_time),
    status,
    total,
    address: fmtAddr(store.logistics || c.logistics),
    payment: {
      type: val(accts.join(' + ')),
      card: (cardAcct.match(/\d{4}$/) || ['-'])[0],
      cardType: val(cardAcct.replace(/[\s.*]*\d{4}$/, '').trim()),
      bank: '-',
      paidAt: val(methods[0]?.tradePayTimeFormat),
      subTotal: pick(/^Satış Fiyatı/i),
      cargo: pick(/^Kargo/i),
      importTax: pick(/İthalat/i),
      total,
    },
    discounts: breakdown.filter(b => typeof b.amount === 'number' && b.amount < 0).map(b => ({ name: b.name, amount: b.amount })),
    breakdown,
    // iade talebi başına: tutar ithalat vergisi payı dahil (ürün satırlarındaki refundedAmount hariç)
    cancelled: allCancelled,
    refunds: parentRefunds,
    refundTotal: allCancelled && typeof total === 'number' ? total
      : Math.round(parentRefunds.reduce((t, r) => t + (typeof r.amount === 'number' ? r.amount : 0), 0) * 100) / 100,
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// İlerleme kutusu
document.getElementById('temu-progress')?.remove();
const box = document.createElement('div');
box.id = 'temu-progress';
box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:999999;background:#222;color:#fff;padding:10px 14px;border-radius:8px;font:14px/1.4 monospace;max-width:420px';
document.body.appendChild(box);
const say = t => { box.textContent = t; console.log('[TEMU] ' + t); };

window.data = [];
window.errors = [];

function download() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'temu-siparisler.json';
  a.click();
}

try {
  // 1) Liste API'si: offset_map bir önceki cevaptan gelir, has_next_page false olunca biter
  const orders = [];
  let offsetMap = {}, done = false;
  for (let page = 1; page <= 200; page++) {
    const body = {
      need_has_next_page: true, page_sn: 10054, page, size: 10, type: 'all', offset: null,
      offset_map: offsetMap, sort_values_map: {}, extra_map: { need_after_sales_display_vo: 1 },
    };
    const r = await fetch('/tr/api/bg/aristotle/user_order_list', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`liste sayfa ${page}: HTTP ${r.status}`);
    const j = await r.json();
    const list = j.view_orders || [];
    for (const o of list.filter(o => o.parent_order_sn)) {   // liste yeniden eskiye sıralı
      const pos = rangePos(dt(o.parent_order_time));
      if (pos < 0 || (RANGE.last && orders.length >= RANGE.last)) { done = true; break; }
      if (pos === 0) orders.push(o);
    }
    say(`Liste okunuyor… sayfa ${page}, toplam ${orders.length} sipariş`);
    if (done || !j.has_next_page || !list.length) break;
    offsetMap = j.offset_map || {};
    await sleep(600);
  }

  // 2) İadeler: next_query_created_at ile sayfalanır
  const refunds = { bySub: new Map(), byParent: new Map() };
  let cursor = null, nRefund = 0;
  for (let page = 1; page <= 200; page++) {
    const r = await fetch('/tr/api/bg/jayce/parent_after_sales_list', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 10, last_query_min_created_at: cursor }),
    });
    if (!r.ok) throw new Error(`iade sayfa ${page}: HTTP ${r.status}`);
    const res = (await r.json()).result || {};
    for (const v of res.parent_after_sales_vo_list || []) {
      nRefund++;
      const date = dtMs(v.apply_time);
      // [["", "299,68", " TL"], ["", "17,56", " TL", "(kredi)"]]
      const parts = (v.refund_amount_str_list || []).map(a => ({ amount: money(a[1]), credit: (a[3] || '').includes('kredi') }));
      const list = refunds.byParent.get(v.parent_order_sn) || [];
      list.push({
        refundNo: v.parent_after_sales_sn, date, status: val(v.status_desc),
        amount: parts.length ? Math.round(parts.reduce((t, p) => t + (typeof p.amount === 'number' ? p.amount : 0), 0) * 100) / 100 : 0,
        toCredit: Math.round(parts.filter(p => p.credit).reduce((t, p) => t + p.amount, 0) * 100) / 100,
        items: (v.sub_after_sales_vo_list || []).map(x => x.order_sn),
      });
      refunds.byParent.set(v.parent_order_sn, list);
      for (const x of v.sub_after_sales_vo_list || []) {
        const l = refunds.bySub.get(x.order_sn) || [];
        l.push({ refundNo: x.after_sales_sn, date: dtMs(x.create_at), status: val(v.status_desc), quantity: x.return_goods_number ?? 0, amount: kurus(x.refund_amount ?? 0) });
        refunds.bySub.set(x.order_sn, l);
      }
    }
    say(`İadeler okunuyor… sayfa ${page}, toplam ${nRefund} iade`);
    if (!res.has_next_query || !res.next_query_created_at) break;
    cursor = res.next_query_created_at;
    await sleep(600);
  }

  // 3) Her sipariş için detay sayfası
  for (const [i, o] of orders.entries()) {
    try {
      let store;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await fetch(`/tr/bgt_order_detail.html?parent_order_sn=${encodeURIComponent(o.parent_order_sn)}`, { credentials: 'include' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          store = parseRawData(await r.text()).store;
          if (!store?.orderInfoList) throw new Error('detayda ürün yok');
          break;
        } catch (e) {
          if (attempt === 2) throw e;
          await sleep(2000);
        }
      }
      data.push(buildOrder(o, store, refunds));
    } catch (e) {
      errors.push({ orderNo: o.parent_order_sn, error: String(e) });
      data.push({ orderNo: o.parent_order_sn, date: dt(o.parent_order_time), status: val(o.status_prompt), total: money(o.price_desc?.display_amount), items: [], error: String(e) });
    }
    say(`${i + 1}/${orders.length} | kayıt: ${data.length} | hata: ${errors.length}`);
    await sleep(800);
  }
} catch (e) {
  errors.push({ orderNo: null, error: 'genel hata: ' + String(e) });
  console.error('[TEMU] genel hata', e);
} finally {
  if (!window.TEMU_NO_DOWNLOAD) download();
  say(`BİTTİ. ${data.length} sipariş, hata ${errors.length}`);
  console.log('[TEMU] hatalar:', errors.length ? errors : 'yok');
}
})();

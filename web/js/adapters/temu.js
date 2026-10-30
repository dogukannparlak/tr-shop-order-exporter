// Temu: ürün satırları ithalat vergisini ve kuponu içermez, sipariş toplamı içerir.
// Ödenen = sipariş toplamı, ürünlere satır tutarıyla orantılı dağıtılır (çıkarım).
// İade = siparişin vergili iade toplamı, ürünlere refundedAmount (vergisiz) oranında dağıtılır.
// refundedQty güvenilir değil: "fiyat ayarlaması" iadeleri de adet sayıyor; tam iade tutardan anlaşılır.
(function (SD) {
  SD.adapters.temu = {
    store: 'temu', label: 'Temu',
    detect: o => String(o?.orderNo).startsWith('PO-') && o.payment && 'importTax' in o.payment,
    toItems(o) {
      const p = o.payment || {};
      const card = SD.dash(p.card);
      const pay = card ? { last4: card, brand: SD.dash(p.cardType)?.toUpperCase() } : { method: SD.dash(p.type) || 'Kredi bakiyesi' };
      const items = o.items || [];
      const orderTotal = SD.parseTL(o.total);
      const lineSum = items.reduce((a, i) => a + (SD.parseTL(i.lineTotal) || 0), 0);
      const refundTotal = SD.parseTL(o.refundTotal) || 0;
      const refundSum = items.reduce((a, i) => a + (SD.parseTL(i.refundedAmount) || 0), 0);
      return items.map(i => {
        const line = SD.parseTL(i.lineTotal);
        const paid = line != null && lineSum && orderTotal != null ? orderTotal * line / lineSum : null;
        const refund = refundSum ? refundTotal * (SD.parseTL(i.refundedAmount) || 0) / refundSum : 0;
        const state = i.cancelled || o.cancelled ? 'iptal' : paid != null && refund >= paid - 0.5 ? 'iade' : 'ok';
        return {
          store: 'temu', orderNo: o.orderNo, date: SD.parseDate(o.date),
          name: SD.dash(i.name) || '(adsız ürün)',
          qty: typeof i.quantity === 'number' ? i.quantity : null,
          unit: SD.parseTL(i.unitPrice),
          total: paid == null ? null : state === 'ok' ? paid - refund : paid,   // harcamada iade sonrası net
          tax: paid != null && line != null ? paid - line : null,
          refund: refund || null,
          estimated: false,
          recipient: SD.dash(o.address?.fullName),
          category: null,
          seller: null,
          variant: SD.dash(i.variant),
          statusText: SD.dash(i.status) || SD.dash(o.status),
          state,
          pay, url: SD.dash(i.url), image: SD.dash(i.image),
          orderTotal,
        };
      });
    },
  };
})(window.SD);

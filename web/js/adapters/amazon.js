// Amazon TR: ödeme { method, last4 }, alıcı address.name, sipariş durumu yok (ürün durumundan).
(function (SD) {
  SD.adapters.amazon = {
    store: 'amazon', label: 'Amazon',
    detect: o => o?.payment && 'last4' in o.payment && !String(o.orderNo).startsWith('PO-'),
    toItems(o) {
      const p = o.payment || {};
      const last4 = SD.dash(p.last4);
      const method = SD.dash(p.method);
      const pay = last4
        ? { last4, brand: /^visa/i.test(method || '') ? 'VISA' : 'MASTERCARD' }
        : { method: /^hediye/i.test(method || '') ? 'Hediye çeki' : 'Ödeme yok' };   // "Mevcut ücret yok" = iptal
      return (o.items || []).map(i => ({
        store: 'amazon', orderNo: o.orderNo, date: SD.parseDate(o.date),
        name: SD.dash(i.name) || '(adsız ürün)',
        qty: typeof i.quantity === 'number' ? i.quantity : null,
        unit: SD.parseTL(i.unitPrice),
        total: SD.parseTL(i.lineTotal),
        estimated: false,
        recipient: SD.dash(o.address?.name),
        category: null,
        seller: SD.dash(i.seller),
        variant: null,
        statusText: SD.dash(i.status),
        state: SD.classify(i.status, i.statusText),
        pay, url: SD.dash(i.url), image: SD.dash(i.image),
        orderTotal: SD.parseTL(o.total),
      }));
    },
  };
})(window.SD);

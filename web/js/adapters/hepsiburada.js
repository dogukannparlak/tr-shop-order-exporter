// Hepsiburada: fiyatlar metin ("1.299,00 TL"), tarih "05 Ekim 2026", kart "0000 00** **** 0000".
(function (SD) {
  function pay(o) {
    const ps = o.payments || [];
    const withCard = ps.find(p => SD.dash(p.card));
    if (withCard) {
      const c = withCard.card.replace(/\s/g, '');
      return { last4: c.slice(-4), bin6: c.slice(0, 6), brand: c[0] === '4' ? 'VISA' : 'MASTERCARD' };
    }
    const m = ps.map(p => p.method || '').join(' ');
    return { method: ['Hepsipay', 'Hepsiburada Limiti'].find(x => m.includes(x)) || SD.dash(ps[0]?.method) };
  }

  SD.adapters.hepsiburada = {
    store: 'hepsiburada', label: 'Hepsiburada',
    detect: o => Array.isArray(o?.shipments) || Array.isArray(o?.payments),
    toItems(o) {
      const p = pay(o);
      return (o.items || []).map(i => ({
        store: 'hepsiburada', orderNo: o.orderNo, date: SD.parseDate(o.date),
        name: SD.dash(i.name) || '(adsız ürün)',
        qty: typeof i.quantity === 'number' ? i.quantity : null,
        unit: SD.parseTL(i.unitPrice),
        total: SD.parseTL(i.price),   // HB'de price = satır toplamı
        estimated: false,
        recipient: SD.dash(o.address?.recipient),
        category: null,
        seller: SD.dash(i.seller),
        variant: null,
        statusText: SD.dash(i.deliveryStatus) || SD.dash(o.status),
        state: SD.classify(i.deliveryStatus, o.status),
        pay: p, url: SD.dash(i.url), image: SD.dash(i.image),
        orderTotal: SD.parseTL(o.total),
      }));
    },
  };
})(window.SD);

// Trendyol ve Trendyol Milla: aynı scraper altyapısı, aynı alanlar.
(function (SD) {
  const BANKA_ADI = { 'QNB Finansbank': 'QNB', Finansbank: 'QNB' };

  function make(store, label) {
    return {
      store, label,
      detect: o => o?.payment && 'type' in o.payment && Array.isArray(o.items) &&
        (store === 'trendyol-milla') === o.items.some(i => /trendyol-milla\.com/.test(i.url || '')),
      toItems(o) {
        const date = SD.parseDate(o.date);
        const p = o.payment || {};
        const card = SD.dash(p.card);
        const pay = card
          ? { last4: card.slice(-4), bin6: card.slice(0, 6), brand: SD.dash(p.cardType), bank: BANKA_ADI[p.bank] || SD.dash(p.bank) }
          : { method: 'Trendyol Cüzdan' };
        return (o.items || []).map(i => ({
          store, orderNo: o.orderNo, date,
          name: SD.dash(i.name) || '(adsız ürün)',
          qty: typeof i.quantity === 'number' ? i.quantity : null,
          unit: SD.parseTL(i.unitPrice),
          total: SD.parseTL(i.lineTotal),
          estimated: !!i.priceEstimated,
          recipient: SD.dash(o.address?.fullName),
          category: SD.dash(i.category),
          seller: SD.dash(i.seller),
          variant: SD.dash(i.variant),
          statusText: SD.dash(i.status) || SD.dash(o.status),
          state: SD.classify(i.status, o.status),
          pay, url: SD.dash(i.url), image: SD.dash(i.image),
          orderTotal: SD.parseTL(o.total),
        }));
      },
    };
  }
  SD.adapters.trendyol = make('trendyol', 'Trendyol');
  SD.adapters['trendyol-milla'] = make('trendyol-milla', 'Trendyol Milla');
})(window.SD);

// Temu: ürün satırları ithalat vergisini içermez, sipariş toplamı içerir. Ürün başına:
//   Gümrük vergisi = siparişte ödenen ithalat vergisi, satır tutarı oranında (iptalde alan boş: toplam − ürün tutarı)
//   Ödenen = sipariş toplamının ürün payı (vergi dahil, kupon/kredi sonrası), satır tutarı oranında
//   İade = siparişin iade kayıtları (vergi iadesi dahil), kaydın kapsadığı ürünlere ödenen oranında;
//          kaydı olmayan iade (ör. iptal siparişler) tüm ürünlere
//   Net = Ödenen − İade (0'ın altına inmez). Harcamaya net girer.
// "Fiyat ayarlaması" iadelerinin tutarı Temu verisinde yok; o ürünlerin neti fazla görünebilir.
(function (SD) {
  SD.adapters.temu = {
    store: 'temu', label: 'Temu',
    detect: o => String(o?.orderNo).startsWith('PO-') && o.payment && 'importTax' in o.payment,
    toItems(o) {
      const p = o.payment || {};
      const card = SD.dash(p.card);
      const pay = card ? { last4: card, brand: SD.dash(p.cardType)?.toUpperCase() } : { method: SD.dash(p.type) || 'Kredi bakiyesi' };
      const items = o.items || [];
      const lines = items.map(i => SD.parseTL(i.lineTotal) || 0);
      const lineSum = lines.reduce((a, x) => a + x, 0) || 1;
      const top = SD.parseTL(o.total) || 0;
      const taxOrder = SD.parseTL(p.importTax) || Math.max(top - lines.reduce((a, x) => a + x, 0), 0);
      const paid = lines.map(x => top * x / lineSum);

      const refund = items.map(() => 0);
      for (const rf of o.refunds || []) {
        let ks = items.map((it, k) => ((rf.items || []).includes(it.subOrderNo) ? k : -1)).filter(k => k >= 0);
        if (!ks.length) ks = items.map((_, k) => k);
        const so = ks.reduce((a, k) => a + paid[k], 0) || 1;
        for (const k of ks) refund[k] += (SD.parseTL(rf.amount) || 0) * paid[k] / so;
      }
      const rest = (SD.parseTL(o.refundTotal) || 0) - refund.reduce((a, x) => a + x, 0);
      if (rest > 0.01) paid.forEach((x, k) => { refund[k] += rest * x / (top || 1); });

      return items.map((i, k) => {
        let net = Math.round((paid[k] - refund[k]) * 100) / 100;
        if (net < 0.01) net = 0;   // iade, vergi yuvarlaması yüzünden payı birkaç kuruş aşabiliyor
        const state = i.cancelled || o.cancelled ? 'iptal' : refund[k] && !net ? 'iade' : 'ok';
        const statusText = state === 'ok' && refund[k] ? 'Kısmi iade' : SD.dash(i.status) || SD.dash(o.status);
        return {
          store: 'temu', orderNo: o.orderNo, date: SD.parseDate(o.date),
          name: SD.dash(i.name) || '(adsız ürün)',
          qty: typeof i.quantity === 'number' ? i.quantity : null,
          unit: SD.parseTL(i.unitPrice),
          line: SD.parseTL(i.lineTotal),
          tax: taxOrder * lines[k] / lineSum,
          paid: paid[k],
          refund: refund[k] || null,
          net,
          total: state === 'ok' ? net : paid[k],   // harcamada net; iade/iptalde ödenen (harcamaya girmez)
          estimated: false,
          recipient: SD.dash(o.address?.fullName),
          category: null,
          seller: null,
          variant: SD.dash(i.variant),
          statusText,
          state,
          pay, url: SD.dash(i.url), image: SD.dash(i.image),
          orderTotal: top,
        };
      });
    },
  };
})(window.SD);

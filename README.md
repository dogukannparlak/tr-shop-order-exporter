# tr-shop-order-exporter

Hepsiburada, Trendyol, Trendyol Milla ve Amazon TR sipariş geçmişini tarayıcı Console'undan JSON olarak indirir.
Resmî API yok. Scraper'lar sitenin kendi sayfa/API isteklerini **okur**; sipariş vermez, hiçbir şeyi değiştirmez.

> **Not:** Scraper'lar en son **8 Ekim 2026**'da güncellendi. Siteler arayüzünü veya iç API'sini değiştirdiğinde bozulabilir; güncel olmayabilir ve çalışmayabilir.

## Hızlı başlangıç

1. Siteye giriş yap, **Siparişlerim** sayfasını aç, `F5` ile yenile.
2. İlgili scraper dosyasının tamamını kopyala (`Cmd+A`, `Cmd+C`).
3. `F12` → **Console**'a yapıştır, Enter. "allow pasting" uyarısı çıkarsa önce `allow pasting` yaz, sonra yeniden yapıştır.
4. Console filtresine etiketi yaz (aşağıdaki tablo). Sayfanın kırmızı hataları gizlenir, yalnızca ilerleme görünür.
5. Sol altta ilerleme kutusu çıkar. Bitince JSON iner; Console'daki `hatalar:` satırı kaç hata olduğunu söyler.

| Site | Scraper | Başlangıç sayfası | Etiket | İnen dosya |
|---|---|---|---|---|
| Hepsiburada | `hepsiburada/hepsiburada-scraper.js` | hepsiburada.com/siparislerim | `[HB]` | `hepsiburada-siparisler.json` |
| Trendyol | `trendyol/trendyol-scraper.js` | trendyol.com/hesabim/siparislerim | `[TY]` | `trendyol-siparisler.json` |
| Trendyol Milla | `trendyol-milla/trendyol-milla-scraper.js` | trendyol-milla.com/hesabim/siparislerim | `[MILLA]` | `trendyol-milla-siparisler.json` |
| Amazon TR | `amazon/amazon-scraper.js` | amazon.com.tr → Siparişlerim | `[AMZ]` | `amazon-siparisler.json` |

Aynı sekmede ikinci kez çalıştırmadan önce `F5` yap. Hepsiburada ve Trendyol kodları fonksiyona sarılı değil, tekrar yapıştırınca çakışır.

## Çıktı

- **Sipariş:** no, tarih, durum, toplam, teslimat adresi (alıcı, adres, il/ilçe, maskeli telefon).
- **Ödeme:** yöntem, kart son haneleri, banka/taksit, kargo, indirim kalemleri.
- **Ürün (satır bazlı):** ad, adet, fiyat, ürün kodu, link, görsel, satıcı, durum, kargo firması ve takip no, teslim tarihi.
- Bulunamayan alan `"-"` olur. Hatalı sipariş `error` alanıyla kayda girer, diğerleri devam eder.

Fiyat alanları siteye göre değişir:

| Site | Alanlar |
|---|---|
| Hepsiburada | `price` = satır toplamı (adet dahil), `unitPrice` = birim fiyat |
| Trendyol / Milla | `unitPrice` = birim fiyat, `lineTotal` = adet × birim |
| Amazon | `unitPrice` = birim fiyat, `lineTotal` = adet × birim (KDV dahil sayfa fiyatı) |

Alan yapısını `examples/*-siparisler.example.json` dosyalarında görebilirsin. İçlerindeki adres, telefon ve kart verisi uydurmadır.

## Siteye özel notlar

**Trendyol:** Sitenin iç sipariş API'sini kullanır (liste `api/orders`, detay `m-order-detail`). Fiyatı olmayan tek ürünlü siparişte fiyat ara toplamdan hesaplanır ve `priceEstimated: true` yazılır. Cüzdan ödemeleri `Cüzdan` olarak işaretlenir. Bazı ürünlerde kategori `"-"` gelir.

**Trendyol Milla:** Trendyol ile aynı altyapı ve kod. Fark: alan adı, `channelId=8`, dosya adı, etiket. Beden/renk `variant` alanında.

**Hepsiburada:** Sayfayı sonuna kadar kaydırır, her siparişi açıp ekrandan okur. Adet `xN` rozetinden gelir. Detay 6 saniyede açılmazsa o sipariş boş kalır (`items[0].name = "-"`). Bu durum dosyaya `error` olarak yazılmaz, yalnızca Console'daki `hatalar:` listesinde görünür. Görürsen scraper'ı yeniden çalıştır.

**Amazon:**
- `AUTO = true` (varsayılan): yılları ve sayfaları kendisi gezer, art arda 3 boş yılda durur. `AUTO = false`: yalnızca açık sayfayı alır.
- Adet, ürün görselindeki rozetten okunur (rozet yoksa 1).
- Eski siparişlerin çoğunda Amazon durum metni vermez, ürün durumu `"-"` kalır.
- Scraper, iade penceresi metni olan ürünlere `"Teslim edildi (çıkarım)"` yazar. Bu çıkarımdır, kesin bilgi değil.
- İptal edilen siparişlerde toplam, adres ve ödeme `"-"` olur.
- `check.match: false` hata olmak zorunda değil; promosyon, vade farkı veya hediye kartı toplamı kaydırabilir.
- Captcha çıkarsa kod durur ve o ana kadarkini indirir.

## Gizlilik

- İndirilen JSON'lar kişisel veri içerir: adres, maskeli telefon, kart son haneleri. Paylaşma, herkese açık repoya koyma.
- `.gitignore` gerçek `*-siparisler.json` dosyalarını, `satin-alinanlar.csv` ve `ozet.md` çıktılarını dışarıda tutar.

## Sınırlar

- Yalnızca GET isteği atılır, istekler arasında bekleme vardır (Amazon'da daha uzun). Captcha, 403 veya "çok fazla istek" görürsen sayfayı yenile, bir süre bekle.
- Yöntem sitelerin belgelenmemiş yapısına dayanır; site değişirse scraper bozulabilir.
- Sitelerin kullanım şartlarını kontrol etmedim. Kendi hesabın ve kendi verin için kullan.

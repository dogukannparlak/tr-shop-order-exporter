# Alışveriş sipariş geçmişi çekiciler

Hepsiburada, Trendyol, Trendyol Milla ve Amazon TR sipariş geçmişini tarayıcı Console'undan JSON'a çeker.
Resmî API yok; sitenin kendi sayfa/API isteklerini **okur** (hiçbir şeyi değiştirmez, sipariş vermez).

## Klasörler

| Klasör | Scraper | Çıktı (indirilen dosya) |
|---|---|---|
| `hepsiburada/` | `hepsiburada-scraper.js` | `hepsiburada-siparisler.json` |
| `trendyol/` | `trendyol-scraper.js` | `trendyol-siparisler.json` |
| `trendyol-milla/` | `trendyol-milla-scraper.js` | `trendyol-milla-siparisler.json` |
| `amazon/` | `amazon-scraper.js` | `amazon-siparisler.json` |

Her klasörde en son alınmış veri de duruyor (5-6 Ekim 2026):

| Veri | Sipariş | Ürün satırı | Not |
|---|---|---|---|
| `hepsiburada/hepsiburada-siparisler.json` | 139 | 209 | Sipariş 249756777'nin detayı yükleme hatası yüzünden eski bir çıktıdan tamamlandı; adedi 1 varsayıldı. |
| `trendyol/trendyol-siparisler.json` | 37 | 89 | Hata yok. |
| `trendyol-milla/trendyol-milla-siparisler.json` | 3 | 6 | Hata yok, hepsi teslim edilmiş siparişler. |
| `amazon/amazon-siparisler.json` | 88 | 131 | Scraper çıktısı, elle sadeleştirildi (iptal durum metni kısaltıldı, "(çıkarım)" ibaresi kaldırıldı). |

## Nasıl çalıştırılır (hepsi için aynı)

1. Siteye giriş yap, **Siparişlerim** sayfasını aç, `F5` ile yenile.
2. İlgili `*-scraper.js` dosyasının tamamını kopyala (`Cmd+A`, `Cmd+C`).
3. `F12` → **Console**'a yapıştır, Enter. "allow pasting" uyarısı çıkarsa önce `allow pasting` yaz, sonra yeniden yapıştır.
4. Console filtresine etiketi yaz: `[HB]`, `[TY]`, `[MILLA]` veya `[AMZ]`. Sayfanın kırmızı hataları gizlenir, sadece ilerleme görünür.
5. Sol altta ilerleme kutusu çıkar. Bitince JSON indirilir; Console'da `hatalar:` satırı kaç hata olduğunu söyler.

| Site | Hangi sayfada | Etiket |
|---|---|---|
| Hepsiburada | hepsiburada.com/siparislerim | `[HB]` |
| Trendyol | trendyol.com/hesabim/siparislerim (liste) | `[TY]` |
| Trendyol Milla | trendyol-milla.com/hesabim/siparislerim (liste) | `[MILLA]` |
| Amazon TR | amazon.com.tr → Siparişlerim | `[AMZ]` |

Hepsiburada, Trendyol ve Milla scraper'ları aynı sekmede ikinci kez çalıştırılacaksa önce `F5` gerekir (Trendyol ve Hepsiburada kodları fonksiyon içine sarılı değil). Milla ve Amazon sarılı.

## Her siteden ne alınır

- **Sipariş:** no, tarih, durum, toplam, teslimat adresi (alıcı, açık adres, mahalle/ilçe/il, maskeli telefon).
- **Ödeme:** yöntem, kart son haneleri, banka/taksit, kargo, indirim/kampanya kalemleri.
- **Ürün (satır bazlı):** ad, adet, fiyat, ürün kodu, link, görsel, satıcı, durum, kargo firması ve takip no, teslim tarihi.
- Bulunamayan alan `"-"` yazılır. Hatalı sipariş `error` alanıyla kayda girer, diğerleri devam eder.

**Fiyat alanı siteye göre farklı:**

| Site | Ürün fiyatı |
|---|---|
| Hepsiburada | `price` = satır toplamı (adet dahil), `unitPrice` = birim fiyat |
| Trendyol / Milla | `unitPrice` = birim fiyat, `lineTotal` = adet × birim |
| Amazon | `unitPrice` = birim fiyat, `lineTotal` = adet × birim (KDV dahil sayfa fiyatı) |

## Sitelere özel notlar

- **Trendyol:** sitenin iç sipariş API'sini kullanır (liste: `api/orders`, detay: `m-order-detail`). Tüm siparişleri listeden gezer; sipariş sayısını önceden saymaz. Fiyatı hiç olmayan tek ürünlü siparişte fiyat ara toplamdan hesaplanır ve `priceEstimated: true` yazılır. Cüzdanla ödemeler `Cüzdan` olarak işaretlenir. Kategori bazı ürünlerde `"-"` gelir (Trendyol vermiyor).
- **Trendyol Milla:** Trendyol ile aynı altyapı. Kod aynı, yalnızca alan adı (`trendyol-milla.com`), `channelId=8`, dosya adı ve etiket farklı. Beden/renk `variant` alanında (örn. `Taş , XS`).
- **Hepsiburada:** sayfayı sonuna kadar kaydırır, her siparişi açıp ekrandan okur. Ürün adedi `xN` rozetinden alınır. Bir siparişin detayı 6 saniyede açılmazsa o sipariş boş kalır (`items[0].name = "-"`); kod bunu dosyaya `error` olarak yazmaz, yalnızca Console'daki `hatalar:` listesinde görünür. Bu olursa scraper'ı yeniden çalıştır.
- **Amazon:** `AUTO = true` ile yılları (şu andan geriye, art arda 3 boş yılda durur) ve sayfaları kendisi gezer. Sipariş numarası kartın `data-csa-c-slot-id` değerinden okunur.
  - Adet, ürün görselinin üzerindeki küçük rozetten okunur (rozet yoksa 1).
  - Eski siparişlerin çoğunda Amazon **durum metnini hiç vermez**; ürün durumu `"-"` kalır (kayıtlı veride 66 ürün).
  - Scraper, iade penceresi metni olan ürünlere `"Teslim edildi (çıkarım)"` yazar ve iptal metnini uzun yazar. Klasördeki `amazon-siparisler.json` bunların elle sadeleştirilmiş halidir (scraper'ı yeniden çalıştırırsan bu iki şey tekrar ham gelir).
  - İptal edilen siparişlerde Amazon toplam, adres ve ödeme bölümünü göstermez; bu alanlar `"-"` olur.
  - `check.match: false` çıkan siparişlerde toplam promosyon, vade farkı veya hediye kartı yüzünden tutmayabilir; hata olmak zorunda değil.
  - Captcha çıkarsa kod durur ve o ana kadarkini indirir.

## Güvenlik ve sınırlar

- Yalnızca okuma (GET) isteği atılır; istekler arasında bekleme vardır (Amazon'da daha uzun). Captcha, 403 veya "çok fazla istek" görürsen sayfayı yenile ve bir süre bekle.
- Bu yöntemler siteler tarafından belgelenmemiş yapıya dayanır; site değişirse bozulabilir. Sitelerin kullanım şartlarını kontrol etmedim.
- **JSON dosyaları kişisel veri içerir** (adres, maskeli telefon, kart son haneleri). Başkasıyla paylaşma, herkese açık bir repoya koyma.

# data/

Kendi sipariş dosyaların için klasör. Buradaki `.json` dosyaları git'e girmez (`.gitignore`); repoya yalnız bu README girer.

## Kullanım

1. Scraper'ların indirdiği JSON'ları bu klasöre koy. Adlarını değiştirme.
2. Repo kökündeki `index.html`'i tarayıcıda aç, **Klasör seç**'e tıkla, bu klasörü seç.
3. Yeni dosya ekleyince: Chrome/Edge'de **Yenile**, Brave/Safari/Firefox'ta klasörü yeniden seç.

## Tanınan dosyalar

| Site | Dosya adı |
|---|---|
| Hepsiburada | `hepsiburada-siparisler.json` |
| Trendyol | `trendyol-siparisler.json` |
| Trendyol Milla | `trendyol-milla-siparisler.json` |
| Amazon TR | `amazon-siparisler.json` (sayfa sayfa indirdiysen `amazon-siparisler-*.json`) |
| Temu | `temu-siparisler.json` |

- İkinci bir hesabın dosyası `<site>-<ek>-siparisler.json` adıyla (ör. `trendyol-hesap2-siparisler.json`) aynı mağazaya eklenir.
- Aynı sitenin birden çok dosyası sipariş numarasına göre birleştirilir; aynı sipariş iki kez sayılmaz.
- Bu adlara uymayan dosyalar (ör. not, seçim listesi) panelde yok sayılır.
- Örnek dosyalar (`*.example.json`) yalnız klasörde gerçek dosya yoksa yüklenir. Denemek için `examples/` klasörünü seç.

## Gizlilik

Dosyalar adres, maskeli telefon ve kart son hanelerini içerir. Panel veriyi yalnız tarayıcıda işler; dışarıya giden tek istek dolar kuru içindir (Frankfurter API) ve yalnız tarih aralığı içerir.

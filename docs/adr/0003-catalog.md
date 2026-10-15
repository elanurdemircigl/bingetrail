# ADR-0003: Katalog erişimi ve arama mimarisi

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-15
- **Faz:** 3

## Kararlar

### 1. TMDB'ye yalnızca `tmdb` Edge Function'ı üzerinden erişilir

Kararın gerekçeleri:

- TMDB token'ı yalnızca fonksiyonun secret'ı olarak kalır.
- Önbellek ve hız sınırı tek bir yerde uygulanır.
- İstemciler (web, ileride mobil) aynı sözleşmeyi kullanır.

### 2. Sözleşme tek kaynaktan gelir ve kopyası senkron tutulur

- Kaynak: `packages/shared/src/contracts/catalog.ts`. Zod ile yazıldı, `zod` dışında bağımlılığı yok.
- Deno monorepo paketlerini içe aktaramadığı için `pnpm contracts:sync` dosyayı `supabase/functions/_shared/contracts/` altına kopyalıyor. CI'daki `contracts:check` iki dosyanın farklılaştığını görürse hata veriyor.
- İstemci tarafı (`@bingetrail/api-client`) fonksiyon yanıtlarını da şemaya göre doğruluyor. Böylece sözleşmeden sapma ekranda bozuk veri olarak değil, hata olarak ortaya çıkıyor.

### 3. Web'de arama sunucuda render ediliyor, durum URL'de tutuluyor

- Arama sayfası `?q=&page=` parametrelerini sunucu bileşeninde okuyor ve sonuçları sunucuda üretiyor.
- `SearchBox` istemci bileşeni yalnızca URL'yi güncelliyor (350 ms debounce, Enter'da hemen).
- ADR-0002 gereği tarayıcıda Supabase client'ı ve token bulunmuyor. URL'de durum tutmak bu ilkeyle uyumlu; ayrıca paylaşılabilir bağlantılar ve çalışan geri tuşu sağlıyor. JavaScript kapalıyken de form düz GET olarak gönderilebiliyor.
- **TanStack Query henüz kullanılmıyor.** İlk gerçek ihtiyaç Faz 4'teki iyimser güncellemeler ve mobil (Faz 6). `queryKeys.catalog` bunun için şimdiden hazır.

### 4. E2E gerçek fonksiyonu ve sahte TMDB'yi kullanıyor

- Sahte TMDB sunucusu (`e2e/tmdb-mock`) Supabase'in Docker ağında çalışan bir container.
- Fonksiyon geçici bir env dosyasıyla (sahte token, sahte sunucunun adresi) `supabase functions serve` üzerinden çalışıyor.
- Böylece edge runtime, veritabanı önbelleği, RLS ve web uygulaması gerçek; yalnızca TMDB taklit. CI'da da gerçek bir TMDB anahtarına gerek kalmıyor.

### 5. Deno testleri edge runtime ile aynı sürümde çalışıyor

- Yerel edge runtime Deno 2.1.4 kullanıyor. `pnpm test:functions` yerelde Deno kuruluysa onu, değilse `denoland/deno:2.1.4` imajını kullanıyor. CI'da `setup-deno` ile aynı sürüm kuruluyor.

## Sonuçlar

- Yeni bir TMDB uç noktası eklemek için sırasıyla: sözleşmeye yeni bir `action`, `tmdb-client`'a yeni bir metod, handler'a yeni bir durum ve sahte TMDB'ye yeni veriler.
- Kataloğu temizleme işi K7 gereği kapalı ([data-retention.md](../data-retention.md)).

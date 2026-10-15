# ADR-0005: Bölüm takibi ve Continue Watching

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-16
- **Faz:** 5

## Kararlar

### 1. İşaretleme veritabanı fonksiyonlarıyla, tek istekte

- `mark_episodes_watched(bigint[])` ve `unmark_episodes(bigint[])` RPC'leri **SECURITY INVOKER**, `search_path` boş. Kullanıcının kendi yetkileri ve RLS geçerli; service role yok.
- Bir çağrıda en fazla **2000** bölüm (DoS sınırı; en uzun gerçek diziler bile sığar). Sezon, "buraya kadar" ya da 120 bölümlük bir sezon her zaman **tek istek**.
- Hatalar mesajla döner (`episode_not_aired`, `episode_not_found`, `too_many_episodes`, `invalid_episodes`; SQLSTATE 22023). `api-client` bunları koda çevirir, diğer her hata `unexpected` olur.

### 2. Yayınlanmamış bölüm hiçbir yoldan işaretlenemez

- RPC yayın tarihini kontrol eder. `episode_progress` üzerindeki `BEFORE INSERT` tetikleyicisi de aynı kuralı **her yazma yolu için** uygular, PostgREST ile doğrudan tabloya yazmak dahil (E2E bunu doğrudan RPC çağrısıyla, pgTAP doğrudan `insert` ile kanıtlıyor).
- Yayın tarihi bilinmeyen bölüm (`air_date is null`) yayınlanmamış sayılır.
- "Bugün" `catalog_today()` = UTC takvim günü. Kullanıcı saat dilimi takvimle birlikte gelecek (Faz 8).

### 3. İşaretlemek başlığı listeye alır

- Listede olmayan bir dizinin bölümü işaretlenince dizi **"İzleniyor"** olarak eklenir; "İzlenecek" olan **"İzleniyor"**a geçer (başlangıç tarihi yazılır).
- "Ara verildi", "Bırakıldı" ve "Tamamlandı" değişmez; bu kullanıcının kararıdır. Yalnızca `last_activity_at` güncellenir.
- **Tamamlama otomatik değil:** Yayınlanan bütün bölümler izlenince başlık sayfasında "Tamamlandı olarak işaretlensin mi?" önerisi çıkar.

### 4. "Sıradaki bölüm" = en ileri izlenenden sonraki ilk yayınlanmış, izlenmemiş bölüm

- Kullanıcı ortadan başladıysa (ör. yalnızca 3. sezonu işaretlediyse) baştaki boşluklar "sıradaki" sayılmaz.
- Özel bölümler (sezon 0) işaretlenebilir ama sayılmaz ve "sıradaki" olmaz.
- `get_continue_watching()` tek sorgu (N+1 yok). Ölçüm (yerel, 30 dizi × 1000 bölüm, 20 sonuç): **≈ 75–100 ms**. İlk sürüm 700 ms idi; sayımlar ayrıştırılıp "sıradaki" araması `(title_id, season_number, episode_number)` indeksinde sıralı yürüyecek şekilde yeniden yazıldı. 1000 bölümü tek çağrıda işaretlemek ≈ 180 ms.

### 5. Önbellek farkındalığı

Sezonlar ve bölümler TMDB'den **istek üzerine** önbelleğe alınır (ADR-0003). Bu yüzden:

- `get_title_progress` `catalog_complete` döner: yayınlanmış bir sezonun bölümleri henüz önbellekte yoksa `false`. Tamamlama önerisi yalnızca `true` iken çıkar; aksi halde 1. sezonu bitiren kullanıcıya yanlışlıkla "hepsini izledin" denebilirdi.
- Sonraki sezon önbellekte yoksa Continue Watching "Sıradaki bölümü görmek için sezonları aç" der. Faz 8'deki `refresh-upcoming` işi bu boşluğu kapatacak.
- "Buraya kadar" bu yüzden **sezon içinde** çalışır (önceki sezonların bölümleri önbellekte olmayabilir).

### 6. Web'de aynı desen: Server Actions + `useOptimistic`

ADR-0004 ile aynı. Bölüm kutuları ve sezon düğmeleri anında güncellenir; sunucu reddederse eski haline döner ve mesaj gösterilir. Mobil (Faz 6) aynı RPC'leri `queryKeys.progress` ile TanStack Query üzerinden kullanacak.

## Sonuçlar

- Yeni migration: `20261016090000_episode_progress.sql` (ileri yönlü; eski migration'lar değişmedi).
- Eski pgTAP testlerinin örnek bölümlerine yayın tarihi eklendi; yeni kural tarihsiz bölümün işaretlenmesini artık reddediyor.

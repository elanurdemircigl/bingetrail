# ADR-0004: İzleme listesi ve hesap silme (web)

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-15
- **Faz:** 4

## Kararlar

### 1. Liste verisi doğrudan PostgREST + RLS ile, kullanıcının kendi oturumuyla yazılır

- `@bingetrail/api-client/watchlist.ts` fonksiyonları bir Supabase client'ı **alır**; web'de bu, sunucu tarafındaki cookie oturumlu client'tır (ADR-0002). Service role kullanılmaz; neyin değişebileceğine RLS karar verir.
- Durum geçişlerinin tarih kuralları (`applyStatusChange`) `packages/shared` içinde ve veritabanında **aynı anda** var: `watchlist_consistency` migration'ındaki CHECK kısıtları (`completed_at` yalnızca `completed`'da, `watching`/`completed` başlangıç tarihi ister, tarih sırası). İstemci kuralı atlanırsa veritabanı yine reddeder.
- Aynı başlığın iki kez eklenmesi `unique (user_id, title_id)` ile engellenir; `23505` hatası `already_exists` koduna çevrilir. Arayüz zaten var olan kaydı düzenleme görünümünde gösterir.

### 2. Web'de TanStack Query ve Zustand yerine Server Actions + `useOptimistic`

Planın genel kuralı "sunucu durumu TanStack Query'de, UI durumu Zustand'da" idi. Web için bundan bilerek sapıldı:

- ADR-0002 gereği tarayıcıda Supabase client'ı ve token **yok**. TanStack Query'nin tarayıcıda veri çekmesi için ya token'ı tarayıcıya açmak ya da her isteği bir API katmanından geçirmek gerekirdi.
- Sayfalar sunucuda render ediliyor. Mutasyonlar Server Action; başarıdan sonra `revalidatePath` istemcideki router önbelleğini tazeliyor.
- İyimser güncelleme React 19 `useOptimistic` ile yapılıyor: durum seçimi ve ekleme anında görünür; işlem başarısız olursa geçiş bitince otomatik olarak sunucudaki değere döner ve hata mesajı gösterilir (RTL testi bunu kanıtlıyor).
- **Filtre ve sıralama durumu URL'de** (`?status=&sort=`). Zustand'a gerek yok; bağlantılar paylaşılabilir, geri tuşu çalışır, sıralama formu JavaScript olmadan da düz GET olarak gönderilir.
- **Mobil (Faz 6)** tarayıcı kısıtına tabi değil: orada TanStack Query + `queryKeys.watchlist` (bu fazda eklendi) ve offline kuyruk kullanılacak.

### 3. Notlar düz metindir

- Notlar React metin düğümü olarak render edilir (`whitespace-pre-wrap`); `dangerouslySetInnerHTML` lint kuralıyla yasak.
- E2E, `<script>` ve `onerror` içeren bir notun metin olarak göründüğünü ve çalışmadığını doğrular.
- Uzunluk sınırı (5000) üç yerde: Zod (istemci + Server Action), veritabanı CHECK. JavaScript UTF-16 birimleriyle saydığı için istemci sınırı veritabanınınkinden hiçbir zaman gevşek değildir.
- Notlar ve puanlar log'a yazılmaz.

### 4. Hesap silme bir Edge Function'da, iki adımlı arayüzle

- Kullanıcı silme service role gerektirir, bu yüzden web sunucusunda değil `delete-account` fonksiyonunda yapılır; web sunucusu da service-role anahtarını hiç görmez.
- Arayüz iki adımlıdır: profildeki bağlantı yalnızca ayrı sayfaya götürür; orada uyarı, silinecek veri listesi, parola ve açık onay kutusu vardır (K13: bekleme süresi yok).
- Ayrıntılar: [account-deletion.md](../account-deletion.md), [edge-functions/delete-account.md](../edge-functions/delete-account.md).

## Sonuçlar

- Web'de istemci tarafı veri katmanı yok; mobil Faz 6'da `api-client` fonksiyonlarını TanStack Query ile saracak.
- E2E, Storage servisine ihtiyaç duyuyor (avatar silme); CI'daki `supabase start -x` listesinden `storage-api` çıkarıldı.

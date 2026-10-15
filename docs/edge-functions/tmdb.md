# `tmdb` Edge Function

> Durum: Faz 3 · Kod: `supabase/functions/tmdb/` · Sözleşme: `packages/shared/src/contracts/catalog.ts`

TMDB ile konuşan **tek** bileşen ve katalog önbelleğine (`titles`, `seasons`, `episodes`) yazan tek yer burası. TMDB token'ı ve service-role anahtarı yalnızca bu fonksiyonun ortamında bulunur.

## İstek ve yanıt

`POST /functions/v1/tmdb`. İstemci kullanıcının JWT'sini gönderir; web'de bunu sunucu tarafındaki Supabase client'ı otomatik yapar.

| `action` | Gövde                                      | Yanıt                                                         |
| -------- | ------------------------------------------ | ------------------------------------------------------------- |
| `search` | `{ query (1–100), page (1–20), locale }`   | `SearchResponse`: film ve dizi sonuçları; kişiler filtrelenir |
| `title`  | `{ mediaType: movie\|tv, tmdbId, locale }` | `TitleDetail` (dizi ise sezon özetleriyle)                    |
| `season` | `{ tmdbId, seasonNumber, locale }`         | `SeasonDetail`: bölümler, veritabanı `id`'leriyle             |

Hata yanıtlarında yalnızca kod döner: `{ "error": "<kod>" }`.

| Kod                    | HTTP | Ne zaman                                                                                    |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `unauthorized`         | 401  | JWT yok ya da geçersiz                                                                      |
| `invalid_request`      | 400  | Gövde sözleşmeye uymuyor, ya da POST dışında bir metod                                      |
| `rate_limited`         | 429  | Kullanıcı başına 60 istek/dakika aşıldı (`Retry-After: 60`)                                 |
| `not_found`            | 404  | TMDB'de böyle bir kayıt yok                                                                 |
| `upstream_unavailable` | 502  | TMDB 5xx/429 döndü (bir kez yeniden denendikten sonra), zaman aşımı ya da beklenmeyen yanıt |
| `internal`             | 500  | Beklenmeyen hata. Log'a yalnızca hata sınıfı yazılır                                        |

## Önbellek

- Kayıtlar **24 saat** sonra tazelenir. İstenen dilin çevirisi yoksa beklemeden TMDB'den çekilir.
- Diller birleştirilir: TR ve EN çevirileri aynı satırda (`translations`, `name` jsonb) tutulur.
- Önbellekten yapılan her okuma `last_referenced_at` değerini günceller. Saklama politikası bu değere dayanır ([data-retention.md](../data-retention.md)).
- **Dizi kaydedilirken sezon satırları bölümsüz oluşturulur.** Sezon isteği, bu satırları önbellekte bölüm varmış gibi saymaz. Bu kurala birim testleri ve E2E sırasında yakalanan bir hata yol açtı.

## Güvenlik

- **SSRF yok:** TMDB yolu yalnızca Zod ile doğrulanmış tam sayılardan kurulur. Arama metni yalnızca query parametresi olarak gider.
- **Token koruması:** TMDB token'ı yalnızca `Authorization` başlığında gider; URL'de, log'da ya da yanıtta yer almaz.
- **Yanıt doğrulama:** TMDB yanıtları Zod ile doğrulanır. Tarih ve görsel yolları beyaz listeden geçer (`/^\/[A-Za-z0-9._-]+$/`).
- **CORS:** Varsayılan olarak hiçbir origin'e açık değil; web fonksiyonu sunucu tarafından çağırıyor. Gerekirse `CATALOG_ALLOWED_ORIGINS` ile açılır.
- **Yanıt başlıkları:** Bütün yanıtlarda `Cache-Control: no-store` ve `X-Content-Type-Options: nosniff` var.

## Secret kurulumu (depo sahibi yapar)

**Yerel geliştirme:**

```bash
cp supabase/functions/.env.example supabase/functions/.env   # gitignored
# .env içine kendi TMDB "API Read Access Token" değerini yaz
pnpm db:start            # fonksiyonlar edge runtime ile birlikte çalışır
```

**Uzak proje:**

```bash
pnpm exec supabase secrets set TMDB_API_READ_ACCESS_TOKEN=...   # değer terminalde kalır
pnpm exec supabase functions deploy tmdb
```

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` değişkenlerini Supabase kendisi enjekte eder; elle girilmez.

## Testler

| Katman     | Komut                  | Kapsam                                                                                                         |
| ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Deno birim | `pnpm test:functions`  | Auth, girdi doğrulama, hız sınırı, CORS, önbellek, dil birleştirme, hata eşleme, URL güvenliği, yeniden deneme |
| Sözleşme   | `pnpm contracts:check` | Paylaşılan Zod sözleşmesi ile fonksiyondaki kopya birebir aynı mı                                              |
| pgTAP      | `pnpm db:test`         | `rate_limit_hit`, bakım fonksiyonları, istemci yetkileri                                                       |
| E2E        | `pnpm test:e2e`        | Gerçek edge runtime + veritabanı. TMDB yerine `e2e/tmdb-mock` (sahte token, uydurma veriler)                   |

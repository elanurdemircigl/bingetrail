# `delete-account` Edge Function

> Durum: Faz 4 · Kod: `supabase/functions/delete-account/` · Sözleşme: `packages/shared/src/contracts/account.ts` · Akış: [account-deletion.md](../account-deletion.md)

Çağıranın hesabını kalıcı olarak siler. Service-role anahtarı yalnızca bu fonksiyonun (ve `tmdb`'nin) ortamında bulunur; istemciler bu anahtarı asla görmez.

## İstek ve yanıt

`POST /functions/v1/delete-account` · `Authorization: Bearer <kullanıcı JWT'si>` · gövde `{ "password": "…" }`

Silinecek hesap **yalnızca** JWT'nin `sub` değeridir. Gövdedeki başka alanlar Zod tarafından atılır.

Başarılı yanıt: `200 { "deleted": true }`. Hata yanıtlarında yalnızca kod döner: `{ "error": "<kod>" }`.

| Kod               | HTTP | Ne zaman                                                                                     |
| ----------------- | ---- | -------------------------------------------------------------------------------------------- |
| `unauthorized`    | 401  | JWT yok, geçersiz ya da kullanıcı artık yok                                                  |
| `invalid_request` | 400  | Gövde sözleşmeye uymuyor ya da POST dışında bir metod                                        |
| `reauth_failed`   | 403  | Parola yanlış ya da hesabın e-postası yok                                                    |
| `rate_limited`    | 429  | Kullanıcı başına saatte 5 deneme aşıldı (`Retry-After: 3600`); parola hiç denenmez           |
| `internal`        | 500  | Tuz eksik, Storage veya Auth hatası. Log'a yalnızca hata sınıfı yazılır, hesap yerinde kalır |

## Yapı

| Dosya             | İçerik                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `handler.ts`      | Saf iş akışı; bütün dış bağımlılıklar `Deps` arayüzüyle enjekte edilir (Deno testleri bunu kullanır) |
| `avatars.ts`      | `avatars/<uid>/` klasörünü alt klasörler ve 100'lük sayfalarla boşaltır; 10.000 nesne üstünde durur  |
| `index.ts`        | Gerçek bağımlılıklar: service-role client, anon client ile yeniden doğrulama, `rate_limit_hit` RPC   |
| `handler.test.ts` | 17 Deno testi                                                                                        |

## Güvenlik notları

- **IDOR yok:** Hedef kimlik yalnızca doğrulanmış JWT'den gelir; test, gövdeye başka bir kullanıcının id'si konduğunda yalnızca çağıranın silindiğini kanıtlar.
- **Kaba kuvvet:** Hız sınırı parola kontrolünden **önce** sayılır, yani yanlış parola denemeleri de sınırı tüketir. Supabase Auth'un kendi giriş hız sınırları da geçerlidir.
- **Log hijyeni:** Parola, token, uid ve gövde log'a yazılmaz; test bunu hata yollarında doğrular.
- **Yeniden doğrulama oturumu:** `signInWithPassword` ile açılan geçici oturum hemen `signOut({ scope: 'local' })` ile kapatılır ve fonksiyon dışına çıkmaz.
- **Fail closed:** `ACCOUNT_DELETION_HASH_SALT` yoksa ya da 32 karakterden kısaysa hiçbir yan etki olmadan 500 döner.
- **CORS:** `tmdb` ile aynı kural; varsayılan olarak hiçbir origin'e açık değil (`CATALOG_ALLOWED_ORIGINS`).

## Secret'lar

| Ad                                                               | Kim girer                           | Not                                                          |
| ---------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `ACCOUNT_DELETION_HASH_SALT`                                     | Depo sahibi, `supabase secrets set` | ≥ 32 karakter, rastgele; bir kez belirlenir                  |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase enjekte eder               | Elle girilmez; service-role anahtarı istemcilere asla konmaz |

```bash
pnpm exec supabase secrets set ACCOUNT_DELETION_HASH_SALT=...   # değer terminalde kalır
pnpm exec supabase functions deploy delete-account
```

Deploy ve secret girişi depo sahibinin işidir; ajanlar bu komutları çalıştırmaz.

# Hesap Silme

> Durum: veri modeli **Faz 1'de hazır**. `delete-account` Edge Function'ı ve web arayüzü Faz 4'te, mobil arayüz Faz 6'da gelecek. Karar: K5, K13.

## İlkeler

- **Beklemesiz ve kalıcı:** Silme anında gerçekleşir, geri alınamaz. Arayüz bunu açıkça söyler (K13).
- **Parola yeniden doğrulanır:** Geçerli bir oturum tek başına yetmez.
- **Kimlik yalnızca JWT'den:** Silinecek hesap JWT'deki `sub` değerinden alınır. İstek gövdesinde gelen bir kullanıcı id'si yok sayılır; bu IDOR saldırılarını engeller.
- **Kişisel veri kalmaz:** Silme kaydı yalnızca tuzlu bir hash ve zaman tutar.

## Akış (Faz 4)

```
İstemci ──(JWT + parola)──▶ delete-account Edge Function
   1. JWT'yi doğrula, uid = JWT.sub
   2. Parolayı yeniden doğrula (signInWithPassword: uid'nin e-postası + girilen parola)
   3. Storage: avatars/<uid>/ altındaki bütün dosyaları sil (Storage API)
        └─ hata olursa DUR; kullanıcı silinmez, işlem tekrar denenebilir
   4. auth.admin.deleteUser(uid)   ← service role yalnızca bu adımda
        └─ ON DELETE CASCADE: profiles, watchlist_items, episode_progress, rate_limits
   5. account_deletion_log ← (sha256(salt ‖ uid), 'user_request', now())
   6. 200 → istemci oturumu kapatır
```

## Faz 1'de garanti altına alınanlar (pgTAP)

`supabase/tests/security/account_deletion.test.sql`:

- `auth.users` satırı silinince `profiles`, `watchlist_items`, `episode_progress` ve `rate_limits` temizlenir.
- Başka kullanıcıların verisi ve ortak katalog (`titles`, `episodes`) etkilenmez.
- `account_deletion_log` yalnızca `id`, `user_id_hash`, `reason_code` ve `deleted_at` sütunlarını tutar. Hash biçimi kısıtla denetlenir, istemciler okuyamaz ve yazamaz.

`supabase/tests/database/01_schema.test.sql`:

- `user_id` sütunu olan **her** tablonun `auth.users`'a `ON DELETE CASCADE` FK'si vardır. Bu kontrol katalog sorgusuyla yapılır, yani ileride eklenen tablolar da otomatik kapsanır.

## Açık konular (Faz 4)

- Hash tuzu (`ACCOUNT_DELETION_HASH_SALT`) bir Edge Function secret'ı olacak. Değerini depo sahibi `supabase secrets set` ile girer.
- Storage silme sırası ve hata durumunda tekrar deneme Deno testleriyle doğrulanacak.

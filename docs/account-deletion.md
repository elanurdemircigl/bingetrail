# Hesap Silme

> Durum: **Faz 4'te tamamlandı (web).** Veri modeli Faz 1'den, `delete-account` Edge Function'ı ve web arayüzü Faz 4'ten. Mobil arayüz Faz 6'da aynı fonksiyonu kullanacak. Karar: K5, K13.
> Fonksiyon ayrıntıları: [edge-functions/delete-account.md](edge-functions/delete-account.md)

## İlkeler

- **Beklemesiz ve kalıcı:** Silme anında gerçekleşir, geri alınamaz. Arayüz bunu iki adımda da açıkça söyler (K13).
- **Parola yeniden doğrulanır:** Geçerli bir oturum tek başına yetmez.
- **Kimlik yalnızca JWT'den:** Silinecek hesap JWT'deki `sub` değerinden alınır. İstek gövdesindeki her alan (`userId`, `id`, …) atılır; bu IDOR saldırılarını engeller.
- **Kişisel veri kalmaz:** Silme kaydı yalnızca tuzlu bir hash ve zaman tutar.
- **Service-role anahtarı yalnızca fonksiyonda:** Web ve mobil istemciler bu anahtarı asla görmez; web, fonksiyonu kullanıcının kendi oturumuyla çağırır.

## Kullanıcı akışı (web)

1. **Profil → "Hesabı sil" bölümü → "Hesabımı sil…"** bağlantısı. Bu adım yalnızca ayrı sayfaya götürür; hiçbir şey silinmez.
2. **`/[locale]/profile/delete`:** Sayfa, silmenin geri alınamaz ve beklemesiz olduğunu ve silinecek verilerin listesini (hesap, profil, liste/puan/notlar, bölüm ilerlemesi, profil fotoğrafı) gösterir. Ortak katalog verisinin kişisel veri olmadığını da belirtir.
3. Kullanıcı **parolasını** girer ve **"Hesabımın ve verilerimin kalıcı olarak silineceğini anlıyorum"** kutusunu işaretler. İkisi de zorunludur (istemcide ve Server Action'da `deleteAccountFormSchema`).
4. Başarılı olursa Server Action bu cihazdaki bütün `sb-*` oturum cookie'lerini ve kurtarma işaretini siler, kullanıcıyı herkese açık **`/[locale]/account-deleted`** sayfasına yönlendirir.
5. Hatalı parola → "Parola hatalı." · Hız sınırı → "Bir saat sonra tekrar dene." · Diğer hatalar → genel mesaj; hesap yerinde kalır.

## Sunucu akışı

```
Web Server Action (kullanıcının oturumu) ──(JWT + {password})──▶ delete-account
   1. JWT'yi doğrula: uid = JWT.sub (gövdede id kabul edilmez)
   2. Gövdeyi doğrula ({ password: 1..1024 }), fazla alanlar atılır
   3. ACCOUNT_DELETION_HASH_SALT yoksa ya da < 32 karakterse → 500, hiçbir yan etki yok
   4. Hız sınırı: kullanıcı başına saatte 5 deneme (başarısızlar dahil)
   5. Parolayı yeniden doğrula (anon client ile signInWithPassword; geçici oturum hemen kapatılır)
   6. Storage: avatars/<uid>/ altındaki bütün dosyaları sil (alt klasörler ve sayfalama dahil)
        └─ hata olursa DUR → 500; kullanıcı silinmez, işlem tekrar denenebilir
   7. auth.admin.deleteUser(uid)
        └─ ON DELETE CASCADE: profiles, watchlist_items, episode_progress, rate_limits
        └─ hata olursa → 500, denetim kaydı yazılmaz
   8. account_deletion_log ← (sha256(salt ":" uid), 'user_request', now())
        └─ hata olursa yalnızca log'a "audit log failed" yazılır; hesap silindiği için yanıt yine 200
   9. 200 { "deleted": true }
```

**Sıra bilerek böyle:** Storage önce silinir. Tersi olsaydı Storage hatası, silinmiş bir hesabın arkasında sahipsiz kişisel dosyalar bırakırdı. Denetim kaydı en sona yazılır; kullanıcı silinemezse yanlış bir "silindi" kaydı oluşmaz.

## Doğrulama kanıtları

| Katman    | Dosya                                                                                                 | Neyi kanıtlıyor                                                                                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pgTAP     | `supabase/tests/security/account_deletion.test.sql`                                                   | Cascade; başka kullanıcılar ve katalog etkilenmiyor; log tablosu kişisel veri tutmuyor, istemciler erişemiyor                                                                                                                      |
| pgTAP     | `supabase/tests/database/01_schema.test.sql`                                                          | `user_id` sütunu olan **her** tablonun cascade FK'si var (gelecekteki tablolar da)                                                                                                                                                 |
| Deno (17) | `supabase/functions/delete-account/handler.test.ts`                                                   | Sıra; IDOR; 401/400/403/429/500 yolları; tuz yokken hiçbir yan etki olmaması; Storage hatasında kullanıcının silinmemesi; log'larda parola, token ve uid olmaması; avatar temizliğinde alt klasör/sayfalama                        |
| Vitest    | `packages/shared/src/account.test.ts`, `apps/web/src/components/account/delete-account-form.test.tsx` | Form şeması; onay kutusu ve parola zorunlu; hatalı parola mesajı                                                                                                                                                                   |
| E2E       | `e2e/account.spec.ts`                                                                                 | Anonim çağrı 401; hatalı parola 403 ve hesap duruyor; başarılı silmede cookie'ler temizleniyor, eski token 401, giriş reddediliyor; DB'de kullanıcı, profil, liste, sayaç ve avatar dosyası kalmıyor; denetim satırı uid içermiyor |

## Depo sahibinin yapacakları (değerler hiçbir zaman paylaşılmaz)

```bash
# 1. Rastgele bir tuz üret ve secret olarak gir (değer terminalde kalır)
pnpm exec supabase secrets set ACCOUNT_DELETION_HASH_SALT=<openssl rand -hex 32 çıktısı>
# 2. Fonksiyonu deploy et
pnpm exec supabase functions deploy delete-account
```

- Tuz bir kez belirlenir ve **değiştirilmez**; değişirse eski kayıtlarla eşleştirme yapılamaz (silmeyi engellemez).
- Tuz girilmeden fonksiyon hiçbir şeyi silmez (fail closed) ve log'a yapılandırma hatası yazar.
- Yerelde `supabase/functions/.env` dosyasına (gitignored) kendi ürettiğin bir değer gir. E2E her çalıştırmada rastgele bir tuz üretir.

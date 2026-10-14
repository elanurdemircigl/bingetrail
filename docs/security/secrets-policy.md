# Secret Politikası

> Sahibi: SEC · Durum: Faz 0 (v1)

## 1. Anahtar envanteri

| Anahtar                                                                     | Nerede yaşar                                                   | İstemciye girebilir mi? | Kim girer                               |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------- | --------------------------------------- |
| Supabase URL                                                                | `NEXT_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`         | ✅ Evet (public)        | Depo sahibi, `.env.local` / hosting env |
| Supabase publishable key (`sb_publishable_…`)                               | `*_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                            | ✅ Evet. Yetki RLS'te   | Depo sahibi                             |
| Supabase secret/service-role key (`sb_secret_…`, legacy `service_role` JWT) | Yalnızca Edge Function ortamı (Supabase otomatik enjekte eder) | ❌ **Asla**             | Supabase                                |
| TMDB API read access token                                                  | Supabase Edge Function secret `TMDB_API_READ_ACCESS_TOKEN`     | ❌ **Asla**             | Depo sahibi, `supabase secrets set`     |

Service role yalnızca şu fonksiyonlarda kullanılır: `tmdb` (katalog önbelleği), `refresh-upcoming` (zamanlanmış iş), `delete-account` (`auth.admin.deleteUser`).

## 2. Kurallar

1. Ajanlar ve katkıcılar hiçbir zaman secret, token veya `.env.local` içeriği istemez ve paylaşmaz.
2. Yalnızca değeri boş `.env.example` dosyaları izlenir. Değer içeren bir `.env.example` CI'ı kırar.
3. `NEXT_PUBLIC_*` ve `EXPO_PUBLIC_*` önekli her değişken istemciye gömülür. Yalnızca `tooling/security/allowlist.json` → `publicEnv` listesindekiler kullanılabilir.
4. Test fixture'larında bile secret biçimli sabit yazılmaz. Sahte değerler test çalışırken parçalardan birleştirilir (bkz. `tooling/security/security.test.mjs`).

## 3. Otomatik denetimler

### `tooling/security/bundle-guard.mjs`

İstemci build çıktısını tarar: web için `apps/web/.next/static`, Faz 6'dan sonra mobil için `expo export` çıktısı. Arananlar:

| Kural                       | Ne arar                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `supabase-secret-key`       | `sb_secret_` önekli anahtarlar                                           |
| `supabase-service-role-jwt` | Payload'ı decode edilen JWT'lerde `role: "service_role"`                 |
| `tmdb-read-token`           | Payload'ında `scopes` içinde `api_read` olan JWT (TMDB v4 okuma token'ı) |
| `service-role-reference`    | `service_role` dizesi                                                    |
| `tmdb-v3-api-key`           | `api_key=<32 hex>`                                                       |
| `private-key`               | PEM private key başlıkları                                               |

`anon` rollü JWT'ler (legacy public anahtar) bulgu sayılmaz. Çıktıda secret'ın tamamı asla yazılmaz.

### `tooling/security/public-env-check.mjs`

- `apps/` ve `packages/` kaynaklarında ve `.env.example` dosyalarında geçen her public değişken adı allowlist'te olmalı.
- Adında `SECRET|SERVICE|PRIVATE|TOKEN|PASSWORD|TMDB|KEY` geçen ve allowlist'te olmayan public değişken `secret-like-public-env` hatası verir.
- `.env.example` içinde değer bulunursa `env-example-has-value` hatası verir.
- Build ortamında allowlist'teki bir public değişkene `sb_secret_…` ya da secret bir JWT konmuşsa `secret-in-public-env` hatası verir. Değer asla yazdırılmaz.

### gitleaks (`.gitleaks.toml`)

Varsayılan kurallara ek olarak `sb_secret_`, kaynakta sabit yazılmış `sb_publishable_` ve TMDB anahtar ataması kuralları vardır.

## 4. Yanlış pozitif yönetimi

Allowlist'e ekleme yalnızca SEC onayıyla ve gerekçeyle yapılır:

```json
{
  "rule": "service-role-reference",
  "path": "apps/web/.next/static/chunks/…",
  "reason": "supabase-js içindeki sabit metin, anahtar değil"
}
```

## 5. Bir secret sızarsa

1. **Hemen döndür (rotate):** Supabase Dashboard → API Keys, ya da TMDB hesap ayarları. Bunu depo sahibi yapar.
2. Git geçmişinden temizle. Bu bir Git işlemi olduğu için depo sahibi yapar.
3. Erişim log'larını incele ve olayı `docs/security/threat-model.md` içine not et.

# Güvenlik Politikası

## Açık bildirimi

Bir güvenlik açığı bulduysan **herkese açık issue açma.** Depo sahibine GitHub'ın "Report a vulnerability" (private vulnerability reporting) özelliğiyle bildir. Bildirimde şunlar olsun:

- Etkilenen bileşen (web, mobil, Edge Function, veritabanı)
- Yeniden üretme adımları
- Olası etki

Gerçek kullanıcı verisine erişen ya da başkasının hesabını etkileyen testler yapma.

## Temel kurallar

| Kural                                                                  | Uygulama                                                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Supabase secret/service-role key (`sb_secret_…`) istemciye asla girmez | Yalnızca Edge Function ortamında kullanılır. `bundle-guard`, `public-env-check` ve gitleaks bunu denetler        |
| TMDB anahtarı yalnızca Supabase Edge Function secret'ıdır              | `supabase secrets set` ile depo sahibi girer. Kaynak kodda, `.env` dosyalarında ve public değişkenlerde bulunmaz |
| Public env değişkenleri allowlist ile sınırlı                          | `tooling/security/allowlist.json` (`publicEnv`). Yeni değişken SEC onayı gerektirir                              |
| `.env.local` ve gerçek değerler repoya girmez                          | `.gitignore` bütün `.env*` dosyalarını dışlar, yalnızca `.env.example` izlenir                                   |
| Bütün tablolarda RLS                                                   | Faz 1'den itibaren pgTAP ile pozitif ve negatif testler                                                          |
| Git, commit, push ve deploy                                            | Yalnızca depo sahibi yapar; otomasyon ajanları yapmaz                                                            |

## Otomatik kontroller

```bash
pnpm run security:check   # public-env-check + bundle-guard (web build sonrası)
pnpm run test:security    # tarayıcıların kendi testleri
```

CI ayrıca gitleaks'i `.gitleaks.toml` ile çalıştırır.

Ayrıntılar: [docs/security/secrets-policy.md](docs/security/secrets-policy.md) · Tehdit modeli: [docs/security/threat-model.md](docs/security/threat-model.md)

# Tehdit Modeli

> Sahibi: SEC · Sürüm: v0 (Faz 0) · Yöntem: STRIDE · Her fazın sonunda güncellenir.

## Kapsam (Faz 0)

Faz 0'da kullanıcı verisi, kimlik doğrulama ve backend yok. Bu sürüm, ileride inşa edilecek sistemin varlıklarını, güven sınırlarını ve araç zinciri risklerini tanımlar.

## Varlıklar

| Varlık                                                   | Hassasiyet                              |
| -------------------------------------------------------- | --------------------------------------- |
| Kullanıcı hesabı (e-posta, parola hash'i: Supabase Auth) | Yüksek                                  |
| Kişisel notlar, puanlar, izleme geçmişi                  | Orta–Yüksek (kişisel veri)              |
| Supabase secret/service-role key                         | Kritik                                  |
| TMDB API token                                           | Yüksek (kota ve hesap kötüye kullanımı) |
| Katalog önbelleği (TMDB verisi)                          | Düşük                                   |

## Güven sınırları

```
[Tarayıcı / Mobil cihaz]  ──publishable key + kullanıcı JWT──▶  [Supabase PostgREST + RLS]
          │                                                          ▲
          └──JWT──▶ [Edge Functions] ──secret key (yalnızca sunucu)───┘
                         └──TMDB token (secret)──▶ [TMDB API]
```

İstemci tarafındaki her şey güvenilmezdir. Yetki kararı yalnızca RLS ve Edge Function'larda verilir.

## STRIDE (v0)

| Tehdit                     | Örnek                                                  | Önlem                                                                           | Faz     |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | ------- |
| **S**poofing               | Çalınmış oturum ile başka kullanıcı gibi davranma      | PKCE, HttpOnly cookie, sunucuda `getUser`/`getClaims`, mobilde şifreli depolama | 2, 6    |
| **T**ampering              | İstemcinin başka kullanıcının `user_id`'si ile yazması | RLS `with check`, Edge Function'larda yalnızca JWT `sub`                        | 1, 4    |
| **R**epudiation            | Hesap silme işleminin izlenememesi                     | Kişisel veri içermeyen `account_deletion_log`                                   | 1, 4    |
| **I**nformation disclosure | Secret'ın istemci bundle'ına sızması                   | bundle-guard, public-env-check, gitleaks (**Faz 0'da aktif**)                   | 0       |
| **I**nformation disclosure | Başka kullanıcının verisinin okunması                  | RLS ve negatif pgTAP testleri                                                   | 1       |
| **D**enial of service      | TMDB kotasının tüketilmesi                             | Kullanıcı başına rate limit, önbellek                                           | 3       |
| **E**levation of privilege | Service role'ün istemciden kullanılması                | Service role yalnızca 3 Edge Function'da; istemcide denetim                     | 0, 3, 4 |

## Araç zinciri riskleri (Faz 0)

| Risk                                                                    | Durum                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Üst Git deposu (`C:\Users\elqnu`) yüzünden kazara hassas dosya commit'i | **Açık.** Depo sahibi `bingetrail` içinde bağımsız depo açmalı                                |
| Bağımlılık install script'leri                                          | pnpm 10 varsayılan olarak engelliyor. Yalnızca `unrs-resolver` onaylı (`pnpm-workspace.yaml`) |
| Undeclared bağımlılık yaması                                            | `react-native-css-interop` için `packageExtensions` (yalnızca bir Babel eklentisi eklendi)    |
| ESLint 9.x npm'de "deprecated" işaretli                                 | Kabul edildi. eslint-config-next ESLint 10'u desteklediğinde yükseltilecek (ADR-0001)         |

# Cihazlar Arası Senkronizasyon

> Durum: Faz 7 · Karar: [ADR-0007](adr/0007-sync.md) · Migration: `20261017090000_realtime_sync.sql`

## Nasıl çalışıyor

```
Web/mobil yazma (RLS) ──▶ watchlist_items / episode_progress
                              │  AFTER … FOR EACH STATEMENT tetikleyicisi
                              ▼
            realtime.send({ table, titleIds }, 'changed', 'user:<HMAC>', public)
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
   Web (LiveSync)                          Mobil (LiveSyncProvider)
   router.refresh() → sunucu,             ilgili TanStack sorgularını
   cookie oturumuyla yeniden çizer         geçersiz kılar → yeniden çeker
```

- **Konu (topic):** `user:` + HMAC-SHA256(kullanıcı id, veritabanında üretilen gizli anahtar). Gizli anahtar `private.realtime_secret` tablosunda; istemciler okuyamaz. Kullanıcı kendi konusunu yalnızca oturumuyla `my_realtime_topic()` RPC'sinden alır; başkasınınkini hesaplayamaz.
- **Sinyal içeriği:** Yalnızca `{ table, titleIds }`. Not, puan, kullanıcı id'si yok. İstemci sinyale güvenmez, veriyi kendi oturumuyla (RLS) yeniden okur.
- **Web'de token yok:** Tarayıcıdaki Realtime istemcisi yalnızca publishable key ile bağlanır; oturum cookie'leri HttpOnly kalır (ADR-0002). Sinyal gelince `router.refresh()` sayfayı sunucuda yeniden üretir.
- **Toplu işlem = tek sinyal:** Tetikleyiciler satır değil ifade düzeyinde; 120 bölüm işaretlemek tek sinyal gönderir.
- **Kopma sonrası:** Bağlantı yeniden kurulunca istemciler bir kez tam yenileme yapar (kaçan sinyaller için).
- **Ölçüm:** Yerelde değişiklik öteki oturumda 2 saniye içinde görünüyor (E2E sınırı 2 sn).

## Çevrimdışı (mobil)

- **Kuyruk:** Bağlantı yokken (NetInfo → TanStack `onlineManager`) değişiklikler bekletilir ve ekranda hemen görünür. Bağlantı gelince sırayla gönderilir. Bütün yazmalar tek bir `scope` altında olduğu için sıra korunur.
- **Kalıcılık:** Sorgu önbelleği ve bekleyen değişiklikler uygulama kapanıp açılsa da kaybolmaz. Notlar gibi kişisel veriler içerdiği için oturumla aynı yöntemle şifrelenir (AES anahtarı SecureStore'da). En fazla 7 gün saklanır; çıkışta ve hesap değişiminde silinir.
- **Gösterge:** Çevrimdışıyken üstte "Çevrimdışısın…" bandı ve bekleyen değişiklik sayısı; Profil'de Canlı / Bağlanıyor / Çevrimdışı. Web'de üst çubukta aynı durum etiketi.

## Çakışma politikası

| Veri                   | Kural                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `watchlist_items`      | **Son yazan kazanır, sunucuya varış sırasına göre.** `updated_at` her zaman sunucunun `now()` değeri. Yazmalar alan gruplarına ayrı gider (durum ↔ puan/not), bu yüzden telefonda durum, web'de not değişirse ikisi de korunur. |
| `episode_progress`     | Tekrarlansa da aynı sonuç: işaretleme `on conflict do nothing`, kaldırma silme.                                                                                                                                                 |
| Ekleme / silme tekrarı | Kuyruktaki "ekle" başlık zaten eklenmişse, "sil" zaten silinmişse başarılı sayılır.                                                                                                                                             |
| Saat kayması           | Mobil yazdığı tarihleri (başlama/bitiş, son etkinlik) **sunucu saatine göre** yazar: açılışta ve her yeniden bağlanmada `server_now()` ile fark ölçülür. Saati yanlış bir telefon tarih kısıtlarını bozamaz.                    |

Neden "işlem zamanına göre" değil: Kuyrukta sırayla bekleyen kendi değişikliklerin birbirini geçersiz saymaması için sürüm takibi gerekirdi. Sunucuya varış sırası basit, tahmin edilebilir ve veri kaybettirmiyor (alan bazlı yazma ile).

## Testler

| Katman     | Dosya                                                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pgTAP      | `supabase/tests/security/realtime_sync.test.sql`: konu biçimi ve kullanıcıya özgülüğü, gizli anahtar ve üreteç istemcilere kapalı, ifade başına tek sinyal, sinyalde kişisel veri yok, anonim konu alamaz                        |
| Vitest     | `packages/shared/src/sync.test.ts`, `packages/api-client/src/sync.test.ts`: olay şeması, konu doğrulama, etkilenen sorgular, saat farkı                                                                                          |
| jest-expo  | `apps/mobile/src/lib/sync/sync.test.tsx`: 10 çevrimdışı değişiklik yeniden başlatma sonrası sırasıyla ve eksiksiz uygulanıyor; "zaten oldu" tekrarları başarılı; geçerli/geçersiz sinyal; kopma sonrası yenileme; kanal kapanışı |
| Playwright | `e2e/sync.spec.ts`: iki oturum (liste ve bölüm), başka kullanıcıya sinyal gitmiyor, tarayıcıda token yok                                                                                                                         |
| Elle       | [mobile-device-checklist.md](mobile-device-checklist.md) → "Senkronizasyon ve çevrimdışı"                                                                                                                                        |

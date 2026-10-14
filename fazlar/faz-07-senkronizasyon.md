# Faz 7 — Cihazlar Arası Senkronizasyon

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Web + mobil** · Bağımlılık: [Faz 6](faz-06-mobil-cekirdek.md) · Sonraki: [Faz 10](faz-10-sertlestirme-yayin.md) · Karmaşıklık: Yüksek
>
> Revizyon 1'de bu faz "Faz 6" idi.

- **Amaç:** Web ve mobil arasında anlık tutarlılık, mobilde offline dayanıklılık.
- **Kullanıcı değeri:** Telefonda işaretlenen bölüm web'de anında görünür; bağlantı yokken yapılan işlemler sonra senkronlanır.
- **Teknik teslimler:**
  - Realtime abonelik yardımcıları her uygulamada ayrı yazılır (`apps/web`, `apps/mobile`); filtre `user_id=eq.<uid>`.
  - `api-client` yalnızca olay → DTO mapper'ını ve etkilenen query key'leri paylaşır (K3).
  - Mobilde TanStack Query persist ve duraklatılmış mutation kuyruğu.
  - Çakışma politikası: `watchlist_items` için `updated_at` ile last-write-wins; `episode_progress` idempotent.
  - Bağlantı durumu göstergesi.
- **Bağımlılık:** Faz 6.
- **Kabul kriterleri:** Değişiklik 2 saniye içinde öteki istemcide görünür. Offline'da yapılan 10 işlem kayıpsız uygulanır. Başka kullanıcının olayları alınmaz.
- **Test stratejisi:**
  - İki browser context'li Playwright senaryosu.
  - Kuyruk ve çakışma mantığı için Vitest.
  - Mobil senkron davranışı için `jest-expo` + React Native Testing Library (K10).
  - Realtime yetki güvenlik testi.
  - Web ↔ mobil elle test (cihaz kontrol listesine eklenir).
- **Riskler ve güvenlik:** Realtime RLS doğrulaması, kanal sızıntısı (unmount'ta unsubscribe), pil tüketimi, saat kayması (sunucu `now()` esas alınır).
- **Görevler:** APP: senkron katmanı (web ve mobil) · DB: publication ve replica identity · SEC: realtime yetki testi · QA: çoklu istemci E2E · DOC: `docs/sync.md`.
- **Quality Gate 7.**

## Revizyon 1'den kaldırılan veya taşınan görevler
- ~~`api-client` içinde ortak Realtime aboneliği~~ → Abonelikler platforma özel; `api-client` yalnızca mapper ve query key paylaşır (K3).
- ~~Bağımlılık: Faz 5~~ → Faz 6 (mobil olmadan cihazlar arası senkron test edilemez).

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)

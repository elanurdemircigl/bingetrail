# Faz 8 — Yaklaşan Bölüm Takvimi

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Web → mobil** · Bağımlılık: [Faz 5](faz-05-bolum-takibi-continue-watching.md) (backend ve web), [Faz 6](faz-06-mobil-cekirdek.md) (mobil ekran) · Sonraki: [Faz 10](faz-10-sertlestirme-yayin.md) · Karmaşıklık: Orta
>
> Revizyon 1'de bu faz "Faz 7" idi.

- **Amaç:** Takip edilen dizilerin yaklaşan bölümlerini göstermek.
- **Kullanıcı değeri:** Haftalık ve aylık takvim, "bugün / bu hafta" listesi.
- **Teknik teslimler:**
  - `refresh-upcoming` Edge Function. `pg_cron` + `pg_net` ile günlük tetiklenir ve gizli bir cron header'ı kullanır. Yalnızca en az bir kullanıcının listesinde `watching`/`planned`/`paused` durumunda olan devam eden dizileri tazeler.
  - `get_upcoming_episodes(from, to)`.
  - `api-client` içinde takvim sözleşmeleri.
  - Önce web takvimi, Faz 6 tamamlandıktan sonra mobil ekran. Saat dilimi `profiles.timezone`'dan alınır.
- **Bağımlılık:** Backend ve web için Faz 5 (Faz 6 ile paralel yürüyebilir), mobil ekran için Faz 6.
- **Kabul kriterleri:** Yeni yayın tarihi en geç 24 saat içinde görünür. Fonksiyon anonim olarak tetiklenemez. Tarihler TR ve EN biçiminde gösterilir.
- **Test stratejisi:** Deno ile seçim mantığı ve TMDB mock, pgTAP ile tarih aralığı fonksiyonu, Vitest ile saat dilimi yardımcıları, Playwright ile web takvim görünümü, `jest-expo` + RNTL ile mobil ekran (K10).
- **Riskler ve güvenlik:** TMDB rate limit (batch ve gecikme), yetkisiz cron çağrısı, TMDB'nin saat bilgisi vermemesi (UI'da belirtilir).
- **Görevler:** DB: fonksiyon ve cron migration'ı · APP: önce web, sonra mobil takvim UI'ı · SEC: cron yetkilendirme incelemesi · QA: testler · DOC: cron runbook'u.
- **Quality Gate 8:** `refresh-upcoming` cron'unu prod'da sen etkinleştirirsin.

## Revizyon 1'den kaldırılan veya taşınan görevler
- ~~"Faz 8 (export) ile paralel" notu~~ → Yeni paralellik: Faz 6 ile birlikte, Faz 9'un backend ve web işleriyle aynı dalgada. DB işleri tek DB agentında sıralı yapılır.

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)

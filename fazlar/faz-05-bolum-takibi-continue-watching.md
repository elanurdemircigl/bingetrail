# Faz 5 — Sezon/Bölüm Takibi ve Continue Watching (Web)

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Web** + backend · Bağımlılık: [Faz 4](faz-04-izleme-listesi.md) · Sonraki: [Faz 6](faz-06-mobil-cekirdek.md), [Faz 8](faz-08-yaklasan-bolum-takvimi.md), [Faz 9](faz-09-disa-aktarma.md) · Karmaşıklık: Yüksek

- **Amaç:** Dizilerde bölüm düzeyinde ilerleme.
- **Kullanıcı değeri:** Bölüm, sezon veya "buraya kadar" işaretleme; ilerleme çubuğu; Ana sayfada "Continue Watching".
- **Teknik teslimler:**
  - `mark_episodes_watched(episode_ids[])` ve `unmark_episodes` RPC'leri (security invoker, dizi boyutu limitli).
  - `get_continue_watching()`: `watching` durumundaki başlıkları `last_activity_at`'e göre sıralar ve sıradaki yayınlanmış ama izlenmemiş bölümü döner.
  - Bölüm işaretlendiğinde `last_activity_at` güncellenir.
  - Tüm yayınlanmış bölümler izlenince "Tamamlandı olarak işaretle?" önerisi çıkar; otomatik geçiş yapılmaz.
  - `api-client` içinde ilerleme sözleşmeleri, web'de UI.
- **Bağımlılık:** Faz 4. (`episode_progress` tablosu Faz 1'den gelir.)
- **Kabul kriterleri:** 100'den fazla bölümlük toplu işaretleme tek istekte biter. Continue Watching doğru bölümü gösterir (sezon 0 hariç). Yayınlanmamış bölüm işaretlenemez.
- **Test stratejisi:** pgTAP ile RPC'ler ve RLS. Vitest ile ilerleme hesabı. Playwright ile sezon işaretle → ana sayfada sıradaki bölüm görünür.
- **Riskler ve güvenlik:** Security invoker kullanımı, DoS'a karşı dizi boyutu limiti, N+1 sorguları.
- **Görevler:** DB: RPC'ler ve pgTAP · APP: sözleşmeler ve web UI · SEC: RPC incelemesi · QA: E2E ve performans ölçümü · DOC: veri modeli güncellemesi.
- **Quality Gate 5 = "web çekirdeği stabil" kapısı.**
  - Faz 2–5 web E2E paketi yeşil olmalı.
  - İki gate boyunca DTO ve query key sözleşmelerinde kırıcı değişiklik olmamalı.
  - Mobil faza (Faz 6) geçiş onayı bu kapıda verilir.

## Revizyon 1'e göre değişiklikler
- **Eklendi:** "Web çekirdeği stabil" kapısı rolü (K1).
- **Kaldırıldı:** `episode_progress` tablosunun bu fazda oluşturulması. Tablo Faz 1 veri modelinde yer alır.

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)

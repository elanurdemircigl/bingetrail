# Faz 3 — TMDB Proxy ve Katalog/Arama (Web)

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Web** + backend · Bağımlılık: [Faz 1](faz-01-supabase-cekirdegi.md) (fonksiyon), [Faz 2](faz-02-auth-i18n-kabuk.md) (UI) · Sonraki: [Faz 4](faz-04-izleme-listesi.md) · Karmaşıklık: Yüksek

- **Amaç:** TMDB verisine güvenli ve önbellekli erişim.
- **Kullanıcı değeri:** Film/dizi arama, detay sayfası, sezon ve bölüm listesi; TR/EN içerik dili.
- **Teknik teslimler:**
  - `tmdb` Edge Function'ın `search`, `title` ve `season` uçları. Her uçta JWT zorunludur, girdi Zod ile doğrulanır, yanıt normalize edilir, `language` parametresi desteklenir.
  - TTL ile önbellek upsert'i (`fetched_at`, `last_referenced_at`). Service role yalnızca burada kullanılır.
  - Kullanıcı başına rate limit (`rate_limits`).
  - `api-client` içinde katalog DTO'ları, mapper'lar ve `queryKeys.catalog`.
  - Web TanStack hook'ları (`apps/web` içinde ince katman).
  - Arama, detay ve sezon ekranları; TMDB atıf metni.
  - `docs/data-retention.md` (katalog önbelleği saklama politikası).
  - `catalog_cache_stats()` ve yalnızca okuyan haftalık `catalog_cache_report`.
- **Bağımlılık:** Fonksiyon için Faz 1, UI için Faz 2. DB agentı fonksiyona Faz 2 sürerken başlayabilir.
- **Kabul kriterleri:**
  - İstemci build çıktısı bundle-guard ve public-env denetiminden geçer.
  - JWT'siz çağrı 401, geçersiz parametre 400 alır.
  - Tekrarlanan detay isteği önbellekten gelir.
  - Arama TR ve EN'de sonuç döndürür.
  - **Temizleme cron'u (`catalog_cache_cleanup`) pasiftir** (K7).
- **Test stratejisi:** Deno testleri (TMDB mock'lu fetch), Vitest + MSW ile veri erişim fonksiyonları, Playwright ile arama → detay akışı.
- **Riskler ve güvenlik:** Path'ler beyaz listeden kurulur (SSRF engeli). TMDB kotası için önbellek ve backoff. CORS allowlist'i. TMDB atıf şartı.
- **Görevler:** DB: Edge Function, `_shared`, rapor fonksiyonu · APP: sözleşmeler, web hook'ları, UI · SEC: fonksiyon tehdit incelemesi · QA: E2E ve MSW fixture'ları · DOC: `docs/edge-functions/tmdb.md`, `docs/data-retention.md`, secret runbook'u (değer içermez).
- **Quality Gate 3:**
  - TMDB secret'ını sen girersin, fonksiyonu sen deploy edersin.
  - `rate_limits` temizleme cron'unu ve yalnızca okuyan rapor cron'unu sen etkinleştirirsin.

## Revizyon 1'den kaldırılan veya taşınan görevler
- ~~`api-client` içinde `useSearch`, `useTitle`, `useSeason` hook'ları~~ → Hook'lar artık her uygulamada. `api-client` yalnızca query key, DTO, mapper ve veri erişim fonksiyonlarını paylaşır (K3).
- ~~Kabul kriteri: "bundle'da TMDB anahtarı yok" (metin araması)~~ → bundle-guard'ın token ve JWT desen kontrolü (K6).

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)

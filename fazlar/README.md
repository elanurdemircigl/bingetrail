# BingeTrail — Faz Dizini

> Kaynak: [`../plan.md`](../plan.md), Revizyon 2.1. Bu klasördeki dosyalar ile `plan.md` çelişirse `plan.md` geçerlidir.

| # | Faz | Platform | Bağımlılık | Dosya |
|---|-----|----------|------------|-------|
| 0 | Monorepo temeli | Web + mobil iskelet | — | [faz-00-monorepo-temeli.md](faz-00-monorepo-temeli.md) |
| 1 | Supabase çekirdeği + hesap silme modeli | Backend | 0 | [faz-01-supabase-cekirdegi.md](faz-01-supabase-cekirdegi.md) |
| 2 | Auth + i18n + kabuk | Web | 1 | [faz-02-auth-i18n-kabuk.md](faz-02-auth-i18n-kabuk.md) |
| 3 | TMDB proxy + katalog/arama | Web | 1, 2 | [faz-03-tmdb-katalog-arama.md](faz-03-tmdb-katalog-arama.md) |
| 4 | İzleme listesi, puan, not + hesap silme UI | Web | 3 | [faz-04-izleme-listesi.md](faz-04-izleme-listesi.md) |
| 5 | Bölüm takibi + Continue Watching (**web çekirdeği stabil kapısı**) | Web | 4 | [faz-05-bolum-takibi-continue-watching.md](faz-05-bolum-takibi-continue-watching.md) |
| 6 | Mobil çekirdek | Mobil | 5 | [faz-06-mobil-cekirdek.md](faz-06-mobil-cekirdek.md) |
| 7 | Cihazlar arası senkronizasyon | Web + mobil | 6 | [faz-07-senkronizasyon.md](faz-07-senkronizasyon.md) |
| 8 | Yaklaşan bölüm takvimi | Web → mobil | 5 (web), 6 (mobil) | [faz-08-yaklasan-bolum-takvimi.md](faz-08-yaklasan-bolum-takvimi.md) |
| 9 | JSON/CSV dışa aktarma | Web → mobil | 4–5 (web), 6 (mobil) | [faz-09-disa-aktarma.md](faz-09-disa-aktarma.md) |
| 10 | Sertleştirme ve yayın | Web + mobil | 7, 8, 9 | [faz-10-sertlestirme-yayin.md](faz-10-sertlestirme-yayin.md) |

```
0 → 1 → 2 → 3 → 4 → 5 ─┬→ 6 (mobil) → 7 (senkron) ─┐
                        ├→ 8 (takvim: backend+web) ──┼→ 10
                        └→ 9 (export: backend+web) ──┘
```

**Not:** Revizyon 1'deki eski faz numaraları (eski Faz 6–9) artık geçerli değil. Eski numaralı dosyalar silindi. Her faz dosyasının sonundaki "Revizyon 1'den kaldırılan veya taşınan görevler" bölümü değişikliklerin izini tutar.

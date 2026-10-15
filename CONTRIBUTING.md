# Katkı Rehberi

## Çalışma modeli

Proje fazlar halinde ilerler ([plan.md](plan.md), [fazlar/](fazlar/README.md)). Her faz bir **quality gate** ile biter ve depo sahibinin onayı gelmeden sonraki faza geçilmez.

## Dosya sahipliği

Aynı dosyaya iki ajan paralel yazmaz. Her ajan yalnızca kendi alanına yazar. Başka bir alanda değişiklik gerekiyorsa bulguyu raporlar ve değişikliği o alanın sahibi yapar.

| Ajan                                 | Yazabildiği yerler                                                                                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **APP** (ana uygulama geliştiricisi) | `apps/**`, `packages/shared`, `packages/api-client`, `packages/i18n`, `packages/config`, kök config (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.gitignore`, `.editorconfig`, prettier, `tsconfig.json`), `tooling/scripts/**`, yanındaki birim testleri |
| **DB** (veritabanı ve Supabase)      | `supabase/**` (`tests/security` hariç), `packages/db-types`                                                                                                                                                                                                                   |
| **SEC** (güvenlik)                   | `tooling/security/**`, `.gitleaks.toml`, `supabase/tests/security/**`, `docs/security/**`, `SECURITY.md`                                                                                                                                                                      |
| **QA** (test ve kalite)              | `e2e/**`, `tests/integration/**`, `.github/workflows/**`, `playwright.config.ts`                                                                                                                                                                                              |
| **DOC** (dokümantasyon)              | `docs/**` (`docs/security` hariç), `README.md`, `CONTRIBUTING.md`                                                                                                                                                                                                             |

## Kesin yasaklar

- **Ajanlar hiçbir Git komutu çalıştırmaz.** Commit, push, branch, merge ve deploy işlemlerini depo sahibi yapar.
- Secret, token veya `.env.local` içeriği istenmez, yazılmaz, paylaşılmaz.
- Yeni bir `NEXT_PUBLIC_*` veya `EXPO_PUBLIC_*` değişkeni SEC onayı olmadan eklenmez.
- `dangerouslySetInnerHTML` kullanılmaz (lint kuralı).
- Paylaşılan paketler (`shared`, `api-client`, `i18n`, `db-types`) React'e, Next'e, Expo'ya veya `@supabase/ssr`'a bağımlı olamaz (lint kuralı).

## Bir değişikliği bitirmeden önce

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm db:start                     # yerel Supabase (Docker)
pnpm build:web:local && pnpm security:check:local
pnpm test:security && pnpm test:e2e
pnpm db:test && pnpm db:advisors
pnpm run format:check
```

## Commit mesajları

[Conventional Commits](https://www.conventionalcommits.org/) biçimi kullanılır: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`. Ajanlar her quality gate'te bir mesaj önerir; commit'i depo sahibi atar.

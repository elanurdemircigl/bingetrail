# ADR-0001: Teknoloji yığını ve sürüm politikası

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-14
- **Faz:** 0

## Bağlam

BingeTrail web ve mobil olarak iki platformda, ortak bir Supabase backend'iyle geliştirilecek. Plan web-önce stratejisini öngörüyor: mobil, Faz 0'da yalnızca çalışan bir iskelet; özellik geliştirmesi Faz 6'da başlıyor ([plan.md](../../plan.md), K1).

## Kararlar

### 1. Monorepo

pnpm 10 workspace ve Turborepo 2. Paylaşılan paketler build adımı olmadan doğrudan TypeScript kaynağından tüketilir: `exports` → `src/index.ts`. Next tarafında `transpilePackages`, mobilde Metro kullanılır.

Ortak araç sürümleri `pnpm-workspace.yaml` → `catalog:` içinde tutulur. **React bilerek bu katalogda yok.**

### 2. Doğrulanmış sürümler (2026-10-14)

| Paket             | Sürüm         | Not                               |
| ----------------- | ------------- | --------------------------------- |
| Node.js           | 24.18.1 (LTS) | `.nvmrc` = 24                     |
| pnpm              | 10.34.7       | `packageManager`                  |
| Turborepo         | 2.11.8        |                                   |
| Next.js           | 16.4.0        | Turbopack build                   |
| React (web)       | 19.3.0        | Next'in desteklediği sürüm        |
| Expo SDK          | 57.0.28       | expo-router 57.0.26               |
| React (mobil)     | 19.2.3        | Expo SDK 57'nin sabitlediği sürüm |
| React Native      | 0.86.3        | Expo SDK 57                       |
| NativeWind        | 4.2.7         | Tailwind 3.4.19 ile               |
| Tailwind (web)    | 4.3.3         | `@tailwindcss/postcss`            |
| **TypeScript**    | **6.0.3**     | Ayrıntı: §3                       |
| **ESLint**        | **9.39.5**    | Ayrıntı: §4                       |
| typescript-eslint | 8.71.2        |                                   |
| Vitest            | 5.0.4         | Vite 8                            |
| Playwright        | 1.64.0        |                                   |
| Zod               | 4.6.7         |                                   |

### 3. TypeScript: TS 7 yerine 6.0.3 (K14 uyarınca)

Karar TS 7 ile başlamaktı, ancak uyumsuzluk tespit edildi:

- `typescript-eslint@8.71.2` peer bağımlılığı `typescript >=4.8.4 <6.1.0`.
- `typescript@7.0.2` (yerel Go derleyicisi) klasik JS API'sini dışa vermiyor; yalnızca `./unstable/*` export'ları var. Next.js'in build sırasındaki tip denetimi ve typescript-eslint bu API'ye bağlı.

**Sonuç:** Uyumlu en güncel sürüm olan **6.0.3**'e sabitlendi.
**Yeniden değerlendirme:** typescript-eslint TS 7'yi desteklediğinde ve Next TS 7 API'siyle çalıştığında.

### 4. ESLint: 10 yerine 9.39.5

`eslint-config-next@16.4.0`, `eslint-plugin-react@7.37.5` ve `eslint-plugin-jsx-a11y@6.10.2` paketlerini içeriyor. Bu eklentilerin peer aralığı ESLint ≤ 9. 9.x serisi npm'de "deprecated" olarak işaretli. Bu bilinen ve kabul edilmiş bir risk.

**Yeniden değerlendirme:** eslint-config-next ESLint 10'u desteklediğinde.

### 5. React sürümleri platforma göre (K2)

Web ve mobil React sürümleri **eşitlenmez**. Mobilde Expo SDK belirleyicidir; `expo install --check` her bağımlılık güncellemesinde çalıştırılır. Paylaşılan paketler React'e bağımlı değildir. Bu kural lint ile zorunlu: `no-restricted-imports` (`@bingetrail/config/eslint/platform-agnostic`).

Expo `react-dom`'u peer olarak istediği için mobil `react-dom@19.2.3`'ü açıkça bildirir. Aksi halde pnpm en son sürümü (19.3.0) seçip uyumsuzluk çıkarıyor.

### 6. Platforma özel Supabase client'ları (K3)

Tek bir ortak client yoktur.

- `apps/web/src/lib/supabase/*` → `@supabase/ssr` ve cookie (Faz 2).
- `apps/mobile/src/lib/supabase/client.ts` → SecureStore tabanlı depolama (Faz 6).
- `packages/api-client` yalnızca query key, DTO, mapper ve client'ı parametre olarak alan veri erişim fonksiyonlarını içerir. `@supabase/supabase-js` bu pakette yalnızca peerDependency (tipler için).

### 7. pnpm izole node_modules ve Expo

Hoisted moda geçilmedi. İzole modda iki düzeltme gerekti:

- `react-native-css-interop` Babel preset'i, bağımlılık olarak tanımlamadığı `@babel/plugin-transform-react-jsx`'i çağırıyor. Bu, `pnpm-workspace.yaml` → `packageExtensions` ile eklendi.
- NativeWind'in JSX runtime'ı (`react-native-css-interop/jsx-runtime`) uygulama kodundan çözüldüğü için `react-native-css-interop` mobilde doğrudan bağımlılık yapıldı.

Doğrulama: `expo export --platform android` başarılı, `expo install --check` temiz.

### 8. Stil ve tasarım token'ları

Web Tailwind 4, mobil NativeWind 4 (Tailwind 3) kullanır. Ortak olan yalnızca `@bingetrail/config/tokens`'tır. Web'de token'lar `@config` ile, mobilde `tailwind.config.js` ile yüklenir.

### 9. Test araçları (K10, K11)

- Paketler ve web için Vitest; web bileşenleri için React Testing Library + jsdom.
- Web E2E için Playwright.
- Mobil ekran testleri Faz 6'da `jest-expo` + React Native Testing Library ile eklenecek.
- Mobil E2E için Maestro, Faz 10'da değerlendirilecek.

## Sonuçlar

- TS 7 ve ESLint 10'a geçiş ayrı bir ADR ile yapılır.
- Mobil React/RN sürümü yalnızca Expo SDK yükseltmesiyle değişir.
- Hosting kararı (K15) bu ADR'nin kapsamında değil, Faz 10'da verilecek.

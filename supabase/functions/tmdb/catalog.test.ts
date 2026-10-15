import { assertEquals } from '@std/assert';

import { titleDetailSchema } from '../_shared/contracts/catalog.ts';

import { toDate, toImage, titleInputFromTv, toTitleDetail } from './catalog.ts';
import { NOW, rawTv } from './test-fakes.ts';

Deno.test('dates and image paths are validated, never passed through blindly', () => {
  assertEquals(toDate('2011-04-17'), '2011-04-17');
  for (const bad of ['', '2011', '17.04.2011', null]) assertEquals(toDate(bad), null);
  assertEquals(toImage('/abc_1.jpg'), '/abc_1.jpg');
  for (const bad of ['https://evil.example/x.jpg', '/../x.jpg/..', 'x.jpg', '/a b.jpg', null]) {
    assertEquals(toImage(bad), null, String(bad));
  }
});

Deno.test('season names keep earlier locales when a new one is fetched', () => {
  const tr = titleInputFromTv(rawTv(), 'tr', null);
  const existing = {
    ...tr,
    id: 1,
    fetchedAt: NOW.toISOString(),
    seasons: tr.seasons.map((s, i) => ({ ...s, id: i + 10, fetchedAt: NOW.toISOString() })),
  };
  const en = titleInputFromTv(
    rawTv({
      name: 'Game of Thrones',
      seasons: [{ season_number: 1, name: 'Season 1', air_date: null, episode_count: 2 }],
    }),
    'en',
    existing,
  );
  assertEquals(en.seasons[0]?.name, { tr: '1. Sezon', en: 'Season 1' });
  assertEquals(Object.keys(en.translations).sort(), ['en', 'tr']);
});

Deno.test('detail falls back to another locale, then to the original title', () => {
  const input = titleInputFromTv(rawTv(), 'tr', null);
  const record = { ...input, id: 7, fetchedAt: NOW.toISOString(), seasons: [] };
  const en = titleDetailSchema.parse(toTitleDetail(record, 'en'));
  assertEquals(en.title, 'Taht Oyunları', 'uses the cached Turkish title when English is missing');

  const bare = titleDetailSchema.parse(toTitleDetail({ ...record, translations: {} }, 'en'));
  assertEquals(bare.title, 'Game of Thrones');
});

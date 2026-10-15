import type { SupabaseClient } from '@supabase/supabase-js';

import type { MediaType } from '../_shared/contracts/catalog.ts';

import type {
  EpisodeRecord,
  Localized,
  SeasonInput,
  SeasonRecord,
  SeasonWithEpisodes,
  TitleInput,
  TitleRecord,
} from './catalog.ts';
import type { CatalogStore } from './handler.ts';

// Catalog tables are written only here, with the service-role client (RLS
// gives clients read-only access). Inputs are already validated and mapped.

const TITLE_COLUMNS =
  'id, tmdb_id, media_type, original_title, translations, poster_path, backdrop_path, release_date, ' +
  'tmdb_status, number_of_seasons, fetched_at, seasons(id, season_number, name, air_date, episode_count, fetched_at)';
const SEASON_COLUMNS =
  'id, title_id, season_number, name, air_date, episode_count, fetched_at, ' +
  'episodes(id, episode_number, name, air_date, runtime)';

type Row = Record<string, unknown>;

const asLocalized = <T>(value: unknown) =>
  (value && typeof value === 'object' ? value : {}) as Localized<T>;

function toSeasonRecord(row: Row): SeasonRecord {
  return {
    id: row.id as number,
    seasonNumber: row.season_number as number,
    name: asLocalized<string>(row.name),
    airDate: (row.air_date as string | null) ?? null,
    episodeCount: (row.episode_count as number | null) ?? null,
    fetchedAt: row.fetched_at as string,
  };
}

function toTitleRecord(row: Row): TitleRecord {
  return {
    id: row.id as number,
    tmdbId: row.tmdb_id as number,
    mediaType: row.media_type as MediaType,
    originalTitle: row.original_title as string,
    translations: asLocalized(row.translations),
    posterPath: (row.poster_path as string | null) ?? null,
    backdropPath: (row.backdrop_path as string | null) ?? null,
    releaseDate: (row.release_date as string | null) ?? null,
    tmdbStatus: (row.tmdb_status as string | null) ?? null,
    numberOfSeasons: (row.number_of_seasons as number | null) ?? null,
    fetchedAt: row.fetched_at as string,
    seasons: ((row.seasons as Row[] | null) ?? []).map(toSeasonRecord),
  };
}

function toSeasonWithEpisodes(row: Row): SeasonWithEpisodes {
  return {
    ...toSeasonRecord(row),
    titleId: row.title_id as number,
    episodes: ((row.episodes as Row[] | null) ?? []).map((e): EpisodeRecord => ({
      id: e.id as number,
      episodeNumber: e.episode_number as number,
      name: asLocalized<string>(e.name),
      airDate: (e.air_date as string | null) ?? null,
      runtime: (e.runtime as number | null) ?? null,
    })),
  };
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`catalog store: ${result.error.message}`);
  return result.data;
}

export function createCatalogStore(admin: SupabaseClient): CatalogStore {
  async function findTitle(mediaType: MediaType, tmdbId: number) {
    const row = check(
      await admin
        .from('titles')
        .select(TITLE_COLUMNS)
        .eq('media_type', mediaType)
        .eq('tmdb_id', tmdbId)
        .maybeSingle(),
    );
    return row ? toTitleRecord(row as unknown as Row) : null;
  }

  async function findSeason(titleId: number, seasonNumber: number) {
    const row = check(
      await admin
        .from('seasons')
        .select(SEASON_COLUMNS)
        .eq('title_id', titleId)
        .eq('season_number', seasonNumber)
        .maybeSingle(),
    );
    return row ? toSeasonWithEpisodes(row as unknown as Row) : null;
  }

  return {
    findTitle,
    findSeason,

    async saveTitle(input) {
      const now = new Date().toISOString();
      const saved = check(
        await admin
          .from('titles')
          .upsert(
            {
              tmdb_id: input.tmdbId,
              media_type: input.mediaType,
              original_title: input.originalTitle,
              translations: input.translations,
              poster_path: input.posterPath,
              backdrop_path: input.backdropPath,
              release_date: input.releaseDate,
              tmdb_status: input.tmdbStatus,
              number_of_seasons: input.numberOfSeasons,
              fetched_at: now,
              last_referenced_at: now,
            },
            { onConflict: 'tmdb_id,media_type' },
          )
          .select('id')
          .single(),
      ) as { id: number };

      if (input.seasons.length > 0) {
        check(
          await admin.from('seasons').upsert(
            input.seasons.map((s) => ({
              title_id: saved.id,
              season_number: s.seasonNumber,
              name: s.name,
              air_date: s.airDate,
              episode_count: s.episodeCount,
            })),
            { onConflict: 'title_id,season_number' },
          ),
        );
      }

      const reloaded = await findTitle(input.mediaType, input.tmdbId);
      if (!reloaded) throw new Error('catalog store: title vanished after upsert');
      return reloaded;
    },

    async touchTitle(titleId) {
      check(
        await admin
          .from('titles')
          .update({ last_referenced_at: new Date().toISOString() })
          .eq('id', titleId),
      );
    },

    async saveSeason(titleId, input) {
      const saved = check(
        await admin
          .from('seasons')
          .upsert(
            {
              title_id: titleId,
              season_number: input.seasonNumber,
              name: input.name,
              air_date: input.airDate,
              episode_count: input.episodeCount,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: 'title_id,season_number' },
          )
          .select('id')
          .single(),
      ) as { id: number };

      if (input.episodes.length > 0) {
        check(
          await admin.from('episodes').upsert(
            input.episodes.map((e) => ({
              season_id: saved.id,
              title_id: titleId,
              season_number: input.seasonNumber,
              episode_number: e.episodeNumber,
              name: e.name,
              air_date: e.airDate,
              runtime: e.runtime,
              fetched_at: new Date().toISOString(),
            })),
            { onConflict: 'season_id,episode_number' },
          ),
        );
      }

      const reloaded = await findSeason(titleId, input.seasonNumber);
      if (!reloaded) throw new Error('catalog store: season vanished after upsert');
      return reloaded;
    },
  };
}

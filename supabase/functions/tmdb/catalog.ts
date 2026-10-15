// Cache model + pure mapping between TMDB payloads, cached rows and the wire DTOs.
import type {
  CatalogLocale,
  Episode,
  MediaType,
  SeasonDetail,
  SearchResult,
  TitleDetail,
} from '../_shared/contracts/catalog.ts';

import type { RawMovie, RawSearchItem, RawSeason, RawTv } from './tmdb-client.ts';

export type Localized<T> = Partial<Record<CatalogLocale, T>>;

export interface SeasonRecord {
  id: number;
  seasonNumber: number;
  name: Localized<string>;
  airDate: string | null;
  episodeCount: number | null;
  fetchedAt: string;
}

export interface TitleRecord {
  id: number;
  tmdbId: number;
  mediaType: MediaType;
  originalTitle: string;
  translations: Localized<{ title: string; overview: string | null }>;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  tmdbStatus: string | null;
  numberOfSeasons: number | null;
  fetchedAt: string;
  seasons: SeasonRecord[];
}

export interface EpisodeRecord {
  id: number;
  episodeNumber: number;
  name: Localized<string>;
  airDate: string | null;
  runtime: number | null;
}

export interface SeasonWithEpisodes extends SeasonRecord {
  titleId: number;
  episodes: EpisodeRecord[];
}

/** What the store needs to write a title (ids are assigned by the database). */
export type TitleInput = Omit<TitleRecord, 'id' | 'fetchedAt' | 'seasons'> & {
  seasons: Omit<SeasonRecord, 'id' | 'fetchedAt'>[];
};
export type SeasonInput = Omit<SeasonRecord, 'id' | 'fetchedAt'> & {
  episodes: Omit<EpisodeRecord, 'id'>[];
};

/** Cached rows are refreshed after this long (status and air dates change). */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const isFresh = (fetchedAt: string, now: Date) =>
  now.getTime() - new Date(fetchedAt).getTime() < CACHE_TTL_MS;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_PATH = /^\/[A-Za-z0-9._-]+$/;
export const toDate = (value: string | null) => (value && ISO_DATE.test(value) ? value : null);
export const toImage = (value: string | null) => (value && IMAGE_PATH.test(value) ? value : null);
const toText = (value: string | null) => (value && value.trim() ? value.trim() : null);

/** Prefers the requested locale, then any other cached locale, then the original. */
function pick<T>(values: Localized<T>, locale: CatalogLocale): T | undefined {
  return values[locale] ?? Object.values(values).find((v) => v !== undefined);
}

export function toSearchResult(item: RawSearchItem): SearchResult {
  const isMovie = item.media_type === 'movie';
  const title = (isMovie ? item.title : item.name) ?? '';
  const originalTitle = (isMovie ? item.original_title : item.original_name) ?? title;
  return {
    tmdbId: item.id,
    mediaType: isMovie ? 'movie' : 'tv',
    title: title || originalTitle,
    originalTitle,
    overview: toText(item.overview),
    posterPath: toImage(item.poster_path),
    releaseDate: toDate(isMovie ? item.release_date : item.first_air_date),
  };
}

export function titleInputFromMovie(
  raw: RawMovie,
  locale: CatalogLocale,
  existing: TitleRecord | null,
): TitleInput {
  return {
    tmdbId: raw.id,
    mediaType: 'movie',
    originalTitle: raw.original_title || raw.title,
    translations: {
      ...existing?.translations,
      [locale]: { title: raw.title || raw.original_title, overview: toText(raw.overview) },
    },
    posterPath: toImage(raw.poster_path),
    backdropPath: toImage(raw.backdrop_path),
    releaseDate: toDate(raw.release_date),
    tmdbStatus: raw.status,
    numberOfSeasons: null,
    seasons: [],
  };
}

export function titleInputFromTv(
  raw: RawTv,
  locale: CatalogLocale,
  existing: TitleRecord | null,
): TitleInput {
  const previous = new Map(existing?.seasons.map((s) => [s.seasonNumber, s]));
  return {
    tmdbId: raw.id,
    mediaType: 'tv',
    originalTitle: raw.original_name || raw.name,
    translations: {
      ...existing?.translations,
      [locale]: { title: raw.name || raw.original_name, overview: toText(raw.overview) },
    },
    posterPath: toImage(raw.poster_path),
    backdropPath: toImage(raw.backdrop_path),
    releaseDate: toDate(raw.first_air_date),
    tmdbStatus: raw.status,
    numberOfSeasons: raw.number_of_seasons,
    seasons: raw.seasons.map((s) => ({
      seasonNumber: s.season_number,
      name: { ...previous.get(s.season_number)?.name, [locale]: s.name },
      airDate: toDate(s.air_date),
      episodeCount: s.episode_count,
    })),
  };
}

export function seasonInputFromTmdb(
  raw: RawSeason,
  locale: CatalogLocale,
  existing: SeasonWithEpisodes | null,
): SeasonInput {
  const previous = new Map(existing?.episodes.map((e) => [e.episodeNumber, e]));
  return {
    seasonNumber: raw.season_number,
    name: { ...existing?.name, [locale]: raw.name },
    airDate: toDate(raw.air_date),
    episodeCount: raw.episodes.length,
    episodes: raw.episodes.map((e) => ({
      episodeNumber: e.episode_number,
      name: { ...previous.get(e.episode_number)?.name, [locale]: e.name },
      airDate: toDate(e.air_date),
      runtime: e.runtime,
    })),
  };
}

export function toTitleDetail(record: TitleRecord, locale: CatalogLocale): TitleDetail {
  const text = pick(record.translations, locale);
  return {
    id: record.id,
    tmdbId: record.tmdbId,
    mediaType: record.mediaType,
    title: text?.title ?? record.originalTitle,
    originalTitle: record.originalTitle,
    overview: text?.overview ?? null,
    posterPath: record.posterPath,
    backdropPath: record.backdropPath,
    releaseDate: record.releaseDate,
    status: record.tmdbStatus,
    numberOfSeasons: record.numberOfSeasons,
    seasons: [...record.seasons]
      .sort((a, b) => a.seasonNumber - b.seasonNumber)
      .map((s) => ({
        seasonNumber: s.seasonNumber,
        name: pick(s.name, locale) ?? '',
        airDate: s.airDate,
        episodeCount: s.episodeCount,
      })),
  };
}

export function toSeasonDetail(
  season: SeasonWithEpisodes,
  tmdbId: number,
  locale: CatalogLocale,
): SeasonDetail {
  return {
    titleId: season.titleId,
    tmdbId,
    seasonNumber: season.seasonNumber,
    name: pick(season.name, locale) ?? '',
    airDate: season.airDate,
    episodes: [...season.episodes]
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
      .map((e): Episode => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        name: pick(e.name, locale) ?? '',
        airDate: e.airDate,
        runtime: e.runtime,
      })),
  };
}

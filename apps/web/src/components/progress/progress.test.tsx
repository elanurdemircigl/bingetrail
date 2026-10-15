import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { messages } from '@bingetrail/i18n';

import { CompletionPrompt } from './completion-prompt';
import { EpisodeList, type EpisodeRow } from './episode-list';

const actions = vi.hoisted(() => ({
  markEpisodesAction: vi.fn(),
  unmarkEpisodesAction: vi.fn(),
  updateWatchlistStatusAction: vi.fn(),
}));
vi.mock('@/lib/progress/actions', () => ({
  markEpisodesAction: actions.markEpisodesAction,
  unmarkEpisodesAction: actions.unmarkEpisodesAction,
}));
vi.mock('@/lib/watchlist/actions', () => ({
  updateWatchlistStatusAction: actions.updateWatchlistStatusAction,
}));

const tr = messages.tr;
const p = tr.progress;
const TODAY = '2026-10-16';

const episodes: EpisodeRow[] = [
  { id: 101, episodeNumber: 1, name: 'Bir', airDate: '2026-01-01', meta: '1 Oca 2026' },
  { id: 102, episodeNumber: 2, name: 'İki', airDate: '2026-01-08', meta: '8 Oca 2026' },
  { id: 103, episodeNumber: 3, name: 'Üç', airDate: '2026-01-15', meta: '15 Oca 2026' },
  { id: 104, episodeNumber: 4, name: 'Dört', airDate: '2026-12-01', meta: '1 Ara 2026' },
];

function renderTr(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const checkbox = (n: number) =>
  screen.getByRole<HTMLInputElement>('checkbox', {
    name: p.watchedLabel.replace('{number}', String(n)),
  });

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
});
afterEach(cleanup);

describe('EpisodeList', () => {
  it('shows progress over aired episodes and blocks unaired ones', () => {
    renderTr(<EpisodeList episodes={episodes} watchedIds={[101]} today={TODAY} />);
    expect(screen.getByText('Bu sezon: 1/3 bölüm izlendi')).toBeTruthy();
    expect(checkbox(1).checked).toBe(true);
    expect(checkbox(4).disabled).toBe(true);
    expect(screen.getByText(/Henüz yayınlanmadı/)).toBeTruthy();
    // No "up to here" on unaired episodes.
    expect(
      screen.queryByRole('button', { name: p.markUpToLabel.replace('{number}', '4') }),
    ).toBeNull();
  });

  it('marks the whole season in one call, skipping watched and unaired episodes', async () => {
    actions.markEpisodesAction.mockResolvedValue({ ok: true });
    renderTr(<EpisodeList episodes={episodes} watchedIds={[101]} today={TODAY} />);
    fireEvent.click(screen.getByRole('button', { name: p.markSeason }));
    await waitFor(() => expect(actions.markEpisodesAction).toHaveBeenCalledTimes(1));
    expect(actions.markEpisodesAction).toHaveBeenCalledWith({ episodeIds: [102, 103] });
  });

  it('"up to here" sends every earlier unwatched episode', async () => {
    actions.markEpisodesAction.mockResolvedValue({ ok: true });
    renderTr(<EpisodeList episodes={episodes} watchedIds={[]} today={TODAY} />);
    fireEvent.click(screen.getByRole('button', { name: p.markUpToLabel.replace('{number}', '3') }));
    await waitFor(() =>
      expect(actions.markEpisodesAction).toHaveBeenCalledWith({ episodeIds: [101, 102, 103] }),
    );
  });

  it('toggles optimistically and reverts with a message when the server refuses', async () => {
    let resolve: (value: unknown) => void = () => {};
    actions.markEpisodesAction.mockReturnValue(new Promise((r) => (resolve = r)));
    renderTr(<EpisodeList episodes={episodes} watchedIds={[]} today={TODAY} />);

    fireEvent.click(checkbox(2));
    await waitFor(() => expect(checkbox(2).checked).toBe(true));
    expect(screen.getByText('Bu sezon: 1/3 bölüm izlendi')).toBeTruthy();

    await act(async () => resolve({ ok: false, error: 'episode_not_aired' }));
    expect(await screen.findByText(p.errors.episode_not_aired)).toBeTruthy();
    expect(checkbox(2).checked).toBe(false);
  });

  it('unchecking removes the mark', async () => {
    actions.unmarkEpisodesAction.mockResolvedValue({ ok: true });
    renderTr(<EpisodeList episodes={episodes} watchedIds={[101, 102]} today={TODAY} />);
    fireEvent.click(checkbox(2));
    await waitFor(() =>
      expect(actions.unmarkEpisodesAction).toHaveBeenCalledWith({ episodeIds: [102] }),
    );
  });
});

describe('CompletionPrompt', () => {
  it('only changes the status when the user accepts', async () => {
    actions.updateWatchlistStatusAction.mockResolvedValue({ ok: true });
    renderTr(<CompletionPrompt itemId="item-1" />);
    expect(screen.getByText(p.completeSuggestion)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: p.completeYes }));
    await waitFor(() =>
      expect(actions.updateWatchlistStatusAction).toHaveBeenCalledWith({
        itemId: 'item-1',
        status: 'completed',
      }),
    );
  });

  it('can be dismissed without any change', () => {
    renderTr(<CompletionPrompt itemId="item-1" />);
    fireEvent.click(screen.getByRole('button', { name: p.completeDismiss }));
    expect(screen.queryByText(p.completeSuggestion)).toBeNull();
    expect(actions.updateWatchlistStatusAction).not.toHaveBeenCalled();
  });
});

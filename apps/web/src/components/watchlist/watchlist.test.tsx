import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { messages } from '@bingetrail/i18n';
import { NOTES_MAX_LENGTH } from '@bingetrail/shared';

import { DetailsForm } from './details-form';
import { RemoveButton } from './remove-button';
import { WatchlistControl } from './watchlist-control';

// Server Actions and locale-aware links are framework boundaries; stub them.
const actions = vi.hoisted(() => ({
  addToWatchlistAction: vi.fn(),
  updateWatchlistStatusAction: vi.fn(),
  updateWatchlistDetailsAction: vi.fn(),
  removeFromWatchlistAction: vi.fn(),
}));
vi.mock('@/lib/watchlist/actions', () => actions);
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const tr = messages.tr;
const ITEM_ID = '0b9f9a51-9d4e-4c2a-8f0e-1d2c3b4a5f60';

function renderTr(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
});
afterEach(cleanup);

describe('WatchlistControl', () => {
  it('adds the title with the chosen status', async () => {
    actions.addToWatchlistAction.mockResolvedValue({ ok: true });
    renderTr(<WatchlistControl titleId={7} title="Kuzey Kalesi" entry={null} />);
    expect(screen.getByText(tr.watchlist.notInList)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(tr.watchlist.statusLabel), {
      target: { value: 'watching' },
    });
    click(tr.watchlist.add);
    await waitFor(() =>
      expect(actions.addToWatchlistAction).toHaveBeenCalledWith({ titleId: 7, status: 'watching' }),
    );
  });

  it('shows the new status optimistically and reverts it when the server fails', async () => {
    let resolve: (value: unknown) => void = () => {};
    actions.updateWatchlistStatusAction.mockReturnValue(new Promise((r) => (resolve = r)));
    renderTr(
      <WatchlistControl
        titleId={7}
        title="Kuzey Kalesi"
        entry={{ id: ITEM_ID, status: 'planned', rating: null, notes: null }}
      />,
    );
    const select = () => screen.getByLabelText<HTMLSelectElement>(tr.watchlist.statusLabel);

    fireEvent.change(select(), { target: { value: 'completed' } });
    await waitFor(() => expect(select().value).toBe('completed'));
    expect(actions.updateWatchlistStatusAction).toHaveBeenCalledWith({
      itemId: ITEM_ID,
      status: 'completed',
    });

    await act(async () => resolve({ ok: false, error: 'not_found' }));
    expect(await screen.findByText(tr.watchlist.errors.not_found)).toBeTruthy();
    expect(select().value).toBe('planned');
  });
});

describe('DetailsForm', () => {
  it('saves rating and notes; blank notes become null', async () => {
    actions.updateWatchlistDetailsAction.mockResolvedValue({ ok: true });
    renderTr(<DetailsForm itemId={ITEM_ID} rating={null} notes="eski not" />);

    fireEvent.change(screen.getByLabelText(tr.watchlist.rating), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText(tr.watchlist.notes), { target: { value: '   ' } });
    click(tr.watchlist.save);

    await waitFor(() =>
      expect(actions.updateWatchlistDetailsAction).toHaveBeenCalledWith({
        itemId: ITEM_ID,
        rating: 9,
        notes: null,
      }),
    );
    expect(await screen.findByText(tr.watchlist.saved)).toBeTruthy();
  });

  it('can clear the rating', async () => {
    actions.updateWatchlistDetailsAction.mockResolvedValue({ ok: true });
    renderTr(<DetailsForm itemId={ITEM_ID} rating={6} notes={null} />);
    fireEvent.change(screen.getByLabelText(tr.watchlist.rating), { target: { value: '' } });
    click(tr.watchlist.save);
    await waitFor(() =>
      expect(actions.updateWatchlistDetailsAction).toHaveBeenCalledWith({
        itemId: ITEM_ID,
        rating: null,
        notes: null,
      }),
    );
  });

  it('counts characters and blocks notes over the limit', async () => {
    renderTr(<DetailsForm itemId={ITEM_ID} rating={null} notes={null} />);
    fireEvent.change(screen.getByLabelText(tr.watchlist.notes), {
      target: { value: 'x'.repeat(NOTES_MAX_LENGTH + 1) },
    });
    expect(screen.getByText(`${NOTES_MAX_LENGTH + 1} / ${NOTES_MAX_LENGTH}`)).toBeTruthy();
    click(tr.watchlist.save);
    expect(await screen.findByText(tr.validation.notesTooLong)).toBeTruthy();
    expect(actions.updateWatchlistDetailsAction).not.toHaveBeenCalled();
  });

  it('renders markup in notes as plain text', () => {
    const { container } = renderTr(
      <DetailsForm itemId={ITEM_ID} rating={null} notes={'<img src=x onerror="alert(1)">'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByLabelText<HTMLTextAreaElement>(tr.watchlist.notes).value).toContain('<img');
  });
});

describe('RemoveButton', () => {
  it('asks for confirmation before removing', async () => {
    actions.removeFromWatchlistAction.mockResolvedValue({ ok: true });
    renderTr(<RemoveButton itemId={ITEM_ID} title="Kuzey Kalesi" />);

    click(tr.watchlist.remove);
    expect(actions.removeFromWatchlistAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Kuzey Kalesi/)).toBeTruthy();

    click(tr.watchlist.removeCancel);
    expect(screen.queryByRole('button', { name: tr.watchlist.removeYes })).toBeNull();

    click(tr.watchlist.remove);
    click(tr.watchlist.removeYes);
    await waitFor(() =>
      expect(actions.removeFromWatchlistAction).toHaveBeenCalledWith({ itemId: ITEM_ID }),
    );
  });
});

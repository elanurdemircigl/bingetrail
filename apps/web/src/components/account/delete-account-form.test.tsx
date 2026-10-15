import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { messages } from '@bingetrail/i18n';

import { DeleteAccountForm } from './delete-account-form';

const actions = vi.hoisted(() => ({ deleteAccountAction: vi.fn() }));
vi.mock('@/lib/account/actions', () => actions);
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const tr = messages.tr;

function renderTr(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => actions.deleteAccountAction.mockReset());
afterEach(cleanup);

describe('DeleteAccountForm', () => {
  const d = tr.account.delete;

  it('requires the password and the explicit acknowledgement', async () => {
    renderTr(<DeleteAccountForm />);
    click(d.submit);
    expect(await screen.findByText(tr.validation.required)).toBeTruthy();
    expect(screen.getByText(tr.validation.confirmRequired)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(d.password), { target: { value: 'binge2026' } });
    click(d.submit);
    expect(await screen.findByText(tr.validation.confirmRequired)).toBeTruthy();
    expect(actions.deleteAccountAction).not.toHaveBeenCalled();
  });

  it('submits once confirmed and shows a wrong-password error', async () => {
    actions.deleteAccountAction.mockResolvedValue({ ok: false, error: 'reauth_failed' });
    renderTr(<DeleteAccountForm />);
    fireEvent.change(screen.getByLabelText(d.password), { target: { value: 'wrong-one1' } });
    fireEvent.click(screen.getByLabelText(d.confirm));
    click(d.submit);

    await waitFor(() =>
      expect(actions.deleteAccountAction).toHaveBeenCalledWith({
        password: 'wrong-one1',
        confirm: true,
      }),
    );
    expect(await screen.findByText(d.errors.reauth_failed)).toBeTruthy();
  });
});

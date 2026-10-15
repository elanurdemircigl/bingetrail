import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { messages } from '@bingetrail/i18n';

import { LoginForm } from './login-form';
import { SignUpForm } from './signup-form';

// Server Actions and locale-aware links are framework boundaries; stub them.
const actions = vi.hoisted(() => ({
  signInAction: vi.fn(),
  signUpAction: vi.fn(),
}));
vi.mock('@/lib/auth/actions', () => actions);
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

const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const submit = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  actions.signInAction.mockReset();
  actions.signUpAction.mockReset();
});
afterEach(cleanup);

describe('LoginForm', () => {
  it('shows translated validation errors and does not call the server', async () => {
    renderTr(<LoginForm />);
    submit(tr.auth.login.submit);

    // Both empty fields report "required" (not "invalid email").
    expect(await screen.findAllByText(tr.validation.required)).toHaveLength(2);
    expect(field(tr.auth.login.email).getAttribute('aria-invalid')).toBe('true');

    type(tr.auth.login.email, 'not-an-email');
    submit(tr.auth.login.submit);
    expect(await screen.findByText(tr.validation.emailInvalid)).toBeTruthy();
    expect(actions.signInAction).not.toHaveBeenCalled();
  });

  it('sends the normalized email and the next path to the Server Action', async () => {
    actions.signInAction.mockResolvedValue(undefined);
    renderTr(<LoginForm next="/tr/list" />);
    type(tr.auth.login.email, '  Ayse@Example.com ');
    type(tr.auth.login.password, 'binge2026');
    submit(tr.auth.login.submit);

    await waitFor(() =>
      expect(actions.signInAction).toHaveBeenCalledWith(
        { email: 'ayse@example.com', password: 'binge2026' },
        '/tr/list',
      ),
    );
  });

  it('shows one generic message for any failed sign-in', async () => {
    actions.signInAction.mockResolvedValue({ ok: false, error: 'invalidCredentials' });
    renderTr(<LoginForm />);
    type(tr.auth.login.email, 'ayse@example.com');
    type(tr.auth.login.password, 'wrong-password');
    submit(tr.auth.login.submit);

    expect((await screen.findByRole('alert')).textContent).toBe(tr.errors.invalidCredentials);
  });

  it('uses POST so a pre-hydration submit can never put the password in the URL', () => {
    const { container } = renderTr(<LoginForm />);
    expect(container.querySelector('form')?.getAttribute('method')).toBe('post');
  });

  it('shows the invalid-link message passed by the confirm route', () => {
    renderTr(<LoginForm initialError="linkInvalid" />);
    expect(screen.getByRole('alert').textContent).toBe(tr.errors.linkInvalid);
  });
});

describe('SignUpForm', () => {
  it('enforces the password policy before contacting the server', async () => {
    renderTr(<SignUpForm />);
    type(tr.auth.signup.email, 'ayse@example.com');
    type(tr.auth.signup.password, 'onlyletters');
    type(tr.auth.signup.confirmPassword, 'different');
    submit(tr.auth.signup.submit);

    expect(await screen.findByText(tr.validation.passwordNeedsDigit)).toBeTruthy();
    expect(screen.getByText(tr.validation.passwordsDontMatch)).toBeTruthy();
    expect(actions.signUpAction).not.toHaveBeenCalled();
  });

  it('submits valid input', async () => {
    actions.signUpAction.mockResolvedValue(undefined);
    renderTr(<SignUpForm />);
    type(tr.auth.signup.email, 'ayse@example.com');
    type(tr.auth.signup.password, 'binge2026');
    type(tr.auth.signup.confirmPassword, 'binge2026');
    submit(tr.auth.signup.submit);

    await waitFor(() =>
      expect(actions.signUpAction).toHaveBeenCalledWith({
        email: 'ayse@example.com',
        password: 'binge2026',
        confirmPassword: 'binge2026',
      }),
    );
  });

  it('tells the user when the address is already registered', async () => {
    actions.signUpAction.mockResolvedValue({ ok: false, error: 'emailTaken' });
    renderTr(<SignUpForm />);
    type(tr.auth.signup.email, 'ayse@example.com');
    type(tr.auth.signup.password, 'binge2026');
    type(tr.auth.signup.confirmPassword, 'binge2026');
    submit(tr.auth.signup.submit);

    expect(await screen.findByText(tr.errors.emailTaken)).toBeTruthy();
  });
});

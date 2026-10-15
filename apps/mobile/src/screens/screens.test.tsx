import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { messages } from '@bingetrail/i18n';

import { initI18n, i18n } from '@/lib/i18n';

import { DeleteAccountScreen } from './app-screens';
import { LoginScreen, SignUpScreen } from './auth-screens';
import { ResetPasswordScreen } from './reset-password-screen';

const tr = messages.tr;

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockSearchParams,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

jest.mock('@/lib/auth/actions', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  requestPasswordReset: jest.fn(),
  exchangeRecoveryCode: jest.fn(),
  verifyRecoveryCode: jest.fn(),
  updatePassword: jest.fn(),
  signOut: jest.fn(),
}));
// The factory runs before this module's own code, so read the mocks back from it.
type AuthMocks = Record<
  | 'signIn'
  | 'signUp'
  | 'requestPasswordReset'
  | 'exchangeRecoveryCode'
  | 'verifyRecoveryCode'
  | 'updatePassword'
  | 'signOut',
  jest.Mock
>;
const mockAuth = jest.requireMock<AuthMocks>('@/lib/auth/actions');

const mockDeleteAccount = jest.fn();
jest.mock('@bingetrail/api-client', () => {
  const actual = jest.requireActual('@bingetrail/api-client');
  return { ...actual, deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args) };
});

function renderScreen(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeAll(async () => {
  initI18n('tr');
  await i18n.changeLanguage('tr');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = {};
});

const press = (label: string) => fireEvent.press(screen.getByRole('button', { name: label }));
const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

describe('LoginScreen', () => {
  it('validates with the shared schema before calling the server', async () => {
    renderScreen(<LoginScreen />);
    press(tr.auth.login.submit);
    expect(await screen.findAllByText(tr.validation.required)).toHaveLength(2);
    expect(mockAuth.signIn).not.toHaveBeenCalled();
  });

  it('shows one generic message for a failed sign-in', async () => {
    mockAuth.signIn.mockResolvedValue({ ok: false, error: 'invalidCredentials' });
    renderScreen(<LoginScreen />);
    type(tr.auth.login.email, 'Ayse@Example.com');
    type(tr.auth.login.password, 'wrong-pass1');
    press(tr.auth.login.submit);
    expect(await screen.findByText(tr.errors.invalidCredentials)).toBeTruthy();
    expect(mockAuth.signIn).toHaveBeenCalledWith({
      email: 'ayse@example.com',
      password: 'wrong-pass1',
    });
  });
});

describe('SignUpScreen', () => {
  it('enforces the password policy and reports a registered address', async () => {
    renderScreen(<SignUpScreen />);
    type(tr.auth.signup.email, 'ayse@example.com');
    type(tr.auth.signup.password, 'onlyletters');
    type(tr.auth.signup.confirmPassword, 'onlyletters');
    press(tr.auth.signup.submit);
    expect(await screen.findByText(tr.validation.passwordNeedsDigit)).toBeTruthy();
    expect(mockAuth.signUp).not.toHaveBeenCalled();

    mockAuth.signUp.mockResolvedValue({ ok: false, error: 'emailTaken' });
    type(tr.auth.signup.password, 'binge2026');
    type(tr.auth.signup.confirmPassword, 'binge2026');
    press(tr.auth.signup.submit);
    expect(await screen.findByText(tr.errors.emailTaken)).toBeTruthy();
    expect(mockAuth.signUp).toHaveBeenCalledWith(
      { email: 'ayse@example.com', password: 'binge2026', confirmPassword: 'binge2026' },
      'tr',
    );
  });
});

describe('ResetPasswordScreen', () => {
  it('shows the new-password form only after the emailed code is verified', async () => {
    mockSearchParams = { email: 'ayse@example.com' };
    mockAuth.verifyRecoveryCode.mockResolvedValue({ ok: true });
    renderScreen(<ResetPasswordScreen />);
    expect(screen.queryByLabelText(tr.auth.reset.password)).toBeNull();

    type(tr.auth.reset.code, '12');
    press(tr.auth.reset.verify);
    expect(await screen.findByText(tr.auth.reset.codeInvalid)).toBeTruthy();
    expect(mockAuth.verifyRecoveryCode).not.toHaveBeenCalled();

    type(tr.auth.reset.code, '123456');
    press(tr.auth.reset.verify);
    expect(await screen.findByLabelText(tr.auth.reset.password)).toBeTruthy();
    expect(mockAuth.verifyRecoveryCode).toHaveBeenCalledWith('ayse@example.com', '123456');
  });

  it('exchanges a deep-link code exactly once', async () => {
    mockSearchParams = { code: 'pkce-code-123456' };
    mockAuth.exchangeRecoveryCode.mockResolvedValue({ ok: true });
    renderScreen(<ResetPasswordScreen />);
    expect(await screen.findByLabelText(tr.auth.reset.password)).toBeTruthy();
    expect(mockAuth.exchangeRecoveryCode).toHaveBeenCalledTimes(1);
  });

  it('falls back to the code form when the link is invalid', async () => {
    mockSearchParams = { code: 'expired-code-1' };
    mockAuth.exchangeRecoveryCode.mockResolvedValue({ ok: false, error: 'linkInvalid' });
    renderScreen(<ResetPasswordScreen />);
    expect(await screen.findByText(tr.errors.linkInvalid)).toBeTruthy();
    expect(screen.getByLabelText(tr.auth.reset.code)).toBeTruthy();
  });
});

describe('DeleteAccountScreen', () => {
  const d = tr.account.delete;

  it('lists what is deleted and requires password + acknowledgement', async () => {
    renderScreen(<DeleteAccountScreen />);
    expect(screen.getByText(d.irreversible)).toBeTruthy();
    press(d.submit);
    expect(await screen.findByText(tr.validation.required)).toBeTruthy();
    expect(screen.getByText(tr.validation.confirmRequired)).toBeTruthy();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('reports a wrong password and keeps the user on the screen', async () => {
    const { AccountError } = jest.requireActual('@bingetrail/api-client');
    mockDeleteAccount.mockRejectedValue(new AccountError('reauth_failed'));
    renderScreen(<DeleteAccountScreen />);
    type(d.password, 'wrong-pass1');
    fireEvent(screen.getByLabelText(d.confirm), 'valueChange', true);
    press(d.submit);
    expect(await screen.findByText(d.errors.reauth_failed)).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('signs out locally and leaves after a successful deletion', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    renderScreen(<DeleteAccountScreen />);
    type(d.password, 'binge2026');
    fireEvent(screen.getByLabelText(d.confirm), 'valueChange', true);
    press(d.submit);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/account-deleted'));
    expect(mockDeleteAccount).toHaveBeenCalledWith(expect.anything(), 'binge2026');
  });
});

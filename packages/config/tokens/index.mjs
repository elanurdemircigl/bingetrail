/**
 * Design tokens shared by web (Tailwind 4 via @config) and mobile
 * (NativeWind / Tailwind 3). Only plain values live here — no framework code.
 */
export const colors = {
  brand: {
    50: '#fff1f2',
    100: '#ffe4e6',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
  },
  surface: {
    DEFAULT: '#0b0b10',
    raised: '#16161f',
    muted: '#22222e',
  },
  ink: {
    DEFAULT: '#f5f5f7',
    muted: '#a1a1aa',
  },
};

export const borderRadius = {
  card: '0.75rem',
};

export const tokens = { colors, borderRadius };

export default tokens;

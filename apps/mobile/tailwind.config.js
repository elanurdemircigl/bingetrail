// NativeWind 4 runs on Tailwind 3; tokens are shared with web via @bingetrail/config.
// The token module is ESM; Node 24 supports require() of synchronous ESM.
const { tokens } = require('@bingetrail/config/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.borderRadius,
    },
  },
};

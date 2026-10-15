// global.css is processed by NativeWind's Metro transformer; it has no exports.
declare module '*.css';

// Jest mock shipped by NetInfo without type declarations (used in jest.setup.ts).
declare module '@react-native-community/netinfo/jest/netinfo-mock.js';

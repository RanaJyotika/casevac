/* eslint-env jest */
/**
 * Global Jest setup.
 * The native camera cannot run under Jest; replace it with a plain View that
 * keeps its props, so tests can trigger onReadCode as if a code was scanned.
 */
jest.mock('react-native-camera-kit', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Camera: props =>
      mockReact.createElement(View, { ...props, testID: 'qr-camera' }),
  };
});

/* Tablet storage: in-memory AsyncStorage. */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/*
 * No network in tests: the dashboard server is "unreachable" unless a test
 * injects its own ServerClient. Individual tests may override global.fetch.
 */
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.reject(new TypeError('Network request failed')),
  );
});

/* Native date/time pickers: tests drive them through DateTimePickerAndroid.open. */
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

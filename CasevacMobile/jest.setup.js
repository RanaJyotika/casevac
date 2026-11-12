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

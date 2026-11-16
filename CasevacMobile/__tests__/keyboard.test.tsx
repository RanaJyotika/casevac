/**
 * The on-screen keyboard must not hide the field being typed in (vitals HR,
 * RR, BP, SpO₂, Temp sit low on the assessment form). The app draws
 * edge-to-edge, so Android does not resize the window for the keyboard —
 * KeyboardAwareScrollView adds room and scrolls the field into view.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  DeviceEventEmitter,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { scrollDeltaToReveal } from '../src/components/KeyboardAwareScrollView';
import { AssessmentScreen } from '../src/screens/AssessmentScreen';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

describe('scrollDeltaToReveal', () => {
  // Landscape tablet: scroll area from y=120 to y=800, keyboard from y=420.
  const area = { areaTop: 120, areaBottom: 800, keyboardTop: 420, margin: 24 };

  it('scrolls a field hidden behind the keyboard up to just above it', () => {
    // HR field at y=600–656: behind the keyboard (visible bottom = 396).
    expect(
      scrollDeltaToReveal({ ...area, fieldTop: 600, fieldBottom: 656 }),
    ).toBe(656 - 396);
  });

  it('leaves a field that is already visible where it is', () => {
    expect(
      scrollDeltaToReveal({ ...area, fieldTop: 200, fieldBottom: 256 }),
    ).toBe(0);
  });

  it('scrolls back down to a field above the visible part', () => {
    expect(
      scrollDeltaToReveal({ ...area, fieldTop: 60, fieldBottom: 116 }),
    ).toBe(60 - 144);
  });

  it('never pushes the top of a tall field off the top', () => {
    // A multi-line field taller than the space above the keyboard.
    expect(
      scrollDeltaToReveal({ ...area, fieldTop: 300, fieldBottom: 700 }),
    ).toBe(300 - 144);
  });
});

test('on the assessment form, the keyboard opening adds room to scroll the vitals above it', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <AssessmentScreen
        patient={{
          name: 'Test Soldier',
          idLabel: 'Patient ID',
          id: 'PAT-00042',
          bloodGroup: 'O',
          rhFactor: 'POSITIVE',
          keys: ['PAT-00042'],
        }}
        recordedBy="MED-DEMO-01"
        onCancel={() => {}}
        onSaved={() => {}}
      />,
    );
  });
  const bottomPadding = () =>
    StyleSheet.flatten(
      tree.root.findByType(ScrollView).props.contentContainerStyle,
    ).paddingBottom;
  const before = bottomPadding();

  const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
  await ReactTestRenderer.act(async () => {
    DeviceEventEmitter.emit(show, {
      endCoordinates: { screenX: 0, screenY: 420, width: 1280, height: 380 },
    });
  });
  expect(bottomPadding()).toBe(380 + 24);

  await ReactTestRenderer.act(async () => {
    DeviceEventEmitter.emit(hide, {
      endCoordinates: { screenX: 0, screenY: 800, width: 1280, height: 0 },
    });
  });
  expect(bottomPadding()).toBe(before);
  await ReactTestRenderer.act(async () => tree.unmount());
});

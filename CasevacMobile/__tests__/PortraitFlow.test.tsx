/**
 * Portrait tablet (800 × 1280 dp): login and Home adapt instead of assuming
 * landscape. Landscape is covered by HomeFlow / LoginFlow at 1280 × 800.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 800, height: 1280, scale: 2, fontScale: 1 }),
}));

type Renderer = ReactTestRenderer.ReactTestRenderer;

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(() => resolve(), ms));

function allText(tree: Renderer): string {
  return tree.root
    .findAllByType(Text)
    .map(node => {
      const children = node.props.children;
      return Array.isArray(children) ? children.join('') : String(children);
    })
    .join(' | ');
}

function find(tree: Renderer, label: string) {
  return tree.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      (typeof node.props.onPress === 'function' ||
        typeof node.props.onChangeText === 'function'),
  );
}

async function openHome(): Promise<Renderer> {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(async () => {
    find(tree, 'User ID').props.onChangeText('MED-DEMO-01');
    find(tree, 'Password').props.onChangeText('1234');
  });
  await ReactTestRenderer.act(async () => {
    find(tree, 'Login').props.onPress();
    await wait(500);
  });
  await ReactTestRenderer.act(async () => {
    await wait(20);
  });
  return tree;
}

test('login works in portrait', async () => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const text = allText(tree);
  expect(text).toContain('Medic Login');
  expect(text).toContain('Emergency Record');
});

test('Home in portrait keeps all first actions and puts alerts near the top', async () => {
  const tree = await openHome();
  const text = allText(tree);

  // No patients open: no patient strip or panel at all.
  expect(text).not.toContain('PATIENTS');
  expect(
    tree.root.findAll(n => n.props.accessibilityLabel === 'New patient tab'),
  ).toHaveLength(0);

  // Every first action is still there.
  expect(find(tree, 'Scan patient tag')).toBeDefined();
  expect(find(tree, 'Patient or casualty ID')).toBeDefined();
  expect(find(tree, 'Register casualty')).toBeDefined();

  // Single column: actions, alerts, active evacuations, snapshot, records.
  const at = (x: string) => text.indexOf(x);
  expect(at('Pending Handovers & Alerts')).toBeGreaterThan(
    at('Register New Casualty'),
  );
  expect(at('Continue Active Evacuations')).toBeGreaterThan(
    at('Pending Handovers & Alerts'),
  );
  expect(at('Operational Snapshot')).toBeGreaterThan(
    at('Continue Active Evacuations'),
  );
  expect(at('My Recent Records')).toBeGreaterThan(at('Operational Snapshot'));
  // Top bar drops secondary text when narrow
  // No records on this tablet yet: nothing queued, no demo casualties.
  expect(text).toContain('Offline');
  expect(text).not.toContain('queued');
  expect(text).toContain('No active evacuations');
  expect(text).not.toContain('Not synced yet');
});

test('portrait: with two patients open, the navy patient strip sits under the top bar', async () => {
  const tree = await openHome();
  const press = async (label: string) =>
    ReactTestRenderer.act(async () => {
      await find(tree, label).props.onPress();
      await wait(30);
    });
  /** An unidentified casualty, evacuated from Home, then back to Home. */
  const startOne = async () => {
    await press('Register casualty');
    await press('Save & Continue');
    await press('Start Evacuation');
  };
  await startOne();
  // One patient: still no strip.
  expect(
    tree.root.findAll(n => n.props.accessibilityLabel === 'New patient tab'),
  ).toHaveLength(0);
  await press('Back');
  await press('Back');
  await startOne();

  const text = allText(tree);
  expect(text).not.toContain('PATIENTS'); // no side panel in portrait
  expect(find(tree, 'New patient tab')).toBeDefined();
  // Strip directly under this screen's top bar, above the screen content.
  const header = text.indexOf('Initial Casualty Assessment');
  const strip = text.indexOf('Patient 1');
  expect(strip).toBeGreaterThan(header);
  expect(text.indexOf('Patient 2')).toBeGreaterThan(header);
  expect(strip).toBeLessThan(
    text.indexOf('Is the casualty conscious and able to provide details?'),
  );
});

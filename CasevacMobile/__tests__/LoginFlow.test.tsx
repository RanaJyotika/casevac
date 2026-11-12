/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';

// SafeAreaProvider renders nothing until it measures the screen; use the
// library's own Jest mock so the screens render in tests.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

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

function findButton(tree: Renderer, label: string) {
  return tree.root.find(
    node =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
}

function findInput(tree: Renderer, label: string) {
  return tree.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onChangeText === 'function',
  );
}

async function signIn(tree: Renderer, id: string, pin: string) {
  const idInput = findInput(tree, 'Clinician ID');
  const pinInput = findInput(tree, 'PIN');
  await ReactTestRenderer.act(async () => {
    idInput.props.onChangeText(id);
    pinInput.props.onChangeText(pin);
  });
  await ReactTestRenderer.act(async () => {
    findButton(tree, 'Sign in').props.onPress();
    await wait(500);
  });
}

async function renderApp(): Promise<Renderer> {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  return tree;
}

test('shows the login screen with demo-mode warning', async () => {
  const tree = await renderApp();
  const text = allText(tree);
  expect(text).toContain('Medic Sign In');
  expect(text).toContain('DEMO MODE');
});

test('validates empty fields without signing in', async () => {
  const tree = await renderApp();
  await ReactTestRenderer.act(async () => {
    findButton(tree, 'Sign in').props.onPress();
  });
  const text = allText(tree);
  expect(text).toContain('Enter your clinician ID.');
  expect(text).toContain('Enter your PIN.');
  expect(text).not.toContain('Medic Dashboard');
});

test('rejects unknown credentials', async () => {
  const tree = await renderApp();
  await signIn(tree, 'MED-OTHER-99', '9999');
  const text = allText(tree);
  expect(text).toContain('SIGN-IN FAILED');
  expect(text).not.toContain('Medic Dashboard');
});

test('demo account opens the Home screen', async () => {
  const tree = await renderApp();
  await signIn(tree, 'med-demo-01', '1234');
  const text = allText(tree);
  expect(text).toContain('Medic Dashboard');
  expect(text).toContain('Scan Patient QR');
  expect(text).toContain('EVAC-DEMO-001');
  expect(text).toContain('Transfer pending');
});

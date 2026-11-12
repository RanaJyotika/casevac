/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
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

async function signIn(tree: Renderer, id: string, password: string) {
  const idInput = findInput(tree, 'User ID');
  const passwordInput = findInput(tree, 'Password');
  await ReactTestRenderer.act(async () => {
    idInput.props.onChangeText(id);
    passwordInput.props.onChangeText(password);
  });
  await ReactTestRenderer.act(async () => {
    findButton(tree, 'Login').props.onPress();
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

test('shows the Jeevan login screen with only the expected controls', async () => {
  const tree = await renderApp();
  const text = allText(tree);
  expect(text).toContain('JEEVAN');
  expect(text).toContain('Medic Login');
  expect(text).toContain('Forgot Password?');
  expect(text).toContain('Demo mode');
  expect(findInput(tree, 'User ID')).toBeDefined();
  expect(findInput(tree, 'Password').props.secureTextEntry).toBe(true);
  expect(findButton(tree, 'Login')).toBeDefined();
});

test('validates empty fields without signing in', async () => {
  const tree = await renderApp();
  await ReactTestRenderer.act(async () => {
    findButton(tree, 'Login').props.onPress();
  });
  const text = allText(tree);
  expect(text).toContain('Enter your user ID.');
  expect(text).toContain('Enter your password.');
  expect(text).not.toContain('CASUALTY OVERVIEW');
});

test('rejects unknown credentials', async () => {
  const tree = await renderApp();
  await signIn(tree, 'MED-OTHER-99', 'wrong-password');
  const text = allText(tree);
  expect(text).toContain('LOGIN FAILED');
  expect(text).toContain('User ID or password not recognised.');
  expect(text).not.toContain('CASUALTY OVERVIEW');
});

test('shows and hides the password', async () => {
  const tree = await renderApp();
  await ReactTestRenderer.act(async () => {
    findButton(tree, 'Show password').props.onPress();
  });
  expect(findInput(tree, 'Password').props.secureTextEntry).toBe(false);
  await ReactTestRenderer.act(async () => {
    findButton(tree, 'Hide password').props.onPress();
  });
  expect(findInput(tree, 'Password').props.secureTextEntry).toBe(true);
});

test('Forgot Password only explains that reset is not available yet', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await renderApp();
  await ReactTestRenderer.act(async () => {
    findButton(tree, 'Forgot Password?').props.onPress();
  });
  expect(alertSpy).toHaveBeenCalledWith(
    'Forgot password',
    expect.stringContaining('not available yet'),
  );
  expect(allText(tree)).toContain('Medic Login');
  alertSpy.mockRestore();
});

test('demo account opens the Home screen', async () => {
  const tree = await renderApp();
  await signIn(tree, 'med-demo-01', '1234');
  const text = allText(tree);
  expect(text).toContain('CASUALTY OVERVIEW');
  expect(text).toContain('Scan Patient QR');
  expect(text).toContain('Cpl. R. Demo · Team A');
});

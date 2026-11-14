/* eslint-disable no-bitwise -- test-side base64url encoder */
/**
 * Scan → verify → Patient Identification UI flow, with the native camera
 * replaced by a test double that lets the test "read" a code.
 * Provisioning files are replaced by the shared TEST-ONLY vector key
 * (seed bytes 0x01..0x20, never trusted by the real app).
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { PermissionsAndroid, Platform, Text } from 'react-native';
import { ed25519 } from '@noble/curves/ed25519.js';
import App from '../App';
import { asciiBytes } from '../src/services/qr/base64url';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// react-native-camera-kit is mocked globally in jest.setup.js.

jest.mock('../src/provisioning/trusted-issuer-keys.json', () => ({
  format: 'casevac.trusted-issuer-keys',
  formatVersion: 1,
  keys: [
    {
      keyId: 'test-vector-01',
      issuer: 'CASEVAC_ADMIN',
      algorithm: 'Ed25519',
      publicKey: 'ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ',
    },
  ],
}));

jest.mock('../src/provisioning/demo-identity-directory.json', () => ({
  format: 'casevac.identity-directory',
  formatVersion: 2,
  generatedAt: '2026-11-12T09:00:00.000Z',
  patients: [
    {
      patientId: '22222222-2222-4222-8222-222222222222',
      displayId: 'PAT-00042',
      fullName: 'Test Soldier',
      rank: 'Sepoy',
      unit: '9 Demo Rifles',
      bloodGroup: 'O',
      rhFactor: 'POSITIVE',
    },
  ],
  credentials: [
    {
      credentialId: '11111111-1111-4111-8111-111111111111',
      patientId: '22222222-2222-4222-8222-222222222222',
      keyId: 'test-vector-01',
      credentialVersion: 1,
      status: 'ACTIVE',
      issuedAt: '2026-11-12T08:00:00.000Z',
      revokedAt: null,
    },
  ],
}));

const VALID =
  'CASEVAC:2:P:test-vector-01:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:1:1794470400:aV01UJYw8WEfoOZxVKcXPHXRsav66hFZepc9-O4fVOfNkye5NJ5xHKR1vJNFglteku3Qtw_dySOEBwAtwqS6DQ';

/** Signs a credential with the TEST-ONLY seed (as the dashboard would). */
function signTestCredential(message: string): string {
  const seed = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  const sig = ed25519.sign(asciiBytes(message), seed);
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of sig) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += alphabet[(buffer >> bits) & 63];
    }
  }
  out += alphabet[(buffer << (6 - bits)) & 63];
  return `${message}:${out}`;
}

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

function press(tree: Renderer, label: string) {
  const button = tree.root.find(
    node =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
  return ReactTestRenderer.act(async () => {
    button.props.onPress();
    await wait(10);
  });
}

function camera(tree: Renderer) {
  return tree.root.findAll(
    node => node.props.testID === 'qr-camera' && node.props.onReadCode,
  )[0];
}

async function read(tree: Renderer, value: string) {
  await ReactTestRenderer.act(async () => {
    camera(tree).props.onReadCode({
      nativeEvent: { codeStringValue: value, codeFormat: 'qr' },
    });
    await wait(50);
  });
}

async function openScanner(): Promise<Renderer> {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const fields = (label: string) =>
    tree.root.find(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onChangeText === 'function',
    );
  await ReactTestRenderer.act(async () => {
    fields('User ID').props.onChangeText('MED-DEMO-01');
    fields('Password').props.onChangeText('1234');
  });
  await ReactTestRenderer.act(async () => {
    await press(tree, 'Login');
    await wait(500);
  });
  await press(tree, 'Scan patient tag');
  await ReactTestRenderer.act(async () => {
    await wait(20);
  });
  return tree;
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('rejects a foreign QR, then identifies a genuine dashboard credential', async () => {
  const tree = await openScanner();
  expect(allText(tree)).toContain('Point the camera at the wristband QR code.');
  expect(allText(tree)).toContain('test-vector-01');

  await read(tree, 'https://example.com/menu');
  let text = allText(tree);
  expect(text).toContain('Unrecognised QR code');
  expect(text).not.toContain('Patient Identification');
  expect(camera(tree)).toBeUndefined();

  await press(tree, 'Scan again');
  expect(camera(tree)).toBeDefined();
  await read(tree, VALID);
  text = allText(tree);
  expect(text).toContain('Patient Identification');
  expect(text).toContain('Credential verified');
  expect(text).toContain('Identity found on this tablet');
  expect(text).toContain('PAT-00042');
  expect(text).toContain('Test Soldier');
  expect(text).toContain('Sepoy');
  expect(text).toContain('O · Rh positive');
  expect(text).toContain('PREVIOUS HISTORY');
  expect(text).toContain('No previous record found');
  // Signature / revocation internals are no longer shown on screen 3.
  expect(text).not.toContain('Revocation check');

  // Back returns to Home (the scan screen was replaced, not stacked).
  await press(tree, 'Back');
  expect(allText(tree)).toContain('Operational Snapshot');
});

test('rejects a tampered credential and ignores the same code right after Scan again', async () => {
  const tree = await openScanner();
  const tampered = VALID.replace(':1:1794470400:', ':2:1794470400:');
  await read(tree, tampered);
  expect(allText(tree)).toContain('Invalid QR signature');

  await press(tree, 'Scan again');
  await read(tree, tampered); // still in view: suppressed during the cooldown
  const text = allText(tree);
  expect(text).not.toContain('Invalid QR signature');
  expect(text).toContain('Point the camera at the wristband QR code.');
});

test('shows a verified credential without inventing details when it is not provisioned', async () => {
  const tree = await openScanner();
  const unprovisioned = signTestCredential(
    'CASEVAC:2:P:test-vector-01:44444444-4444-4444-8444-444444444444:55555555-5555-4555-8555-555555555555:1:1794474000',
  );
  await read(tree, unprovisioned);
  const text = allText(tree);
  expect(text).toContain(
    'Credential Verified — Patient Details Unavailable Offline',
  );
  expect(text).not.toContain('PAT-00042');
  expect(text).not.toContain('Test Soldier');

  // No details: Register New Patient is offered and keeps the wristband link.
  await press(tree, 'Register New Patient');
  expect(allText(tree)).toContain(
    'The scanned wristband is genuine but has no details on this tablet.',
  );
  await press(tree, 'Save & Continue');
  const after = allText(tree);
  expect(after).toContain('Unidentified casualty');
  expect(after).toContain('Registered on this tablet');
});

test('explains a permanently denied camera permission on Android', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
  const tree = await openScanner();
  const text = allText(tree);
  expect(text).toContain('Camera permission needed');
  expect(text).toContain('Open settings');
  expect(camera(tree)).toBeUndefined();
});

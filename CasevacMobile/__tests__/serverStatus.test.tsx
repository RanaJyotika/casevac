/**
 * Live server status for the connectivity badges (useServerStatus).
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import {
  SERVER_STATUS_LABEL,
  useServerStatus,
} from '../src/services/connectivity/useServerStatus';

function Probe({
  server,
  intervalMs,
}: {
  server: { isReachable: () => Promise<boolean> };
  intervalMs?: number;
}) {
  return (
    <Text>{SERVER_STATUS_LABEL[useServerStatus(server, intervalMs)]}</Text>
  );
}

async function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(el);
  });
  return tree;
}

const label = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findByType(Text).props.children;

test('shows Online when the dashboard answers', async () => {
  const tree = await render(
    <Probe server={{ isReachable: async () => true }} />,
  );
  expect(label(tree)).toBe('Online');
  tree.unmount();
});

test('shows Offline when the dashboard does not answer or errors', async () => {
  const down = await render(
    <Probe server={{ isReachable: async () => false }} />,
  );
  expect(label(down)).toBe('Offline');
  down.unmount();

  const broken = await render(
    <Probe
      server={{
        isReachable: () => Promise.reject(new Error('network')),
      }}
    />,
  );
  expect(label(broken)).toBe('Offline');
  broken.unmount();
});

test('re-checks periodically, so the badge follows the connection', async () => {
  jest.useFakeTimers();
  let reachable = false;
  const tree = await render(
    <Probe server={{ isReachable: async () => reachable }} intervalMs={1000} />,
  );
  expect(label(tree)).toBe('Offline');

  reachable = true;
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(label(tree)).toBe('Online');
  tree.unmount();
  jest.useRealTimers();
});

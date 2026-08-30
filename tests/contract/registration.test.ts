import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installFakeModelContext } from '../support/fakeModelContext';
import { registerTools, unregisterTools, descriptors } from '@/tools/registry';
import { agentStore } from '@/state/agentSession';
import { requestDisconnect } from '@/state/agentSession';

/**
 * Registration lifecycle (FR-011, FR-012, FR-013, FR-057).
 *
 * Two facts from the published IDL make this test necessary rather than
 * ceremonial (research.md R1):
 *
 *   - `registerTool` REJECTS a duplicate name with InvalidStateError, so
 *     registration is not natively idempotent.
 *   - There is no `unregisterTool`. Teardown is aborting the AbortSignal the
 *     tools were registered with -- which is why it cannot drift out of step
 *     with what was registered.
 */

let host: ReturnType<typeof installFakeModelContext>;

beforeEach(() => {
  host = installFakeModelContext(document);
});

afterEach(() => {
  unregisterTools();
  host.uninstall();
});

const registeredNames = async () => (await host.context.getTools()).map((t) => t.name);

describe('registration', () => {
  it('registers every descriptor exactly once', async () => {
    await registerTools();
    expect(await registeredNames()).toEqual(descriptors.map((d) => d.name));
  });

  it('is idempotent: registering twice yields one surface, not two', async () => {
    await registerTools();
    await registerTools();

    // Without the guard this would have thrown InvalidStateError on the second
    // call -- which is exactly what React strict mode and hot reload would do.
    const names = await registeredNames();
    expect(names).toHaveLength(descriptors.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tears down exactly what it registered', async () => {
    await registerTools();
    expect((await registeredNames()).length).toBeGreaterThan(0);

    unregisterTools();
    expect(await registeredNames()).toEqual([]);
  });

  it('can register again after teardown', async () => {
    await registerTools();
    unregisterTools();
    await registerTools();

    expect(await registeredNames()).toEqual(descriptors.map((d) => d.name));
  });

  it('passes readOnlyHint through from the descriptor, and marks content untrusted', async () => {
    await registerTools();
    const tools = await host.context.getTools();

    for (const descriptor of descriptors) {
      const registered = tools.find((t) => t.name === descriptor.name)!;
      expect(registered.annotations.readOnlyHint, descriptor.name).toBe(descriptor.readOnly);
      // Results echo agent-authored text and learner input. Saying so is free.
      expect(registered.annotations.untrustedContentHint, descriptor.name).toBe(true);
    }
  });

  it('registers the same inputSchema object the validator uses', async () => {
    await registerTools();
    const tools = await host.context.getTools();

    for (const descriptor of descriptors) {
      const registered = tools.find((t) => t.name === descriptor.name)!;
      // Same object, not a copy: one source of truth, so drift is impossible
      // rather than merely tested for (research.md R5).
      expect(registered.inputSchema).toBe(descriptor.inputSchema);
    }
  });

  it('marks the agent connected, and disconnected on teardown', async () => {
    await registerTools();
    expect(agentStore.getState().connection).toBe('connected');

    unregisterTools();
    expect(agentStore.getState().connection).toBe('disconnected');
  });

  it('unregisters when the learner asks, without the UI importing the tools layer', async () => {
    await registerTools();
    expect((await registeredNames()).length).toBeGreaterThan(0);

    // This is the dispatch the Disconnect button makes. The registry is
    // subscribed; the button knows nothing about it (FR-057).
    agentStore.dispatch(requestDisconnect());

    expect(await registeredNames()).toEqual([]);
    expect(agentStore.getState().connection).toBe('disconnected');
  });
});

describe('with no host present', () => {
  it('registers nothing and throws nothing', async () => {
    host.uninstall();

    // FR-013: the absence of an agent host is a supported operating mode, not a
    // degraded one. This must be silent.
    await expect(registerTools()).resolves.toBeNull();
    expect(agentStore.getState().connection).toBe('absent');
  });

  it('tolerates teardown that never registered', () => {
    host.uninstall();
    expect(() => unregisterTools()).not.toThrow();
  });
});

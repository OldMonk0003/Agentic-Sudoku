import { describe, it, expect, vi } from 'vitest';
import { createFakeModelContext } from '../support/fakeModelContext';

/**
 * The fake host is test infrastructure, so it gets tested FIRST and hardest.
 *
 * Most machines have no `document.modelContext` yet, so nearly everything we
 * assert about the agent surface is asserted against this object. If it is
 * laxer than the standard, our code will quietly come to depend on the laxity
 * and break on a real browser -- the exact failure Principle V calls out at the
 * agent boundary, where no human is watching.
 *
 * Every expectation below is taken from the published IDL
 * (specs/002-webmcp-agent-tutor/research.md R1), not from what is convenient.
 */

type Execute = (input: object, options: { signal: AbortSignal }) => Promise<unknown>;

const tool = (name: string, execute: Execute = async () => ({ ok: true })) => ({
  name,
  description: `does ${name}`,
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  execute,
});

describe('fake WebMCP host', () => {
  it('registers a tool and lists it through getTools', async () => {
    const mc = createFakeModelContext();
    await mc.registerTool(tool('get_board_state'));

    const tools = await mc.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe('get_board_state');
    expect(tools[0]!.description).toBe('does get_board_state');
    expect(tools[0]!.inputSchema).toBeDefined();
  });

  it('rejects a duplicate name with InvalidStateError', async () => {
    const mc = createFakeModelContext();
    await mc.registerTool(tool('fill_cell'));

    // THE reason registerTools() needs an idempotency guard: the standard does
    // not make re-registration a no-op, it makes it an error.
    await expect(mc.registerTool(tool('fill_cell'))).rejects.toMatchObject({
      name: 'InvalidStateError',
    });
    expect(await mc.getTools()).toHaveLength(1);
  });

  it('unregisters exactly the tool whose signal aborted, and no other', async () => {
    const mc = createFakeModelContext();
    const first = new AbortController();
    const second = new AbortController();

    await mc.registerTool(tool('a'), { signal: first.signal });
    await mc.registerTool(tool('b'), { signal: second.signal });
    expect(await mc.getTools()).toHaveLength(2);

    first.abort();
    const remaining = await mc.getTools();
    expect(remaining.map((t) => t.name)).toEqual(['b']);
  });

  it('refuses to register against an already-aborted signal', async () => {
    const mc = createFakeModelContext();
    const controller = new AbortController();
    controller.abort();

    await mc.registerTool(tool('a'), { signal: controller.signal });
    expect(await mc.getTools()).toHaveLength(0);
  });

  it('resolves executeTool to the JSON STRING of the handler return value', async () => {
    const mc = createFakeModelContext();
    await mc.registerTool(tool('get_board_state', async () => ({ ok: true, data: { empty: 41 } })));
    const [registered] = await mc.getTools();

    const result = await mc.executeTool(registered!, {});

    // Not an object. The IDL says Promise<DOMString>, and our contract tests
    // must parse exactly what an agent would parse.
    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual({ ok: true, data: { empty: 41 } });
  });

  it('passes the input object and an AbortSignal to the handler', async () => {
    const mc = createFakeModelContext();
    const execute = vi.fn<Execute>(async () => ({ ok: true }));
    await mc.registerTool(tool('fill_cell', execute));
    const [registered] = await mc.getTools();

    await mc.executeTool(registered!, { row: 4, col: 5 });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]![0]).toEqual({ row: 4, col: 5 });
    expect(execute.mock.calls[0]![1]!.signal).toBeInstanceOf(AbortSignal);
  });

  it('defaults a missing input object to {}', async () => {
    const mc = createFakeModelContext();
    const execute = vi.fn<Execute>(async () => ({ ok: true }));
    await mc.registerTool(tool('get_board_state', execute));
    const [registered] = await mc.getTools();

    await mc.executeTool(registered!);
    expect(execute.mock.calls[0]![0]).toEqual({});
  });

  it('collapses a rejected handler into an opaque UnknownError', async () => {
    const mc = createFakeModelContext();
    await mc.registerTool(
      tool('fill_cell', async () => {
        throw new RangeError('row 12 is off the grid');
      }),
    );
    const [registered] = await mc.getTools();

    // This is WHY no handler of ours may ever throw: the reason the agent needs
    // in order to correct itself does not survive the boundary (FR-008, FR-009).
    await expect(mc.executeTool(registered!, {})).rejects.toMatchObject({
      name: 'UnknownError',
    });
    await expect(mc.executeTool(registered!, {})).rejects.not.toMatchObject({
      message: expect.stringContaining('off the grid'),
    });
  });

  it('rejects executeTool for a tool that is no longer registered', async () => {
    const mc = createFakeModelContext();
    const controller = new AbortController();
    await mc.registerTool(tool('a'), { signal: controller.signal });
    const [registered] = await mc.getTools();

    controller.abort();

    await expect(mc.executeTool(registered!, {})).rejects.toMatchObject({
      name: 'NotFoundError',
    });
  });

  it('fires toolchange when the tool set changes', async () => {
    const mc = createFakeModelContext();
    const listener = vi.fn();
    mc.addEventListener('toolchange', listener);

    const controller = new AbortController();
    await mc.registerTool(tool('a'), { signal: controller.signal });
    expect(listener).toHaveBeenCalledTimes(1);

    controller.abort();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('exposes annotations as registered, defaulting the hints to false', async () => {
    const mc = createFakeModelContext();
    await mc.registerTool({ ...tool('get_board_state'), annotations: { readOnlyHint: true } });
    await mc.registerTool(tool('fill_cell'));

    const tools = await mc.getTools();
    expect(tools.find((t) => t.name === 'get_board_state')!.annotations).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: false,
    });
    expect(tools.find((t) => t.name === 'fill_cell')!.annotations).toMatchObject({
      readOnlyHint: false,
    });
  });
});

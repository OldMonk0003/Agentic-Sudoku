import { agentStore, pushExplanation } from '@/state/agentSession';
import { validate } from './validate';
import { failure, success, type ErrorCode, type JsonSchema, type ToolDescriptor, type ToolExecuteOptions, type ToolResult } from './types';

/**
 * The narration contract, enforced in exactly one place.
 *
 * SC-002 and SC-003 are absolutes -- "there is no path by which the board
 * changes silently", "100% of attempted changes lacking valid explanation text
 * are rejected". With nine write tools written independently, those hold only if
 * nine implementations are each correct and stay correct forever.
 *
 * So write tools are not written as free functions. `defineWriteTool` INJECTS
 * the explanation property into the schema rather than trusting the author to
 * declare it, and checks it before the handler runs. A write tool that forgets
 * to narrate cannot be declared: the type does not permit it.
 *
 * The ordering is the other half of the guarantee, and it is deliberate:
 *
 *      validate  ->  mutate  ->  publish
 *
 * An explanation for a change that was rejected must never appear on screen (it
 * would be a lie), and a change must never land without its explanation queued.
 */

/** Spec assumption: the practical span of one to two lines, enforced at both ends. */
export const EXPLANATION_MIN = 20;
export const EXPLANATION_MAX = 240;

const EXPLANATION_SCHEMA: JsonSchema = {
  type: 'string',
  minLength: EXPLANATION_MIN,
  maxLength: EXPLANATION_MAX,
};

/** What a write handler reports. Never a thrown error -- see registry.ts. */
export type WriteOutcome =
  | { readonly ok: true; readonly data: unknown }
  | {
      readonly ok: false;
      readonly code: ErrorCode;
      readonly message: string;
      readonly details?: Readonly<Record<string, unknown>>;
    };

export interface WriteToolSpec {
  readonly name: string;
  /** Self-sufficient for an agent that has never seen this site (FR-006, FR-007). */
  readonly description: string;
  /** WITHOUT `explanation` -- the wrapper adds it, so it cannot be forgotten or varied. */
  readonly inputSchema: JsonSchema;
  /**
   * 'popup' (default) queues an explanation popup on success.
   * 'self' is for a tool whose explanation IS its visible output --
   * `show_pattern_hint_toast` -- where a popup as well would say it twice.
   */
  readonly narration?: 'popup' | 'self';
  run(
    input: Record<string, unknown> & { explanation: string },
    options?: ToolExecuteOptions,
  ): Promise<WriteOutcome>;
}

function withExplanation(schema: JsonSchema): JsonSchema {
  return {
    ...schema,
    properties: { ...(schema.properties ?? {}), explanation: EXPLANATION_SCHEMA },
    required: [...(schema.required ?? []), 'explanation'],
  };
}

export function defineWriteTool(spec: WriteToolSpec): ToolDescriptor {
  const inputSchema = withExplanation(spec.inputSchema);

  async function execute(input: unknown, options?: ToolExecuteOptions): Promise<ToolResult> {
    const validation = validate(inputSchema, input);

    if (!validation.ok) {
      const { violations } = validation;

      // The narration failures are reported FIRST and specifically. "invalid
      // input" would be true but useless: FR-009 wants a reason precise enough
      // for the agent to correct itself, and "you forgot to explain yourself" is
      // a different fix from "row 12 is off the grid".
      const missingExplanation = violations.find(
        (v) => v.path === 'explanation' && v.message.includes('required'),
      );
      if (missingExplanation) {
        return failure(
          spec.name,
          'explanation-required',
          `${spec.name} changes what the learner sees, so it requires "explanation": one or two sentences (${EXPLANATION_MIN}-${EXPLANATION_MAX} characters) saying why, which the learner will read.`,
          { minLength: EXPLANATION_MIN, maxLength: EXPLANATION_MAX },
        );
      }

      const badExplanation = violations.find((v) => v.path === 'explanation');
      if (badExplanation) {
        return failure(spec.name, 'explanation-length', badExplanation.message, {
          minLength: EXPLANATION_MIN,
          maxLength: EXPLANATION_MAX,
        });
      }

      const unexpected = violations.find((v) => v.message.includes('not a recognised argument'));
      return failure(
        spec.name,
        unexpected ? 'unexpected-argument' : 'invalid-input',
        unexpected?.message ?? violations[0]!.message,
        { violations },
      );
    }

    const input_ = validation.value as Record<string, unknown> & { explanation: string };

    let outcome: WriteOutcome;
    try {
      outcome = await spec.run(input_, options);
    } catch (error) {
      // A handler should never throw, but if one does, the reason must not reach
      // the agent as an opaque UnknownError from executeTool (FR-008).
      return failure(
        spec.name,
        'internal-error',
        `${spec.name} failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!outcome.ok) {
      // Nothing changed, so nothing is narrated.
      return failure(spec.name, outcome.code, outcome.message, outcome.details);
    }

    if ((spec.narration ?? 'popup') === 'popup') {
      agentStore.dispatch(
        pushExplanation({ text: input_.explanation, tool: spec.name, now: Date.now() }),
      );
    }

    return success(spec.name, outcome.data);
  }

  return {
    name: spec.name,
    description: spec.description,
    inputSchema,
    readOnly: false,
    execute,
  };
}

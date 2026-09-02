/**
 * The vocabulary of the WebMCP adapter layer.
 *
 * Two shapes here are forced by the standard rather than chosen (research.md R1):
 *
 *   - `ToolResult` is a RETURNED value in every case, success or failure,
 *     because `executeTool` collapses a rejected handler into an opaque
 *     `UnknownError` -- destroying the reason FR-009 exists to deliver.
 *   - `readOnly` is one field feeding both the descriptor table and the
 *     `readOnlyHint` we register, so FR-005 cannot drift from the truth.
 */

/** The JSON Schema subset this surface uses. See src/tools/validate.ts. */
export interface JsonSchema {
  readonly type: 'object' | 'array' | 'string' | 'integer' | 'boolean';
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: false;
  readonly items?: JsonSchema;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly enum?: readonly string[];
  readonly description?: string;
}

/**
 * Closed enumeration. The first group maps one-for-one onto the game store's
 * `RejectionReason`, so a state rejection is forwarded rather than reinterpreted.
 */
export type ErrorCode =
  // forwarded from the game store
  | 'cell-is-clue'
  | 'cell-not-empty'
  | 'out-of-range'
  | 'wrong-status'
  | 'nothing-to-undo'
  // input
  | 'invalid-input'
  | 'unexpected-argument'
  // the narration contract
  | 'explanation-required'
  | 'explanation-length'
  | 'acknowledgement-required'
  // tool-specific
  | 'unknown-technique'
  | 'no-annotation-target'
  | 'playback-interrupted'
  | 'playback-step-failed'
  // feature 003
  | 'unknown-difficulty'
  | 'generation-failed'
  | 'internal-error';

export interface ToolError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ToolResult =
  | { readonly ok: true; readonly tool: string; readonly surface_version: string; readonly data: unknown }
  | { readonly ok: false; readonly tool: string; readonly surface_version: string; readonly error: ToolError };

export interface ToolExecuteOptions {
  readonly signal?: AbortSignal;
}

export interface ToolDescriptor {
  readonly name: string;
  /**
   * Written for an agent that has never seen this site (FR-006), and stating the
   * addressing convention every time (FR-007). It is documentation an agent
   * reads at runtime, not a comment.
   */
  readonly description: string;
  readonly inputSchema: JsonSchema;
  /** Feeds ToolAnnotations.readOnlyHint at registration (FR-005). */
  readonly readOnly: boolean;
  execute(input: unknown, options?: ToolExecuteOptions): Promise<ToolResult>;
}

/**
 * Every result carries the version, so a stale agent finds out on its next call.
 *
 * 1.0.0 -> 1.1.0 for feature 003: five tools ADDED.
 * 1.1.0 -> 1.2.0 for feature 005: two tools ADDED (restart_puzzle, undo_move),
 * and the `confirmation-pending` error code removed. 002/FR-010 reserves MAJOR
 * for renaming a tool, removing a tool, or narrowing a schema -- an error code is
 * none of those, and an agent that handled it simply never sees it again. So
 * this stays MINOR and an agent written against 1.0.0 keeps working.
 */
export const TOOL_SURFACE_VERSION = '1.2.0';

export function success(tool: string, data: unknown): ToolResult {
  return { ok: true, tool, surface_version: TOOL_SURFACE_VERSION, data };
}

export function failure(
  tool: string,
  code: ErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ToolResult {
  return {
    ok: false,
    tool,
    surface_version: TOOL_SURFACE_VERSION,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

/**
 * Ambient declarations for the WebMCP browser API.
 *
 * Transcribed from the published IDL at https://webmachinelearning.github.io/webmcp/
 * (see specs/002-webmcp-agent-tutor/research.md R1). TypeScript's DOM library
 * does not yet ship these, and the constitution forbids a wrapper library or SDK
 * standing between this project and the browser API -- so a type declaration is
 * the correct and only shim: it exists at compile time and emits nothing.
 *
 *   partial interface Document {
 *     [SecureContext, SameObject] readonly attribute ModelContext modelContext;
 *   };
 *
 * `modelContext` is declared OPTIONAL here even though the IDL marks it
 * readonly-non-nullable, because it is gated on a secure context and on the
 * "tools" Permissions Policy feature. Optionality is what forces every call site
 * to feature-detect, which is exactly what FR-013 requires.
 */

interface ModelContextToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
}

interface ModelContextTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly annotations?: ModelContextToolAnnotations;
  execute(input: object, options: { signal: AbortSignal }): Promise<unknown>;
}

interface RegisteredTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly annotations: Required<ModelContextToolAnnotations>;
  readonly origin: string;
}

interface ModelContextRegisterToolOptions {
  /** Origins permitted to see the tool. */
  readonly exposedTo?: readonly string[];
  /** Aborting unregisters the tool. There is no `unregisterTool` in the standard. */
  readonly signal?: AbortSignal;
}

interface ModelContext extends EventTarget {
  registerTool(tool: ModelContextTool, options?: ModelContextRegisterToolOptions): Promise<undefined>;
  getTools(): Promise<RegisteredTool[]>;
  /** Resolves to the handler's return value, JSON-serialised. */
  executeTool(
    tool: { readonly name: string },
    input?: object,
    options?: { readonly signal?: AbortSignal },
  ): Promise<string>;
}

interface Document {
  readonly modelContext?: ModelContext;
}

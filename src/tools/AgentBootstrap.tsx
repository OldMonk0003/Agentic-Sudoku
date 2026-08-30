'use client';

import { registerTools } from './registry';

/**
 * The reason this file exists, stated plainly: **a static export has no server
 * runtime to run a startup hook in, and a server component's imports never reach
 * the browser.**
 *
 * So a bare side-effect import in `app/layout.tsx` would execute at build time
 * in Node -- where `document` is undefined -- and never in the browser at all.
 * Registration has to be pulled in by a client module.
 *
 * This is that pull, and nothing more. Principle I forbids registration inside
 * "a component render function, a JSX/template body, a reactive effect tied to a
 * DOM node, or any code path that runs per-render", so:
 *
 *   - registration happens HERE, at module evaluation, once, before any render;
 *   - the component body is `return null` and does nothing whatsoever.
 *
 * `registerTools()` is idempotent and resolves to null when no host exists, so a
 * double module evaluation (strict mode, hot reload) is harmless and a browser
 * without WebMCP sees nothing at all.
 */

// Module scope: evaluated once when the client bundle loads. Not a render path.
void registerTools().catch(() => {
  // A host that refuses registration is not a player-facing error (FR-013).
  // registerTools already leaves the surface clean; there is nothing to add.
});

export function AgentBootstrap(): null {
  return null;
}

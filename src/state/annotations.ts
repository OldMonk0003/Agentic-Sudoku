import type { Coord, Digit } from '@/engine/grid';

/**
 * The agent's marks on the board: what they are, and which are still on screen.
 *
 * Transient by construction. Nothing here is game data, nothing here is
 * persisted, and the types make that structural rather than remembered
 * (002/FR-034).
 *
 * EXPIRY IS A SELECTOR, NOT A TIMER. Each annotation carries an absolute
 * `expiresAt`; the View supplies `now`. That keeps the state layer free of
 * intervals and makes 002/FR-033 deterministic in a headless test.
 */

export type AnnotationRole = 'target' | 'because';
export type UnitType = 'row' | 'col' | 'box';

export interface CellAnnotation {
  readonly id: string;
  readonly kind: 'cell';
  readonly role: AnnotationRole;
  readonly cells: readonly Coord[];
  readonly expiresAt: number;
}

export interface BeamAnnotation {
  readonly id: string;
  readonly kind: 'beam';
  readonly unit: { readonly type: UnitType; readonly n: number };
  readonly digit: Digit | null;
  readonly expiresAt: number;
}

export type Annotation = CellAnnotation | BeamAnnotation;

/** What a tool supplies; the store adds the id and the expiry. */
export type AnnotationInput =
  | { readonly kind: 'cell'; readonly role: AnnotationRole; readonly cells: readonly Coord[] }
  | {
      readonly kind: 'beam';
      readonly unit: { readonly type: UnitType; readonly n: number };
      readonly digit?: Digit | null;
    };

/** Spec assumption: annotations expire after about sixty seconds of no agent activity. */
export const ANNOTATION_TTL_MS = 60_000;

/** Attach ids and an expiry to what a tool asked for. */
export function materialise(
  inputs: readonly AnnotationInput[],
  firstId: number,
  expiresAt: number,
): { readonly annotations: readonly Annotation[]; readonly nextId: number } {
  let nextId = firstId;
  const annotations = inputs.map((input): Annotation => {
    const id = `a${nextId++}`;
    return input.kind === 'cell'
      ? { id, kind: 'cell', role: input.role, cells: [...input.cells], expiresAt }
      : { id, kind: 'beam', unit: input.unit, digit: input.digit ?? null, expiresAt };
  });
  return { annotations, nextId };
}

export function unexpired(
  annotations: readonly Annotation[],
  now: number,
): readonly Annotation[] {
  return annotations.filter((annotation) => annotation.expiresAt > now);
}

/**
 * Which role, if any, each cell carries -- keyed by flat index for the board to
 * render and for the cell label to announce.
 *
 * `target` wins over `because` when a cell carries both: the cell a deduction
 * concludes about is the more informative fact, and two marks in one cell would
 * read as neither.
 */
export function rolesByIndex(
  annotations: readonly Annotation[],
): ReadonlyMap<number, AnnotationRole> {
  const roles = new Map<number, AnnotationRole>();

  for (const annotation of annotations) {
    if (annotation.kind !== 'cell') continue;
    for (const { row, col } of annotation.cells) {
      const index = (row - 1) * 9 + (col - 1);
      if (annotation.role === 'target' || !roles.has(index)) roles.set(index, annotation.role);
    }
  }

  return roles;
}

export function beamsOnly(annotations: readonly Annotation[]): readonly BeamAnnotation[] {
  return annotations.filter((a): a is BeamAnnotation => a.kind === 'beam');
}

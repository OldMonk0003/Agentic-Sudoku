'use client';

import { DIGITS, colOf, rowOf, toCoord, type CellIndex } from '@/engine/grid';
import type { HighlightTier } from '@/state/selectors';
import type { AnnotationRole, SpotlightEdges } from '@/state/agentSession';
import type { Cell as CellData } from '@/state/types';

/**
 * One board cell.
 *
 * Two rules from research.md R3 are load-bearing here:
 *
 *   - The shoji framing comes from BORDER WEIGHT, not colour (FR-053).
 *   - The selection is a RING composed OVER whichever wash applies -- never a
 *     fourth, darker fill. That is what keeps text at 4.5:1 on every tier.
 *
 * Every tier also carries a non-colour cue so it survives greyscale (FR-009).
 */

interface CellProps {
  readonly index: CellIndex;
  readonly colIndex: number;
  readonly cell: CellData;
  readonly tier: HighlightTier;
  readonly conflict: boolean;
  readonly selected: boolean;
  /**
   * Roving tabindex: exactly ONE cell is in the tab order at any time. When
   * nothing is selected that is the first cell, otherwise it is the selection.
   * Without this the whole board is unreachable by keyboard on a fresh load.
   */
  readonly tabbable: boolean;
  /**
   * The agent's mark on this cell, if any. Carried into the LABEL as well as the
   * overlay, so a screen-reader learner arrowing the board hears it in place
   * rather than only in the announcement (002/FR-060, SC-011).
   */
  readonly annotation?: AnnotationRole | null;
  /**
   * Part of the band marking where the agent last changed something
   * (003/FR-018). Drawn as a DASHED EDGE RULE, never a wash: the learner's
   * highlighting owns the flat-wash vocabulary, and a second wash would be
   * exactly the confusion 003/FR-020 forbids.
   */
  readonly spotlit?: boolean;
  /**
   * Which sides of this cell face OUT of the band. Only those get a rule, so the
   * band reads as ONE outlined shape rather than twenty-one boxed cells -- which
   * is what the first screenshot showed it must not be.
   */
  readonly spotlightEdges?: SpotlightEdges | null;
  /** The cell the agent actually changed, at the centre of the band. */
  readonly spotlightFocus?: boolean;
  readonly onSelect: (index: CellIndex) => void;
}

function borderClasses(index: CellIndex): string {
  const row = rowOf(index);
  const col = colOf(index);
  const heavyRight = col % 3 === 0 && col !== 9;
  const heavyBottom = row % 3 === 0 && row !== 9;

  return [
    col !== 9 ? (heavyRight ? 'border-r-2 border-r-line-box' : 'border-r border-r-line-hairline') : '',
    row !== 9 ? (heavyBottom ? 'border-b-2 border-b-line-box' : 'border-b border-b-line-hairline') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The wash a cell renders. A `selected` cell shows the wash it WOULD have had --
 * the ring is what marks it, not a fill -- so `underlyingTier` resolves that.
 */
function washClass(tier: HighlightTier, underlyingTier: HighlightTier): string {
  const effective = tier === 'selected' ? underlyingTier : tier;
  switch (effective) {
    case 'conflict':
      return 'bg-wash-conflict';
    case 'matching':
      return 'bg-wash-matching';
    case 'crosshair':
      return 'bg-wash-crosshair';
    default:
      // Explicit rather than inherited, so every tier resolves to a real
      // computed colour. A transparent cell reads as luminance 0, which made the
      // greyscale ladder test fail against a board it actually rendered fine on.
      return 'bg-ground';
  }
}

/** Non-colour cue: matching digits gain type weight (FR-009). */
function weightClass(tier: HighlightTier, cell: CellData): string {
  if (tier === 'matching') return 'font-semibold';
  if (cell.origin === 'clue') return 'font-medium';
  return 'font-normal';
}

/**
 * Ink and slant are ORTHOGONAL cues and must compose.
 *
 * The first version returned early on conflict, which silently dropped the
 * italic from an agent digit that happened to be wrong -- and that is precisely
 * the case where authorship matters most. 002/FR-038 lets the tutor be wrong on
 * purpose so the learner can check it; if the wrong digit stops looking like the
 * agent's, the learner cannot tell whose mistake they are looking at.
 *
 * So: colour says whether the digit CONFLICTS, slant says WHO WROTE IT, and
 * neither erases the other.
 */
function inkClass(cell: CellData, conflict: boolean): string {
  const slant = cell.origin === 'agent' ? ' italic' : '';

  if (conflict) return `text-ink-conflict${slant}`;
  if (cell.origin === 'clue') return 'text-ink-clue';
  return `text-ink-player${slant}`;
}

function describe(
  row: number,
  col: number,
  cell: CellData,
  conflict: boolean,
  annotation: AnnotationRole | null,
  spotlightFocus: boolean,
): string {
  const where = `Row ${row}, column ${col}`;
  const notes = [...cell.candidates].sort().join(' ');
  // Authorship is spoken, not only shown: a screen-reader learner must be able
  // to tell their own entries from the agent's on equal terms (002/FR-060).
  const what =
    cell.value === null
      ? cell.candidates.size > 0
        ? `notes ${notes}${cell.origin === 'agent' ? ', placed by agent' : ''}`
        : 'empty'
      : cell.origin === 'clue'
        ? `${cell.value}, given`
        : cell.origin === 'agent'
          ? `${cell.value}, placed by agent`
          : String(cell.value);
  // The conflict is named in the label itself, so a screen reader hears it in
  // place rather than only via the live region (FR-026, FR-047).
  const marked =
    annotation === 'target' ? ', agent target' : annotation === 'because' ? ', agent reason' : '';
  // 003/FR-025: a screen-reader learner hears WHERE the agent acted in place,
  // arrowing the board, not only through the live region.
  const spotlit = spotlightFocus ? ', agent changed this cell' : '';
  return `${where}, ${what}${conflict ? ', conflict' : ''}${marked}${spotlit}`;
}

export function Cell({
  index, colIndex, cell, tier, conflict, selected, tabbable, annotation = null,
  spotlit = false, spotlightEdges = null, spotlightFocus = false, onSelect,
}: CellProps) {
  const { row, col } = toCoord(index);
  const origin = cell.value === null ? 'empty' : cell.origin;

  // What wash this cell would show if it were not the selected one. A selected
  // cell that is ALSO in conflict keeps the conflict wash -- losing it would hide
  // the more important signal behind the less important one.
  const underlying: HighlightTier = selected ? (conflict ? 'conflict' : 'crosshair') : tier;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={describe(row, col, cell, conflict, annotation, spotlightFocus)}
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      aria-colindex={colIndex}
      data-index={index}
      data-origin={origin}
      data-tier={tier}
      data-conflict={conflict ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
      {...(spotlit ? { 'data-spotlit': 'true' } : {})}
      {...(spotlightFocus ? { 'data-spotlight-focus': 'true' } : {})}
      onClick={() => onSelect(index)}
      // Focus and selection move together. A keyboard user who tabs into the
      // board must land on a SELECTED cell, or their next keystroke goes
      // nowhere -- which is exactly what the audit caught (FR-046, SC-005).
      onFocus={() => onSelect(index)}
      className={[
        'relative flex items-center justify-center',
        'aspect-square select-none',
        'text-cell leading-none',
        'border-solid',
        borderClasses(index),
        washClass(tier, underlying),
        weightClass(tier, cell),
        inkClass(cell, conflict),
        // The ring, composed over whatever wash applies.
        selected ? 'z-10 outline-2 outline-offset-[-2px] outline-ring-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/*
        The dashed edge rule. An overlay rather than a background, because
        NOTHING NEW GOES UNDERNEATH A DIGIT -- 002's third visual defect was the
        `because` hatch running its stripes straight through a clue's 4, and the
        fix was moving it to the cell edge. Not to be re-opened (003/R5).
      */}
      {spotlit && (
        <span
          aria-hidden="true"
          data-spotlight-edge="true"
          className={[
            'pointer-events-none absolute inset-0 border-dashed border-mark-agent',
            // The focus cell is fully outlined, so it is findable INSIDE the
            // band; every other cell contributes only its outward-facing sides.
            spotlightFocus
              ? 'border-2'
              : [
                  spotlightEdges?.top ? 'border-t' : '',
                  spotlightEdges?.right ? 'border-r' : '',
                  spotlightEdges?.bottom ? 'border-b' : '',
                  spotlightEdges?.left ? 'border-l' : '',
                ].filter(Boolean).join(' '),
          ].filter(Boolean).join(' ')}
        />
      )}

      {cell.value ?? ''}

      {/*
        Candidates occupy FIXED positions in a 3x3 sub-grid, so a missing
        candidate reads as a gap rather than shifting its neighbours (FR-022).
        That is what makes a pencilled cell scannable at a glance.
      */}
      {cell.value === null && cell.candidates.size > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 p-[8%]"
        >
          {DIGITS.map((digit) => (
            <span
              key={digit}
              {...(cell.candidates.has(digit) ? { 'data-candidate': digit } : {})}
              className="flex items-center justify-center text-candidate leading-none text-ink-note"
            >
              {cell.candidates.has(digit) ? digit : ''}
            </span>
          ))}
        </span>
      )}
      {/*
        The agent's authorship mark (002/FR-044).
        TWO cues, neither of them colour alone: the digit is ITALIC (see
        inkClass) and carries a sage corner glyph. That is what lets a learner
        tell their own entries from the agent's at a glance, without hovering,
        and still tell them apart in greyscale and under any colour vision
        deficiency (002/SC-004). Agent digits share the player ink deliberately:
        001's palette research found that a third ink could not clear 4.5:1 on
        every wash tier.
      */}
      {cell.origin === 'agent' && cell.value !== null && (
        <span
          data-agent-placed="true"
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-0 w-0 border-t-6 border-l-6 border-t-mark-agent border-l-transparent"
        />
      )}

      {/*
        Agent-written pencil candidates carry the same mark, smaller, so the
        learner can tell whose bookkeeping they are looking at (002/FR-044).
      */}
      {cell.origin === 'agent' && cell.value === null && cell.candidates.size > 0 && (
        <span
          data-agent-candidates="true"
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-0 w-0 border-t-4 border-l-4 border-t-mark-agent border-l-transparent"
        />
      )}

      {/*
        The NON-COLOUR cue for a conflict (FR-026). The author's brief specified
        "soft red"; Principle V forbids conveying anything by colour alone, so the
        wash is accompanied by a corner wedge that survives greyscale and
        colour-blind rendering.
      */}
      {conflict && (
        <span
          data-conflict-marker
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 border-r-6 border-b-6 border-r-ink-conflict border-b-transparent"
        />
      )}
    </button>
  );
}

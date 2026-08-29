'use client';

import { DIGITS, type Digit } from '@/engine/grid';
import { enterDigit, toggleCandidate } from '@/state/actions';
import { store } from '@/state/store';
import { useSelector } from './useStore';

/**
 * The on-screen keypad. Dispatches exactly the same actions as the keyboard, so
 * both paths produce identical results (FR-020).
 */
export function Keypad() {
  const notes = useSelector((s) => s.inputMode === 'notes');
  // FR-020: the keypad and the keyboard must produce identical results, so both
  // route through the same mode branch.
  const press = (digit: Digit) =>
    store.dispatch(notes ? toggleCandidate(digit, 'player') : enterDigit(digit, 'player'));

  return (
    <div className="grid w-full max-w-[min(92vw,34rem)] grid-cols-9 gap-1.5" role="group" aria-label="Number pad">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          aria-label={String(digit)}
          onClick={() => press(digit)}
          className={[
            'flex h-12 min-h-11 items-center justify-center rounded-sm',
            'border border-line-hairline bg-surface',
            'text-ink-player text-lg',
            'transition-colors hover:bg-wash-crosshair',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
          ].join(' ')}
        >
          {digit}
        </button>
      ))}
    </div>
  );
}

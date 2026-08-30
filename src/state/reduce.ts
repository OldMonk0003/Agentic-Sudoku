import type { Action } from './actions';
import type { GameSession } from './types';
import type { ReducerOutcome } from './outcome';
import { commit, reject } from './outcome';
import { selectCellAt, moveSelectionBy, setMode, toggleMode } from './navigation';
import {
  placeDigitAt, placeDigitInSelection,
  toggleCandidateAt, toggleCandidateInSelection,
  eraseCellAt, eraseSelection,
  setCandidatesForCells, fillEveryCandidate,
} from './edits';
import {
  advanceClock, beginGeneratingIn, generateInto, loadInto,
  pauseSession, resumeSession, undoLast,
} from './lifecycle';

/**
 * The dispatcher: one action in, one handler out.
 *
 * It holds no rules of its own -- every case is one line delegating to the
 * module that owns that responsibility. That is the point of the split: this
 * file can be read top to bottom as a table of contents for the state layer.
 */
export function reduce(session: GameSession, action: Action): ReducerOutcome {
  switch (action.type) {
    case 'newPuzzle':
      return generateInto(session, action.difficulty, action.seed);

    case 'beginGenerating':
      return beginGeneratingIn(session);

    case 'loadPuzzle':
      return commit(loadInto(session, action.puzzle));

    case 'loadSession':
      // Restored sessions arrive already validated by persistence.restoreSession,
      // which discards anything malformed rather than partially applying it.
      return commit(action.session);

    case 'selectCell':
      return selectCellAt(session, action.coord);

    case 'moveSelection':
      return moveSelectionBy(session, action.direction);

    case 'setInputMode':
      return setMode(session, action.mode);

    case 'toggleInputMode':
      return toggleMode(session);

    case 'enterDigit':
      return placeDigitInSelection(session, action.digit, action.origin);

    case 'enterDigitAt':
      return placeDigitAt(session, action.coord, action.digit, action.origin);

    case 'toggleCandidate':
      return toggleCandidateInSelection(session, action.digit, action.origin);

    case 'toggleCandidateAt':
      return toggleCandidateAt(session, action.coord, action.digit, action.origin);

    case 'setCandidatesAt':
      return setCandidatesForCells(session, action.entries, action.origin);

    case 'fillAllCandidates':
      return fillEveryCandidate(session, action.origin);

    case 'eraseCell':
      return eraseSelection(session, action.origin);

    case 'eraseCellAt':
      return eraseCellAt(session, action.coord, action.origin);

    case 'undo':
      return undoLast(session);

    case 'pause':
      return pauseSession(session);

    case 'resume':
      return resumeSession(session);

    case 'tick':
      return advanceClock(session, action.deltaMs);

    default:
      return reject('unknown-action');
  }
}

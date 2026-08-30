import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExplanationQueue } from '@/ui/ExplanationQueue';
import {
  agentStore, pushExplanation, dismissExplanation, agentConnected, agentAbsent,
  MAX_VISIBLE_EXPLANATIONS,
} from '@/state/agentSession';

/**
 * FR-021: "Explanation text MUST be treated as untrusted content and rendered as
 * literal text. Markup, scripts, and links within it MUST NOT be interpreted,
 * styled, or made actionable."
 *
 * This is the security test of feature 002. Agent-authored text is the one
 * untrusted string that reaches the page, and React's escaping is the entire
 * defence -- so this file exists to make sure that defence stays the whole
 * defence. If someone later wants clickable cell references in explanations,
 * these assertions are what will stop them reaching for a parser.
 */

const HOSTILE = [
  '<img src=x onerror=alert(1)> and some ordinary words to reach the minimum',
  '<script>alert(1)</script> plus enough words here to clear twenty characters',
  '[click me](javascript:alert(1)) and a little more text to reach the minimum',
  'Visit http://evil.example now, plus enough words to clear the lower bound.',
  '</p><iframe src=evil></iframe> with enough additional words to be valid',
];

function push(text: string, tool = 'fill_cell') {
  agentStore.dispatch(pushExplanation({ text, tool, now: Date.now() }));
}

beforeEach(() => {
  // The queue mounts only while an agent exists -- SC-010 requires a host-less
  // page to carry zero agent-related elements, and an empty labelled status
  // region is one.
  agentStore.dispatch(agentConnected());
  for (const explanation of [...agentStore.getState().explanations]) {
    agentStore.dispatch(dismissExplanation({ id: explanation.id }));
  }
});

afterEach(cleanup);

describe('agent text is rendered as literal text', () => {
  it.each(HOSTILE)('renders %s verbatim, interpreting nothing', (text) => {
    push(text);
    render(<ExplanationQueue />);

    const explanation = screen.getByTestId('explanation');

    // The exact characters the agent wrote, as text.
    expect(explanation.textContent).toContain(text);
    // And nothing became markup.
    expect(explanation.querySelector('img')).toBeNull();
    expect(explanation.querySelector('script')).toBeNull();
    expect(explanation.querySelector('iframe')).toBeNull();
    expect(explanation.querySelector('a')).toBeNull();
  });

  it('creates no anchor anywhere in the document, however URL-shaped the text', () => {
    push('Go to https://evil.example/steal?token=1 immediately, says the agent.');
    render(<ExplanationQueue />);

    expect(document.querySelectorAll('a')).toHaveLength(0);
  });

  it('escapes rather than executes, so the markup appears in innerHTML escaped', () => {
    push(HOSTILE[0]!);
    render(<ExplanationQueue />);

    const html = screen.getByTestId('explanation').innerHTML;
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });
});

describe('the queue never blocks the learner', () => {
  it('is a polite live region, not a dialog (FR-018, FR-022)', () => {
    push('An explanation that must be announced without taking focus at all.');
    render(<ExplanationQueue />);

    const region = screen.getByTestId('explanation-queue');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('role')).not.toBe('dialog');
    expect(region.getAttribute('role')).not.toBe('alertdialog');
  });

  it('never takes focus when an explanation arrives', async () => {
    const { container } = render(<ExplanationQueue />);
    const before = document.activeElement;

    push('An explanation arriving while the learner is busy typing elsewhere.');
    // Re-render happens through the store subscription; focus must not move.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(before);
    expect(container.querySelector('[autofocus]')).toBeNull();
  });

  it('shows at most three at once, queueing the rest (FR-020)', () => {
    for (let i = 0; i < 5; i++) push(`Explanation number ${i}, long enough to be valid input.`);
    render(<ExplanationQueue />);

    expect(screen.getAllByTestId('explanation')).toHaveLength(MAX_VISIBLE_EXPLANATIONS);
  });

  it('attributes each explanation to the tool that made the change (FR-017)', () => {
    push('Only 7 can go here, because the rest of this box is already taken.', 'fill_cell');
    render(<ExplanationQueue />);

    expect(screen.getByTestId('explanation').getAttribute('data-tool')).toBe('fill_cell');
    // The attribution is in text too, not only in colour or a dot.
    expect(screen.getByTestId('explanation').textContent).toContain('Agent:');
  });

  it('is dismissible by the learner (FR-019)', async () => {
    const user = userEvent.setup();
    push('An explanation the learner has read and would like to be rid of.');
    render(<ExplanationQueue />);

    await user.click(screen.getByRole('button', { name: 'Dismiss explanation' }));
    expect(screen.queryByTestId('explanation')).toBeNull();
  });

  it('renders the region but no explanations when the agent has said nothing', () => {
    // The region persists across a session so a screen reader announces
    // reliably; it is the explanations that come and go.
    render(<ExplanationQueue />);
    expect(screen.getByTestId('explanation-queue')).toBeDefined();
    expect(screen.queryByTestId('explanation')).toBeNull();
  });

  it('renders NOTHING AT ALL when there is no agent host (SC-010)', () => {
    agentStore.dispatch(agentAbsent());
    render(<ExplanationQueue />);

    // Not an empty region -- no region. With no host the page must be
    // indistinguishable from feature 001, and a labelled live region is not.
    expect(screen.queryByTestId('explanation-queue')).toBeNull();
  });
});

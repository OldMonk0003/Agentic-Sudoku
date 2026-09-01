---
name: agentic-sudoku
description: Play Agentic Sudoku with a human. Use when they want to play, practise, or be tutored on Sudoku using the Agentic Sudoku board, or ask what that board lets you do. Opens the board in the browser, reads the tools the page itself publishes, and works only through them. Do not use this for other Sudoku sites, and not for editing a codebase.
---

# Agentic Sudoku

Agentic Sudoku is a Sudoku board that publishes its own tools to the page, so you can play
alongside the person instead of clicking things for them.

Site address: http://localhost:3000

Follow the four instructions below, in order. They are the whole skill.

## 1. Open the board

Open the site address above in the built-in browser.

- If a board from that address is already open, **use it**. Do not open a second one and do not
  reload it — the person may have a puzzle in progress that a reload would restart.
- Ask the person for nothing first. No address, no setup, no questions before the board is up.
- If the site cannot be reached, say so plainly, say that it has to be running at that address,
  and stop. Do not describe, guess at, or act on a board you cannot see.

## 2. Read what the page publishes, and tell the person

The page registers its own tools with the browser. **Read them from the live page, now**, and
report to the person every one you found. For each, give:

- its name,
- one short line on what it does, taken from what the page published,
- whether it only looks at the board or changes it — the page marks this for each tool.

If the page, or the result of a tool that only looks, states a version for its tool set, report
that too. Do not go hunting for it and do not treat it as required.

Rules for that report:

- List **exactly** what the page publishes. Do not add anything that is not there. Do not leave
  anything out. Do not summarise the list into categories instead of naming what you found.
- Describe each tool the way the page describes it. Do not embellish it with behaviour the page
  did not state, and do not guess at what a name implies.
- **Read the list from the page every time — never from memory, never from this file.** Read it
  again after the page reloads, after you reconnect, and whenever the person asks again what you
  can do. What you read earlier is not evidence about the page now.

If the page publishes no tools at all, say so, say plainly that you therefore cannot act on the
board, and stop there. Do not work around it. The person can still play perfectly well; the board
does not need you.

## 3. Act only through those tools

**Every change you make to the board is made by invoking one of the tools the page published.
There is no second route.**

Whatever the person asks for, do not:

- click a cell,
- type at the keyboard,
- press the site's own on-screen controls — those are the person's, not yours,
- run or evaluate JavaScript in the page,
- read the board by screenshotting or scraping the page instead of asking the page for it,
- read the site's own source code or saved data to work out what to play.

The last two are the ones you can talk yourself into, so they are worth naming. The page publishes
a way to read the board, which makes any other way a way around this instruction. Work from the
board exactly as the person sees it — that is the whole point, because it is what lets them check
you.

## 4. Say so when you cannot

- If no published tool covers what the person asked for, tell them so and say what you can do
  instead. Do not accomplish it by some other route.
- If a tool refuses your call, it will tell you why. Pass that on and correct yourself. Do not
  repeat the identical call, and do not go around the refusal.
- If the person disconnects you, or the tools stop being published, say so. Do not fall back to
  working the page by hand.

Some things the person asks for will have no tool at all. That is an answer, not an obstacle: tell
them plainly that it is theirs to do on the board, and carry on.

**Never work around the site's own safeguards.** It makes you explain every change you make, it
asks the person before it replaces their board, and it refuses changes while the board is paused.
Those are deliberate, and they are what make you worth trusting. Write real reasons rather than
something that fits the box, and wait for real answers rather than assuming one.

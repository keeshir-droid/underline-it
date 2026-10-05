# Build agents for Underline

Four agents build this project, adapted from Day 3's (Doodle Alive). They're Claude Code subagents: each one is a Markdown file in this folder, and the main session hands work to them. All of them work from [`PLAN.md`](../../PLAN.md). §7 is the contract that keeps the two builders in step.

| Agent | Builds / does | Owns (only edits) | Can run commands? |
|---|---|---|---|
| [`engine-builder`](engine-builder.md) | Everything that touches the page: cleanup, line finding and snapping, the highlighter and underline, fade, the 4 finishes, the card and animation, sample page, image and video export, sharing; tests on real photos | `src/engine/`, `tests/lines.html`, `tests/engine/` | Yes: syntax checks, small Node tests, headless Edge screenshots |
| [`site-builder`](site-builder.md) | The screens, the swipe interaction and the warm-paper look | `index.html`, `src/app.js`, `src/styles.css` | No |
| [`integrator`](integrator.md) | Joins the two, runs the checks, fixes errors and the FAILs in VERIFY.md | Small fixes anywhere; `fonts/`, `tests/smoke.js`, `tests/page-check.js`, `.gitignore`, `.vercelignore`, `.gitattributes`, `vercel.json` | Yes |
| [`ui-verifier`](ui-verifier.md) | Screenshots every screen, finish, story frame and real photo, judges them, writes VERIFY.md. Never changes code | `VERIFY.md`, `shots/` | Yes: screenshots and curl only |

## The order to use them

1. **Before anything:**
   - Open the build session **inside this folder** (`underline/`) so these agents load.
   - Rishi starts the local server in a separate terminal, inside `underline/`, and leaves it running:
     ```bash
     python -m http.server 8000
     ```
     (Stop Doodle Alive's server first if it's still on port 8000.)
   - Rishi puts 3–5 real book-page photos in `tests/real/` (PLAN.md §8, M0).
2. **M1, the magic stroke:** `engine-builder` builds photo in, cleanup, line finding, snap, the highlighter and fade, plus `tests/lines.html`, and checks it on the real photos. The main session shows Rishi a full-size crop of the stroke on a real page. **Rishi says go or no-go.**
3. **M2 + M3, in parallel:** `engine-builder` (finishes, card, sample, underline mark) and `site-builder` (screens). They own different files, so they can run at the same time.
4. **Join:** `integrator` makes them fit and gets the checks passing.
5. **Check:** `ui-verifier` writes `VERIFY.md`.
6. **Fix loop:** `integrator` fixes the FAILs, then `ui-verifier` checks again. Repeat until clean.
7. **M4, export and sharing:** `engine-builder`, then steps 4–6 again.
8. **M5 (optional), Copy the words:** only if everything is done and verified. The main session downloads Tesseract.js with Rishi's okay first.
9. **Ship:** the main session handles git, GitHub, Vercel and the root README/CLAUDE.md updates (agents never push). Rishi tests on a real iPhone and Android and marks those rows "tested by hand" in `VERIFY.md`.

**Things agents can't do**, so the main session does them with Rishi's okay:
- downloading anything new (Tesseract.js)
- creating the GitHub repo, pushing, deploying, enabling analytics
- editing other projects (adding Underline to Day 2 and Day 3's footers)

## How agents work (for editing them)

- Claude Code picks these up **when the session is opened in the `underline` folder**.
- Each agent works in its **own fresh context** and doesn't see the main conversation. Everything it needs is in its file, PLAN.md, or the task it's given.
- If an agent's instructions conflict with PLAN.md, PLAN.md wins, and the conflict should be reported.
- After editing an agent file, start a new session (or reload agents) so the change is picked up.

File format:

```markdown
---
name: my-agent-name
description: When the main session should use this agent. Be specific; this is how it gets chosen.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
---

The agent's instructions, written to the agent.
```

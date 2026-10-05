# HANDOFF: building Underline (Day 4)

## Before you start (Rishi)

1. **Open a new Claude Code session in this folder:** `C:\creative technologist projects\underline`. The four agents in `.claude/agents/` only load when the session opens here.
2. **Put 3–5 real photos of book pages in `tests/real/`.** Take them the way you naturally would:
   - a bit crooked, in room light, a thumb in the shot
   - one close to the spine curve
   - one with small print
   - a paperback and a hardback if you can

   M1 is a go/no-go on these photos, and the build can't judge the stroke without them.
3. **Start the local server** in a separate terminal and leave it running. Stop Doodle Alive's server first if it's still on port 8000.
   ```bash
   cd "C:\creative technologist projects\underline"
   ```
   ```bash
   python -m http.server 8000
   ```
4. Paste the prompt below into the new session.

---

## The prompt to paste

```
You are the main session building Underline, Day 4 of my 21 Days of Creative Tech. Everything is planned. Your job is to coordinate the build with the agents in .claude/agents/ and get it right the first time.

Read first, fully: PLAN.md (the single source of truth), .claude/agents/README.md (the agents and the order to use them), and the root ../CLAUDE.md (project-wide rules, loaded automatically). Decisions are already made and listed at the top of PLAN.md. Don't reopen them.

How to run the build:
- Follow the order in .claude/agents/README.md exactly: M1 (engine-builder) → go/no-go with me → M2 + M3 in parallel (engine-builder + site-builder) → integrator → ui-verifier → fix loop → M4 → join/verify/fix again → M5 only if time allows → ship.
- Give each agent a precise task: the milestone, the PLAN.md sections it serves, and what "done" means. Agents don't see this conversation.
- After every agent finishes, read its report and open the key screenshots yourself before telling me it's done. "It passed" isn't proof; look at the actual output.
- M1 is the go/no-go. Show me a full-size crop of the highlighter on at least two of my real photos from tests/real/, plus the tests/lines.html screenshots, and wait for my "go" before M2/M3. If tests/real/ is empty, stop and ask me for photos. Don't build on the sample alone.
- Keep the load on my laptop light: one heavy command at a time, never several Edge windows at once, and never start or stop the local server (I run it on port 8000).
- Stay inside this folder. Don't edit other projects (Day 2 and Day 3 footers) without asking me.
- Ask me before: downloading anything (Tesseract.js for M5), creating the GitHub repo, pushing, deploying, enabling analytics.
- If an agent's instructions conflict with PLAN.md, PLAN.md wins. Tell me about the conflict.
- Explain things to me in plain English. After each milestone, give me a short update: what works, what I should look at, and what's still unverified.

Ship (M6, with my okay at each step):
- git init (with the .gitignore from PLAN.md §6.1; tests/real/ and shots/ must never be committed), create keeshir-droid/underline-it, push.
- Create the Vercel project "underline-it" (address underline-it.vercel.app) and turn on Web Analytics.
- Write README.md with the standard sections from the root CLAUDE.md.
- Update the root ../README.md and ../CLAUDE.md "Where we are" (Day 3 Doodle Alive live, Day 4 Underline) and change the audience line to say "young".
- Then hand me the real-phone checklist from VERIFY.md "Needs a real phone" (iPhone Safari, Instagram in-app browser, Android Chrome).

Start now: confirm the local server answers at http://localhost:8000, check tests/real/ has photos, then hand M1 to engine-builder.
```

---

## What "done" looks like
- See PLAN.md §10 for the full checklist.
- The short version: on a real phone, snap → swipe → Save works.
- The highlighter looks like real marker on your real page.
- The card lands in Photos with its label, and the story video posts to Instagram.
- It's live at `underline-it.vercel.app` with the footer and the made-with mark.

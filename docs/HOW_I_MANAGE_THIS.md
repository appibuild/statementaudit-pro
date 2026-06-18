# How I Manage This Project

**Plain-language routine. Read once; it becomes habit fast.**
**Last updated:** 2026-06-17

---

## The one idea that makes everything else simple

There is now **one master copy** of this project: the folder on your iMac (`statementaudit-pro`). That folder is the truth. Everything else — the Claude chat, any old artifact — is just a way of working *on* it. This is what stops the old problem where two copies drifted apart and the stored one got frozen at the original build.

---

## Where things live

```
statementaudit-pro/
  src/    ← the app code (statement-audit-pro.jsx)
  docs/   ← all documents: handovers, brief, instructions, guardrails, this file
  verify.sh   ← the start-of-session check
  VERSION     ← pinned facts about the current build
```

---

## Replace or keep? (the only filing rule you need)

**Look at the filename. Does it have a date in it?**

- **Has a date** (e.g. `STATEMENTAUDIT_HANDOVER_2026-06-17_2030.md`) → **KEEP it alongside the others. Never overwrite.** These are your history log.
- **No date** (e.g. `statement-audit-pro.jsx`, `00_START_HERE_REBUILD_BRIEF.md`, `VERSION`, `GUARDRAILS.md`) → **REPLACE the old one.** There's only ever one current version. (Git keeps the old one in history, so nothing is truly lost.)

That's it. Dated = keep. Undated = replace.

---

## Your routine for a working session (Option A — working in the Claude chat)

**At the start:**
1. Open Terminal. Type `cd ` then drag the `statementaudit-pro` folder onto the window. Press Enter.
2. Run: `bash verify.sh`
   - **Green / ALL CHECKS PASSED** → you're on the correct build. Continue.
   - **Red / FAILED** → stop. The file has drifted. Reconcile before working. (Paste the red message to me if unsure.)
3. In the Claude chat, upload the current `src/statement-audit-pro.jsx` so I'm looking at today's real code, not a stale copy.

**During the session:**
4. I make changes and hand you back the updated file(s).
5. You save each one into the iMac folder using the replace-or-keep rule above.

**At the end:**
6. If the code or any file changed, lock it into history. In Terminal:
   ```
   git add -A
   git commit -m "short description of what changed"
   ```
7. If the app's line count changed, update `expected_lines:` in `VERSION` before committing (so `verify.sh` keeps passing next time).
8. Upload the current files to the Claude project so the next new chat starts from the truth.

---

## Do I still save files into the Claude project?

Yes — but only as a **refresh**, and only the current (undated-or-newest) files, so that when you open a new chat I can see today's state. Think of it this way: the iMac folder is your filing cabinet; uploading to the project is showing me the current page when we sit down to work. The filing cabinet is the master; the upload is the courtesy copy.

---

## The one thing that breaks this

Don't *also* keep editing an old live artifact on the side. Pick the iMac folder as the single master and let the old artifact go. If you edit in two places, you recreate the exact drift problem with new names.

---

## When you're ready: Option B (VS Code + Claude Code)

Not now — only when the upload/download shuffling starts to annoy you.

**Claude Code** is a separate Anthropic tool that runs inside VS Code and can read and edit the files in this folder *directly* — no uploading, no copy-pasting. It can run `verify.sh` and `git commit` for you. That removes the manual steps (3, 5, 8 above).

The trade: a one-time install and learning a slightly different interface. It's the direction the standalone build points anyway, so it's a natural next step — just a *deliberate* one, taken when it earns its place, not because it sounds advanced.

When you want it, ask and I'll give you the install steps and a revised version of this routine for Option B.

---

*This file follows the same rule as everything else: it has no date in the name, so when it's updated, the new version replaces this one.*

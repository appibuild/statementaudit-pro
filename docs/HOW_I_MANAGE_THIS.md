# How I Manage This Project

**Plain-language routine. Read once; it becomes habit fast.**
**Last updated:** 2026-06-29 — Claude Code (Option B) is now the standard workflow; Option A retired.

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

## Your routine for a working session (Claude Code — current standard)

Claude Code runs inside VS Code and works directly with the files in this folder — no uploading, no copy-pasting. It runs `verify.sh` and `git commit` for you.

**At the start:**
1. Open the `statementaudit-pro` folder in VS Code.
2. Open Claude Code (sidebar or `⌘⇧P → Claude Code`).
3. Claude Code runs `bash verify.sh` at the start of every session automatically — confirm ALL CHECKS PASSED before any work.
   - **Red / FAILED** → stop. A file has drifted. Reconcile before working.

**During the session:**
4. Claude Code reads and edits the files directly — no file-shuffling needed.

**At the end:**
5. If anything changed, Claude Code commits for you. Or do it manually:
   ```
   git add -A
   git commit -m "short description of what changed"
   ```
6. If the line count changed, `VERSION` must be updated in the same commit (Claude Code handles this automatically).

---

## The one thing that breaks this

Don't also keep editing files in a Claude.ai chat artifact on the side. The iMac folder + git is the single master. If you edit in two places, you recreate the exact drift problem with new names.

---

*This file follows the same rule as everything else: it has no date in the name, so when it's updated, the new version replaces this one.*

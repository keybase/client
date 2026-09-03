---
name: address-pr-feedback
description: Use when asked to look at or address feedback on a PR. Fetches Copilot feedback from both inline threads and review bodies, skips hidden comments, then evaluates and fixes the valid ones.
---

# Address PR Feedback

## Step 1 — Fetch Copilot feedback

```bash
./.claude/skills/address-pr-feedback/get-copilot-feedback.sh [pr-number]
```

If no PR number is given, it uses the current branch's PR.

**Copilot reports findings in two different places, and the script reads both:**

1. **Inline review threads** — the classic form. Hidden comments (resolved threads, minimized
   comments) are skipped automatically. Outdated threads are still shown, tagged `[OUTDATED]`.
2. **Review bodies** — as of 2026-09 Copilot frequently posts `Comments generated: 0` and puts
   its real findings in the review body instead, under `### Suppressed comments`. These never
   appear as threads.

**An empty "Inline review threads" section does NOT mean the review was clean.** That is the
trap this skill exists to avoid: a thread-only query returns nothing and the PR looks unreviewed
when Copilot in fact filed a finding in the body. Always read both sections before concluding
there is no feedback. If both are empty, check that Copilot has actually reviewed
(`gh pr view <n> --json reviews`) rather than assuming it found nothing.

The script deliberately strips Copilot's per-file summary table — it restates the diff and
carries no findings. It keeps the headline verdict, the one-line concern beneath it, and the
suppressed-comments block.

## Step 2 — Evaluate each comment

For each finding:

1. **Verify** — read the current file and confirm the issue actually exists. Comments may already
   be fixed by later commits. For `[OUTDATED]` ones this matters most: the diff position moved,
   but the underlying issue often still exists — find the corresponding spot and evaluate there.
   A body finding cites `path:line` from an older push; re-locate it by symbol, not line number.
2. **Assess** — is it technically correct *for this codebase*? Push back with reasoning if not.
   Copilot's verdict line ("Needs a closer look") is not itself a finding; the substance is in
   the concern sentence and the suppressed comments.
3. **Fix** — edit the file if the feedback is valid, and mutation-check any test you add.

Do **not** post replies to GitHub comment threads. Just fix the code.

## Hidden = ignored

A comment is hidden only when its thread is resolved or minimized on GitHub. Those are skipped
automatically and need no action. Outdated is **not** hidden — evaluate those normally.

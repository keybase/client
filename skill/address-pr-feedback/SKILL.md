---
name: address-pr-feedback
description: Use when asked to look at or address feedback on a PR. Fetches Copilot-only inline comments, skips hidden ones, then evaluates and fixes the valid ones.
---

# Address PR Feedback

## Step 1 — Fetch Copilot feedback

```bash
./skill/address-pr-feedback/get-copilot-feedback.sh [pr-number]
```

If no PR number is given, it uses the current branch's PR. Only shows Copilot inline comments where `position != null` — hidden comments (outdated diff position) are ignored.

## Step 2 — Evaluate each comment

For each comment returned:

1. **Verify** — check the current file to confirm the issue actually exists. Comments may already be fixed by prior commits.
2. **Assess** — is the suggestion technically correct for this codebase? Push back with reasoning if not.
3. **Fix** — edit the file if the feedback is valid.

Do **not** post replies to GitHub comment threads. Just fix the code.

## Hidden = ignored

A comment is hidden when its diff position is outdated (the surrounding code changed after the comment was posted). These are skipped automatically by the script and require no action.

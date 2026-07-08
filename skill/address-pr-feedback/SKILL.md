---
name: address-pr-feedback
description: Use when asked to look at or address feedback on a PR. Fetches Copilot-only inline comments, skips hidden ones, then evaluates and fixes the valid ones.
---

# Address PR Feedback

## Step 1 — Fetch Copilot feedback

```bash
./skill/address-pr-feedback/get-copilot-feedback.sh [pr-number]
```

If no PR number is given, it uses the current branch's PR. Skips only hidden comments (resolved threads or minimized comments). Outdated comments are still shown, tagged `[OUTDATED]`.

## Step 2 — Evaluate each comment

For each comment returned:

1. **Verify** — check the current file to confirm the issue actually exists. Comments may already be fixed by prior commits. For `[OUTDATED]` comments this matters most: the diff position moved, but the underlying issue often still exists in the current code — find the corresponding spot and evaluate it there.
2. **Assess** — is the suggestion technically correct for this codebase? Push back with reasoning if not.
3. **Fix** — edit the file if the feedback is valid.

Do **not** post replies to GitHub comment threads. Just fix the code.

## Hidden = ignored

A comment is hidden only when its thread is resolved or the comment is minimized on GitHub. Those are skipped automatically by the script and require no action. Outdated is **not** hidden — evaluate those normally.

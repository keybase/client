---
name: merge-master
description: Use when periodically merging upstream master commits into a long-running refactor branch where code has moved, been renamed, or restructured — guiding careful per-commit analysis and transplant rather than a raw git merge.
---

# Merge Master into Refactor Branch

Use this skill when you need to bring upstream `master` changes into a long-running refactor branch. A raw `git merge master` often produces conflicts in code that has moved or been restructured. Instead, analyze each master commit individually and apply the equivalent change to wherever that code now lives.

## Find the Last Merge Point

```bash
# Find the last time master was merged into this branch
git log --oneline --merges | grep -i master | head -3
# Note the commit hash and date
git log <hash> --format="%ai %s" -1
```

## Get New Master Commits Since Last Merge

```bash
# Find the master commit that was merged last time (parent 2 of the merge commit)
git log <last-merge-hash>^2 --oneline -1

# List all master commits since then, oldest first
git log <master-tip-at-last-merge>..origin/master --oneline --reverse
```

## Per-Commit Analysis

For each commit in master since the last merge:

1. **Inspect the diff:**
   ```bash
   git show <commit> --stat
   git show <commit> --name-only   # full file list first
   git show <commit>               # full diff
   ```

2. **Determine applicability.** A commit may:
   - Already be logically applied (equivalent refactor done on this branch)
   - Not be relevant (area this branch doesn't touch)
   - Need transplanting (bug fix, API change, dep update that still applies)

3. **Locate the target.** Files may have moved. Use search:
   ```bash
   cd shared && grep -r "functionName\|ClassName" --include="*.ts" --include="*.tsx" -l
   ```

4. **Apply the equivalent change** — not a copy-paste of the diff, but the same *intent* applied to the current structure. Common cases:
   - **Dep update in `package.json`:** Apply same version bump (never downgrade)
   - **Bug fix in moved file:** Find where logic now lives, apply same fix
   - **New util/helper added:** Add it to the equivalent location in the refactored structure
   - **Config/type change:** Find all usages in the branch and update accordingly

5. **Cover ALL file types.** A single commit often touches multiple languages. For each commit, verify you've addressed every file in `git show <commit> --name-only` — TS/TSX, Go, Kotlin, Swift, Java, tests, etc. Missing one language (e.g. applying TS changes but skipping Go) is a common failure mode.

## When to Stop and Ask

Stop and ask the user before proceeding when:
- The master commit's target code no longer exists in the refactor branch and it's unclear if the change was superseded or just removed
- The fix logic conflicts with the refactor's new design (different interface, different data flow)
- Multiple master commits appear to be part of one logical change but their targets have diverged differently
- A commit touches a large surface area and partial application would leave things inconsistent

State clearly: what the master commit does, where you expected to find it, and what you found instead.

## Skipping Commits

If a commit is already applied or clearly irrelevant, document the skip inline:
```
SKIP <hash> "<title>" — reason (already applied in <our-commit> / not relevant)
```

## Final Cross-Reference Check

Before validating, do a completeness pass to catch anything missed:

```bash
# 1. List every file touched across ALL master commits being merged
git show <commit1> <commit2> ... --name-only | sort -u

# 2. For each file, confirm one of:
#    - Applied: we made an equivalent change
#    - Skipped: documented reason (already done / not relevant)
#    - N/A: the feature doesn't exist in our branch and that's intentional
```

Work through this list explicitly, file by file. If any file has no status, investigate before marking done.

## Validation

After all commits are processed:

**TypeScript** (from `shared/`):
```bash
yarn lint
yarn tsc
```

**Go** (from `go/`):
```bash
go build ./...
```

Fix any issues before reporting done. If lint or tsc surfaces problems in unrelated code, note them separately — don't silently expand scope.

## Alternative: git merge + Conflict Resolution

For large batches of master commits, `git merge origin/master` can be more efficient — it surfaces exactly what conflicts:

```bash
git merge origin/master
# Resolve each conflict file using the skill logic:
# - Our branch's structure wins (keep our patterns, interfaces, imports)
# - Master's intent is applied (keep the new behavior/logic)
# - Never blindly accept "ours" or "theirs" — understand what each side does
git add <resolved-files>
git merge --continue
```

Use this approach when there are many commits and the conflict markers clearly show the divergence. Use the per-commit approach when conflicts are ambiguous or when you need to understand each change's intent before applying it.

## Merge History

| Date | Branch | Last master commit merged |
|------|--------|--------------------------|
| 2026-05-04 | nojima/HOTPOT-next-670-clean-2 | 0a255e2f88 (fix race on HUD after a command) |
| 2026-05-19 | nojima/HOTPOT-next-670-clean-2 | 44af33002554ea4f81d4bca766fe642ad154e883 (fix UI bugs) |
| 2026-05-26 | nojima/HOTPOT-next-670-clean-2 | ecfd22f61208ab37ec6c48e843f56c39fe128e4b (backport retry fixes) |
| 2026-05-29 | nojima/HOTPOT-next-670-clean-2 | 7c434a8686d2b6d2e38366b8675f360bbace9f34 (fix additional api retry args) |

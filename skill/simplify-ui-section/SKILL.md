---
name: simplify-ui-section
description: Use when asked to review, clean up, simplify, or restructure a directory or section of UI code — improving readability, organization, naming, and component design without changing behavior
---

# Simplify UI Section

## Overview

Good UI code is easy to read, has clear boundaries, and doesn't repeat itself. This skill is a structured approach to identifying and fixing structural problems in a group of related files.

**Core principle:** Read everything first, analyze thoroughly, ask before touching.

## Process

```dot
digraph simplify {
    "Read all files in scope" [shape=box];
    "Analyze across categories" [shape=box];
    "Ask clarifying questions" [shape=box];
    "Present findings" [shape=box];
    "User approves scope?" [shape=diamond];
    "Implement changes" [shape=box];

    "Read all files in scope" -> "Analyze across categories";
    "Analyze across categories" -> "Ask clarifying questions";
    "Ask clarifying questions" -> "Present findings";
    "Present findings" -> "User approves scope?" ;
    "User approves scope?" -> "Implement changes" [label="yes"];
    "User approves scope?" -> "Present findings" [label="revise"];
}
```

## Step 1: Read Everything First

Read **every file** in scope before forming opinions. Patterns only become visible across the full picture.

## Step 2: Analyze Across These Categories

### Duplications
- Same function/logic copy-pasted across files (especially data-transformation helpers, icon-resolution, RPC mapping)
- Same inline component repeated in multiple places
- Same style values repeated without a shared constant

### File Organization
- Tiny files (< 50 lines) that only export to one or two consumers — candidate for folding
- Files too large for their single responsibility — candidate for splitting
- Import directions that feel backwards (e.g., a detail screen importing from a list screen)

### Naming
- Generic component names (`Container`, `Wrapper`, `Inner`) — rename to what they actually are
- Exported symbols named differently from their file (`export default Container` from `row.tsx`)
- Context/hooks defined in a file that doesn't own them

### Component Hierarchy
- Wrapper components that add no logic — eliminate the layer
- Components split across files for no structural reason — candidate for collocating
- Deeply nested JSX that could flatten via composition

### Props and Styles
- Components with large prop lists where many props just pass through — consider composition or context
- Repeated style patterns across components that could become a shared style helper or `Kb.Styles` utility call
- Platform-conditional logic repeated in multiple components instead of being handled once
- Styles inlined at call sites instead of in the stylesheet

### Shared Helpers and Components
- Patterns used 2+ times that have no shared abstraction
- Icon resolution logic duplicated across screens
- Small display components (badges, labels, markers) defined inline multiple times

## Step 3: Ask Before Acting

Before presenting findings, ask these if the answers aren't obvious from the code:

1. **External consumers**: Are there files outside this directory importing these? (affects what can be renamed or removed)
2. **Off-limits files**: Any files that should not be changed?
3. **New files**: Is adding a new file for deduplication okay, or prefer keeping file count flat/lower?
4. **Priority**: Any specific problem the user wants addressed most?

## Step 4: Present Findings by Category

Group findings clearly. For each item include:
- What the problem is
- What the fix would be
- Any tradeoff or risk (e.g., circular import risk if moving a context)

Let the user confirm, skip, or redirect before implementing.

## Step 5: Implement

Make all approved changes. Remove unused imports, styles, and variables left behind. Run lint and tsc after.

## The Hard Line: No Behavior Changes

**This skill is structural only. Zero visual, UX, or behavior changes — ever.**

This means:
- No changes to rendered output, layout, spacing, or colors
- No changes to user-visible text, labels, or copy
- No changes to interaction flows, navigation, or state logic
- No "small improvements" to UX while you're in there
- No refactoring component logic even if it looks equivalent

If a simplification would change any of these things, **stop and discuss it first**. It is not in scope until the user explicitly validates it.

The only exception: if a behavior change is required to fix an outright bug discovered during the review. Raise it separately; do not bundle it with structural changes.

## What NOT to Do

- Don't propose changes that require understanding runtime behavior (don't guess at logic equivalence)
- Don't add new abstractions unless there are 2+ concrete uses already
- Don't move things that would create circular imports
- Don't rename exports that have external consumers without confirming first
- Don't collapse files that serve genuinely different concerns just because they're small

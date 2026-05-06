---
name: react-effect-lints
description: Use when fixing React hook lint failures in the Keybase client: react-hooks/set-state-in-effect, derived-state effects, prop-change resets, event-hidden-in-effect, stale async results.
---

# React Effect Lints

Fix the cause of React effect lint errors, not the diagnostic. Target: less state, fewer effects, same behavior.

Effects are usually wrong for transforming props/state for render, resetting state because props changed, or running logic caused by a user event. A fix that wraps `setState` in `setTimeout`, `Promise.resolve`, `queueMicrotask`, or `deferEffectUpdate` is almost always a workaround, not a fix.

References:

- React: `https://react.dev/learn/you-might-not-need-an-effect`
- React lint: `https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect`

## Workflow

1. Read the whole component and identify what the effect is trying to model.
2. Match the effect to a pattern below and apply the refactor.
3. Preserve guards, platform branches, route behavior, stale-async protection, memoization, and stable prop identity. Do not move hook or component logic to module scope to avoid a lint — module-level work runs at import time and can leak across accounts, routes, tests, or remounts.
4. When working from a plan with batches, do exactly one batch per turn, validate, update the checklist, then stop.
5. Remove now-unused imports, state, refs, helpers, styles, and type parameters.
6. Do not run `yarn`, `npm`, lint, or TypeScript unless `node_modules` exists and the user's machine guidance allows it.

## Refactor Patterns

### Derived Render Data

Delete state and effects that only mirror values from props, store selectors, or other state.

```tsx
// Avoid
const [visibleItems, setVisibleItems] = React.useState<Array<Item>>([])
React.useEffect(() => {
  setVisibleItems(items.filter(item => item.enabled))
}, [items])

// Prefer
const visibleItems = items.filter(item => item.enabled)
```

This repo uses React Compiler — do not add `useMemo` by default. Use it only when a calculation is demonstrably expensive or memo identity is required.

### Initial State Only

If a prop only seeds local state and later prop changes should not reset user edits, use a lazy initializer. Delete effects that keep rewriting local state from the prop.

```tsx
const [draft, setDraft] = React.useState(() => initialDraft)
```

If changing the prop *should* reset the form or modal, use the keyed reset pattern instead.

### Reset All State On Identity Change

When a route, username, conversation ID, team ID, or other identity means "this is a different instance", key the inner component.

```tsx
const Outer = (props: Props) => <Inner key={props.conversationIDKey} {...props} />

const Inner = (props: Props) => {
  const [draft, setDraft] = React.useState('')
  // ...
}
```

Keep exported component names stable unless callers need a new export.

### Adjust Part Of State On Input Change

First try to store a stable ID and derive the selected object during render — this often removes the need to reset selection at all.

If a prop sometimes controls a value and otherwise the component owns it, derive the visible value during render:

```tsx
const [internalTab, setInternalTab] = React.useState<Tab>('members')
const selectedTab = props.tab ?? internalTab
```

```tsx
const [selectedID, setSelectedID] = React.useState<string | undefined>()
const selected = items.find(item => item.id === selectedID)
```

If partial adjustment is unavoidable, React allows guarded state updates during render for the same component. Use this sparingly, always with a previous-value guard, and never for side effects.

```tsx
const [prevItems, setPrevItems] = React.useState(items)
const [selectedID, setSelectedID] = React.useState<string | undefined>()
if (items !== prevItems) {
  setPrevItems(items)
  setSelectedID(undefined)
}
```

Do not update another component's state during render. Move timers, navigation, RPCs, logging, and DOM/native work to events or effects.

### User-Event Consequences

Put logic in the event handler if it happens because a user clicked, submitted, selected, dismissed, or navigated. Do not infer the event later from a state flag in an effect.

Good candidates: submit RPCs, notifications, navigation from a tab or menu item, clearing waiting state before a mutation.

Effects can still observe external completion of the event (e.g. waiting changing from true to false). Track previous waiting state with a ref when needed.

### External Synchronization And Async Requests

Keep effects for timers, subscriptions, imperative DOM/native APIs, RPCs keyed by reactive inputs, and updating external stores.

For async work, tag loaded data with the input key and derive the visible value during render to avoid stale data flashes.

```tsx
type Loaded = {key: string; value: Result}
const [loaded, setLoaded] = React.useState<Loaded | undefined>()
const visible = loaded?.key === requestKey ? loaded.value : undefined

React.useEffect(() => {
  let canceled = false
  load(requestKey).then(value => {
    if (!canceled) setLoaded({key: requestKey, value})
  })
  return () => { canceled = true }
}, [requestKey])
```

Prefer request/version IDs over `isMounted` refs for stale result rejection. If a real mount guard is needed, set it true inside the effect and false in cleanup so Strict Mode remounts don't leave it stuck false.

For timer UI: derive open/closed visibility from current props rather than mirroring into state. Keep cached text only when intentionally delaying removal for an animation.

## Keybase-Specific Checks

- Use `Kb.*` components in `.tsx` files under `shared/`; guard any raw DOM with platform constraints.
- Do not mutate Zustand stores with `useXState.setState` or `getState()` writes; route through dispatch actions.
- When reading multiple values from one store, use `C.useShallow(...)`.
- Use `React.useEffectEvent` for stable callbacks called from effects or subscriptions; use `React.useLayoutEffect` for ref assignment when event handlers need the latest callback after commit. Keep `useEffectEvent` functions out of dependency arrays.
- Do not add lint disables. Fix the state shape, effect purpose, or dependencies.
- Do not add exported helpers unless another file needs them.

## Common Non-Effect Lints Nearby

While touching these files:

- Restore missing exports or stop importing them; do not export undefined placeholders.
- For generic caches, preserve literal key types rather than accidentally widening them.
- Import `@/constants/types` as a value import (not `import type`) when `T.*` is used at runtime.

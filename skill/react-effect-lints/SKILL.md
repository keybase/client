---
name: react-effect-lints
description: Use when fixing React hook lint failures in the Keybase client, especially `react-hooks/set-state-in-effect`, derived-state effects, prop-change reset effects, event logic hidden in effects, async stale-result effects, or requests that reference React's "You Might Not Need an Effect" guidance.
---

# React Effect Lints

Use this skill to fix the cause of React effect lint errors, not to hide the diagnostic.
The default target is less state, fewer effects, and the same user-visible behavior.

React's rule of thumb:

- Effects synchronize React with external systems: subscriptions, timers, imperative APIs, DOM/native APIs, and async requests.
- Effects are usually wrong for transforming props/state for render, resetting state because props changed, or running logic caused by a user event.
- A fix that wraps `setState` in `setTimeout`, `Promise.resolve`, `queueMicrotask`, or a helper such as `deferEffectUpdate` is almost always a lint workaround, not a fix.

Authoritative references:

- React: `https://react.dev/learn/you-might-not-need-an-effect`
- React lint: `https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect`

## Workflow

1. Read the whole component and identify what the effect is trying to model.
2. Classify the effect before editing:
   - Derived render data
   - Initial state only
   - Reset all state on identity change
   - Adjust part of state on input change
   - User-event consequence
   - External synchronization or async request
3. Prefer the matching refactor pattern below.
4. Preserve existing guards, platform branches, waiting keys, route behavior, and stale async protection unless proven dead.
5. Do not move hook or component logic to module scope to avoid a lint. Module-level work runs at import time, bypasses React lifecycle and providers, and can leak behavior across accounts, routes, tests, or remounts.
6. When working from a plan that groups lint fixes into batches, do exactly one batch per turn. After validating and updating the checklist for that batch, stop and report the result instead of starting the next batch.
7. Remove now-unused imports, state, refs, helpers, styles, and type parameters.
8. In this repo, do not run `yarn`, `npm`, lint, or TypeScript unless `node_modules` exists and the user's machine guidance allows it.

## Refactor Patterns

### Derived Render Data

Delete state and effects that only mirror values already available from props, store selectors, or other state.
Calculate the value during render.

```tsx
// Avoid
const [visibleItems, setVisibleItems] = React.useState<Array<Item>>([])
React.useEffect(() => {
  setVisibleItems(items.filter(item => item.enabled))
}, [items])

// Prefer
const visibleItems = items.filter(item => item.enabled)
```

Use `React.useMemo` only when a calculation is demonstrably expensive or memo identity is required for compatibility.
This repo uses React Compiler, so do not add `useMemo` by default.

### Initial State Only

If a prop only seeds local state and later prop changes should not reset user edits, use a lazy initializer or direct initializer.
Delete effects that keep rewriting the local state from the prop.

```tsx
const [draft, setDraft] = React.useState(() => initialDraft)
```

Confirm this is really "initial only"; if changing the prop should reset the form or modal, use the keyed reset pattern.

### Reset All State On Identity Change

When a route, username, conversation ID, team ID, or other identity means "this is a different instance", split the component and key the inner component.
This resets all descendant state before children render with stale values.

```tsx
const Outer = (props: Props) => <Inner key={props.conversationIDKey} {...props} />

const Inner = (props: Props) => {
  const [draft, setDraft] = React.useState('')
  // ...
}
```

Use this for modals or screens whose local form state should restart when the entity changes.
Keep exported component names stable unless callers need a new export.

### Adjust Part Of State On Input Change

First try to store a stable ID and derive the selected object or validity during render.
This often removes the need to reset selection at all.

```tsx
const [selectedID, setSelectedID] = React.useState<string | undefined>()
const selected = items.find(item => item.id === selectedID)
```

If partial adjustment is unavoidable, React allows guarded state updates during render for the same component.
Use this sparingly, always with a previous-value guard that prevents loops, and never for side effects.

```tsx
const [prevItems, setPrevItems] = React.useState(items)
const [selectedID, setSelectedID] = React.useState<string | undefined>()
if (items !== prevItems) {
  setPrevItems(items)
  setSelectedID(undefined)
}
```

Do not update another component's state during render.
Move timers, navigation, RPCs, logging, and DOM/native work to events or effects.

### User-Event Consequences

If logic happens because a user clicked, submitted, selected, dismissed, or navigated, put that logic in the event handler or a function called by event handlers.
Do not infer the event later from a state flag in an effect.

Good candidates:

- Submit RPCs
- Notifications caused by a button press
- Navigation caused by a selected tab or menu item
- Clearing waiting state before starting a mutation

Effects can still observe external completion of the event, such as waiting changing from true to false.
Track previous waiting state with a ref when needed.

### External Synchronization And Async Requests

Keep effects when they synchronize with an external system:

- Timer setup and cleanup
- Subscriptions and listeners
- Imperative DOM/native APIs
- RPCs or fetches keyed by reactive inputs
- Updating external stores from a callback or subscription

For async work, protect against stale results with a request ID or cleanup guard.
Do not start an effect with a synchronous reset just to avoid showing stale data.
Instead, tag loaded data with the input key and derive the visible value during render.

```tsx
type Loaded = {key: string; value: Result}
const [loaded, setLoaded] = React.useState<Loaded | undefined>()
const visible = loaded?.key === requestKey ? loaded.value : undefined

React.useEffect(() => {
  let canceled = false
  load(requestKey).then(value => {
    if (!canceled) {
      setLoaded({key: requestKey, value})
    }
  })
  return () => {
    canceled = true
  }
}, [requestKey])
```

Prefer request/version IDs over broad `isMounted` refs when rejecting stale async results.
If a real mount guard is required, set it true inside the effect body and false in cleanup so Strict Mode remounts do not leave it stuck false.

### Timers And Delayed UI

Timers are external synchronization, but state that is immediately derivable from current props should still be render-derived.
Common fixes:

- Derive open/closed visibility from the current error or pending timer state.
- Keep cached text only when intentionally delaying removal for an animation or timeout.
- Set up and clear the timer in an effect, but avoid a synchronous "mirror prop into state" update in the effect body.

## Keybase-Specific Checks

- Plain `.tsx` files under `shared/` should use `Kb.*` components, not raw DOM, unless the file already has desktop-only DOM guarded by platform constraints.
- Components must not mutate Zustand stores directly with `useXState.setState` or `getState()` writes; route through dispatch actions.
- When reading multiple adjacent values from one store hook, prefer a consolidated selector with `C.useShallow(...)`.
- Keep `useEffectEvent` functions out of dependency arrays; depend on the real reactive values instead.
- Do not add lint disables. Fix the state shape, effect purpose, or dependencies.
- Do not add exported helpers unless another file needs them.

## Common Non-Effect Lints Nearby

Fix TypeScript cleanup errors while touching the same files:

- Remove unused locals instead of assigning them to dummy values.
- If an export is missing, either restore the real implementation or stop exporting/importing it; do not export an undefined placeholder.
- For generic caches, preserve literal key types instead of widening them accidentally.
- If `T.*` is used as a runtime value, import `@/constants/types` as a value import, not `import type`.

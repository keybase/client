---
name: zustand-store-pruning
description: Use when refactoring Keybase Zustand stores in `shared/stores` to remove screen-local or route-owned state, keep only truly global or cross-screen data in the store, move one-off RPC calls into components with `C.useRPC`, and split the work into safe stacked commits.
---

# Pruning Zustand Stores

Use this skill for store-by-store cleanup in the Keybase client. The goal is to shrink `shared/stores/*` down to state that is genuinely global, notification-driven, or shared across unrelated screens.

Do not silently drop behavior. If a field or action is ambiguous, state the tradeoff and keep the behavior intact.

## Best Targets First

Start with small settings or wizard stores that mix form state and RPC orchestration:

- `shared/stores/settings-email.tsx`
- `shared/stores/settings-phone.tsx`
- `shared/stores/settings-password.tsx`
- `shared/stores/recover-password.tsx`
- `shared/stores/logout.tsx`

Defer large or clearly global stores unless the user explicitly wants them:

- `shared/stores/config.tsx`
- `shared/stores/current-user.tsx`
- `shared/stores/router.tsx`
- `shared/stores/waiting.tsx`
- `shared/stores/convostate.tsx`
- `shared/stores/fs.tsx`
- `shared/stores/teams.tsx`

See [keybase-examples.md](references/keybase-examples.md) for store-specific guidance.
Use [store-checklist.md](references/store-checklist.md) to track which stores are untouched, in progress, or done.

## Triage Rules

Classify every store field and action before editing.

Keep it in the store if it is:

- Shared across multiple unrelated screens or tabs
- Updated by engine notifications, daemon pushes, or other background events
- Needed outside React components or used for cross-store coordination
- A long-lived cache keyed by usernames, team IDs, conversation IDs, paths, or other global entities
- Awkward or lossy to pass through navigation because it must survive independent screen entry points

Before keeping a cache just because several screens read it, ask whether reloading is good enough. For Keybase daemon-backed data, many RPCs are local and cheap, so a component-level reload on screen entry is often preferable to preserving store state.

Move it to component state if it is:

- Form input text, local validation errors, banners, or submit progress
- Temporary selection, highlight, filter, or sort state
- Wizard-step state that only matters while one screen or modal is mounted
- A one-shot RPC result only used by the current screen
- Reset on every screen entry and not meaningful elsewhere

Move it to route params if it is:

- Data screen A already knows and screen B only needs for that navigation
- A modal confirmation payload such as IDs, usernames, booleans, or prefilled values
- Entry context that should be explicit in navigation rather than hidden in a global store

Move RPC calls out of the store if:

- The RPC is initiated by a screen and its result only updates that screen
- The RPC was only stored so the screen could call `dispatch.someAction()`
- Failure and waiting state are screen-local

Keep RPC logic in the store if:

- It services notification handlers or global refresh flows
- It fans results out to multiple screens
- It maintains a shared cache that survives navigation

Prefer reloading in components instead of keeping a store cache when:

- The data comes from the local service and reload latency is acceptable
- The cache only saves a small RPC but forces unrelated screens to coordinate through global state
- The notification path only exists to keep that convenience cache warm

## Refactor Workflow

### 1. Pick one store and map consumers

From `shared/`, find the store hook, its selectors, and its dispatch callers with `rg`.

Look for:

- Components reading store fields
- Components calling `dispatch.*`
- Notification handlers keeping the store in sync
- Navigation calls that could carry explicit params instead

### 2. Build a keep-or-move table

For each field and action, label it:

- `keep-global`
- `move-component`
- `move-route`
- `delete-derived`
- `unsure`

Do this before writing code. If several fields move together, migrate that whole screen flow in one pass.

### 3. Move screen-owned RPCs into components

Prefer `C.useRPC` when the RPC belongs to the current screen:

```tsx
const loadThing = C.useRPC(T.RPCGen.someRpcPromise)

loadThing(
  [rpcArgs, waitingKey],
  result => {
    setLocalState(result)
  },
  err => {
    setError(err.message)
  }
)
```

Keep waiting keys when they drive UI. If the store only existed to wrap that RPC, remove the wrapper action after consumers are updated.

### 4. Move per-screen flow state into components

Use `React.useState`, `React.useEffect`, and existing screen hooks. In plain `.tsx` files, use `Kb.*` components rather than raw DOM elements.

If a component reads multiple adjacent values from the same remaining store, prefer one selector with `C.useShallow(...)` over several subscriptions.

### 5. Move navigation-owned data into params

Use existing typed navigation patterns:

```tsx
navigateAppend({name: 'someScreen', params: {foo, bar}})
```

Read params in the destination screen with the existing route helpers, for example:

```tsx
const {params} = useRoute<RootRouteProps<'someScreen'>>()
```

Keep params limited to explicit entry context. Do not recreate a hidden global store inside the route object.

### 6. Collapse the store

After consumers move off the store:

- Delete dead fields, actions, helpers, imports, and tests
- Remove unused notification plumbing only if behavior is preserved
- Keep reset behavior coherent for whatever remains
- Preserve public store names unless there is a strong reason to rename them

If nothing meaningful remains after moving screen-owned data out, delete the store entirely instead of leaving a one-field convenience cache behind.

## Commit Shape

Prefer one stacked commit per store. Each commit should be reviewable on its own:

1. Pick one store and one user-visible flow.
2. Move local state and route-owned data to the component layer.
3. Move screen-owned RPC calls to `C.useRPC`.
4. Remove dead store fields and actions.
5. Update or prune store tests that no longer apply.

Do not mix multiple unrelated stores into one commit unless they are tightly coupled and impossible to review separately.

## Validation

On this machine, `node_modules` is not installed for this repo. Do pure code work only.

Still validate by inspection:

- Read all updated call sites
- Confirm no component still selects removed state or dispatches removed actions
- Confirm route param names line up between navigation and destination screens
- Confirm notification handlers still land somewhere intentional

If the refactor removes a store test, explain why the behavior moved to the component layer.

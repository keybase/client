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

Notification-fed UI does not automatically make state global. If a notification only updates a transient banner or screen-local status, keep the trigger where it already lands but move the rendered UI state into the owning screen unless multiple unrelated entry points truly need to read it.

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

Do not introduce module-level mutable state to preserve store behavior. If a refactor needs ephemeral bookkeeping that is private to one store, keep it inside the store closure or model it explicitly in store state. Module scope is acceptable for stable constants, pure helpers, and imports, not mutable coordination state.

Prefer reloading in components instead of keeping a store cache when:

- The data comes from the local service and reload latency is acceptable
- The cache only saves a small RPC but forces unrelated screens to coordinate through global state
- The notification path only exists to keep that convenience cache warm

Prefer direct store imports instead of `shared/constants/init/shared.tsx` callback plumbing when:

- A store's `dispatch.defer.*` callback exists only to forward to another Zustand store
- The target store is leaf-like and does not import the calling store back
- The callback does not need platform-specific override behavior
- The callback does not exist to break a real import cycle

Keep init-time callback plumbing when:

- The direct import would introduce a store cycle or make one more likely
- The callback is intentionally abstracting a platform split or runtime override
- The callback bundles several stores behind one bootstrap seam that still matters

For Keybase repo cleanup, this usually means:

- If `chat`, `teams`, `tracker`, `team-building`, `push`, or similar stores are only calling into leaf stores like `users`, `daemon`, or `settings-contacts`, prefer `useLeafStore.getState()` directly
- Treat `shared/constants/init/shared.tsx` as a smell when it is only wiring one store method straight into another
- After replacing the direct call sites, delete the matching `defer` field types, default throwers, init wiring, dead imports, and any now-empty init helper

Concerns to check before making this change:

- Search both directions with `rg` to confirm the target store does not already import the caller
- Check `store-registry.tsx`, dynamic `require(...)`, and platform-split files before assuming a store is leaf-safe
- Preserve bootstrap-only behavior that is still real; do not remove an init helper if it still wires unrelated callbacks
- Update tests and desktop/native stubs that may still reference the old `defer` field
- Keep the remaining `defer` surface coherent; if a store's `defer` object becomes empty, remove the field rather than leaving dead scaffolding behind

For listener-driven multi-step flows, separate callback plumbing from UI state:

- If `incomingCallMap` or `customResponseIncomingCallMap` only need to keep live response handlers across navigation, move banners, form state, and selections out of the feature store first
- Keep those live handlers in a dedicated transient handle module such as `shared/stores/flow-handles.tsx`, not in a feature store field or a per-feature singleton map
- Model the shared handle module after existing `dispatch.dynamic.*` patterns: use an `owner` plus `slot` for named handlers, and keyed one-shot registrations for cases like confirm screens that need an opaque token in route params
- Add thin feature-local wrappers next to the flow, for example `registerResetPrompt` or `submitResetPrompt`, so most call sites stay typed and readable
- Register the module's `clearAll` with the shared reset plumbing so `resetAllStores()` clears these runtime handles too
- Do not put screen data, waiting state, validation errors, or caches into the transient handle module. It is only for live callbacks or resolvers that must survive route changes

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

Also label cross-store callback seams:

- `keep-init-plumbing`
- `replace-direct-import`

Use `replace-direct-import` when a `dispatch.defer.*` field only forwards to a leaf-like store and there is no import-cycle risk.

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

If a helper hook, pure helper, or constant is only used by one component or one file, define it in that file instead of creating a sibling module. Split code out only when it is shared across files or the extracted boundary is meaningfully clearer than simple colocation.

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
- Delete dead component-level leftovers created during the move, including unused params, temporary aliases, and underscore-prefixed placeholders that no longer serve a purpose
- Remove unused notification plumbing only if behavior is preserved
- Keep reset behavior coherent for whatever remains
- Preserve public store names unless there is a strong reason to rename them

After removing init callback plumbing:

- Delete the matching `dispatch.defer` type entries
- Delete the matching default throw implementations
- Delete `shared/constants/init/shared.tsx` wiring for those callbacks
- Delete now-empty init helpers and their startup calls
- Delete stale imports left behind in both the store and `shared.tsx`

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

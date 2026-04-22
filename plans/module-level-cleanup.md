# Module-Level Cleanup

Reference skill: `skill/zustand-store-pruning/SKILL.md`

## Summary

Remove module-scope mutable state introduced during the Zustand cleanup series.

For this repo cleanup, treat all module-level mutable coordination as out of bounds:

- no module-level caches
- no module-level in-flight request maps
- no module-level listener registries
- no module-level popup handler singletons
- no `useSyncExternalStore(...)` snapshots backed by module variables

If state truly needs app-wide lifetime, keep it in an explicit store and document why. If it only needs route lifetime, move it into a feature-local provider or the owning mounted component.

## Current Targets

### 1. Chat Team Hooks

- [ ] `shared/chat/conversation/team-hooks.tsx`
- Current module-level mutable state to remove:
  - `chosenChannelsStoreState`
  - `chosenChannelsInFlight`
  - `chosenChannelsLoadedAt`
  - `chosenChannelsListeners`
  - `chatTeamnameVersion`
  - `chatTeamnameCache`
  - `chatTeamnameRequests`
  - `chatTeamnameVersions`
  - `chatTeamHooksUsername`
- Current hidden-store behaviors:
  - chosen-channels badge state is implemented as a module-level external store
  - teamname lookups are cached and deduped in module scope
  - per-user resets are coordinated through a module-scope username sentinel

### 2. Pinentry Remote Popup Bridge

- [x] `shared/pinentry/desktop-popup-handles.tsx`
- [x] integration in `shared/pinentry/remote-proxy.desktop.tsx`
- [x] integration in `shared/desktop/renderer/remote-event-handler.desktop.tsx`
- Current module-level mutable state to remove:
  - `handlers`
  - `resetListeners`
- Current hidden-store behaviors:
  - remote window actions are routed through a singleton callback registry
  - popup reset coordination is routed through a module listener set

### 3. Tracker Remote Popup Bridge

- [x] `shared/tracker/desktop-popup-handles.tsx`
- [x] integration in `shared/tracker/remote-proxy.desktop.tsx`
- [x] integration in `shared/desktop/renderer/remote-event-handler.desktop.tsx`
- Current module-level mutable state to remove:
  - `handlers`
- Current hidden-store behaviors:
  - remote window actions are routed through a singleton callback registry

## Guiding Rules

- Do not replace a Zustand store with a hidden module-scope store.
- Do not use module-level `Map`, `Set`, `let`, or listener collections for feature state, request dedupe, or cross-component coordination.
- If multiple mounted descendants on one route need shared loaded data, use a feature-local provider.
- If a remote window flow needs cross-file coordination, route it through an explicit owner with a documented lifetime, not a bare module singleton.
- Keep request-version guards local with `useRef(...)` inside the owning hook or component.
- When a state owner changes, keep its reset path equally explicit. Do not rely on a module resetter to clean up hidden state later.

## Chunk 1: Remove Hidden Chat Team Stores

- [ ] Split `team-hooks.tsx` into provider-owned state and pure helper functions
- [ ] Move chosen-channels badge state into a mounted owner
  - likely a conversation/team feature provider
  - no module-level `useSyncExternalStore(...)` snapshot
- [ ] Move teamname loading out of module cache state
  - either provider-owned loaded state
  - or direct per-consumer loads if duplication is acceptable
- [ ] Remove the module-level per-user reset sentinel
  - user changes should reset provider/local state through React ownership, not `chatTeamHooksUsername`
- [ ] Delete all chosen-channels and teamname module variables after consumers are moved

### Validation for Chunk 1

- [ ] chat info panel still renders permissions and team metadata correctly
- [ ] manage-channels badge still reloads and dismisses correctly
- [ ] teamname lookups still refresh on team rename / exit / delete
- [ ] no module-level mutable state remains in `chat/conversation/team-hooks.tsx`

## Chunk 2: Remove Pinentry Singleton Routing

- [x] Delete `shared/pinentry/desktop-popup-handles.tsx`
- [x] Rework remote action routing so pinentry submit/cancel reaches an explicit mounted owner
- [x] Keep popup state and callback ownership in one place
- [x] Remove module-level reset listener plumbing
- [x] Replace singleton-specific tests with owner-scoped behavior tests

### Design constraint for Chunk 2

- The replacement must not use another module-level singleton such as a new handle map, listener set, or flow registry.
- If app-wide lifetime is genuinely required, use an explicit existing store/action seam and document why that lifetime is necessary.

## Chunk 3: Remove Tracker Singleton Routing

- [x] Delete `shared/tracker/desktop-popup-handles.tsx`
- [x] Rework remote action routing so tracker follow/ignore/close/load reaches an explicit mounted owner
- [x] Keep popup state and remote-action handling owned by the tracker popup feature
- [x] Replace singleton-specific tests with owner-scoped behavior tests

### Design constraint for Chunk 3

- The replacement must not use another module-level singleton such as a new handle map, listener set, or flow registry.
- If app-wide lifetime is genuinely required, use an explicit existing store/action seam and document why that lifetime is necessary.

## Chunk 4: Sweep Plans And Follow-Up Work

- [x] Update the active cleanup plans when a module-level singleton is removed
- [x] Re-scan changed files for module-scope mutable state before landing follow-up cleanup work
- [ ] Reject any new cleanup patch that reintroduces hidden module-level state as a shortcut

## Validation

- [ ] `rg -n "^(let |const .* = new (Map|Set)\\(|const .*Listeners = new Set\\()"`
- [ ] No branch-introduced cleanup code relies on module-level mutable state for feature ownership
- [ ] Any remaining module-level mutable state is explicitly reviewed and documented as pre-existing or unrelated

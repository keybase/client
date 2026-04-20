# Engine Listener Migration

## Summary

Add a typed engine action subscription layer so feature components can react directly to ephemeral engine events without inventing one-field Zustand stores or `init/shared.tsx` forwarding shims.

This is for screen-local refreshes, prompts, and transient session reactions. It is not a replacement for durable shared caches or notification-backed global state.

## Current Primitive

- [x] Add `shared/engine/action-listener.tsx` with:
  - `subscribeToEngineAction(type, listener)`
  - `useEngineActionListener(type, listener)`
  - `notifyEngineActionListeners(action)`
- [x] Dispatch those listeners from `shared/constants/init/shared.tsx` after existing global/store fanout
- [x] Convert `people` off the temporary refresh bridge and onto direct engine subscription

## Migration Rules

Use the engine listener layer when all of these are true:

- The engine action is an ephemeral nudge or prompt for one feature
- The UI can safely miss the event while unmounted because it reloads on focus/mount or because the prompt only matters while visible
- The action does not need to mutate durable shared state for other screens

Keep store-owned engine handling when any of these are true:

- The action updates long-lived shared caches, badges, unread counts, or background state
- The app must retain the effect even while the screen is unmounted
- Several unrelated features need the same derived state

## Candidate Audit Order

- [x] `people`
- [x] `tracker` transient identify/session events
  - `identify3ShowTracker` and related identify session updates now subscribe from the desktop tracker proxy instead of `init/shared.tsx`
  - The tracker store was removed; desktop popup state now lives in the proxy and profile screens reload from service-backed hooks instead of keeping a durable tracker cache warm
- [ ] `pinentry`
  - Evaluate whether the prompt ownership can move to a feature-local listener plus flow handles
  - Keep the current store if the response/session lifecycle still needs a global owner
- [ ] `archive`
  - Re-check whether archive progress/jobs truly need store persistence or can become screen-owned reload state
- [ ] `unlock-folders`
  - Compare existing direct engine handling against the new listener layer and decide whether unification adds value

## Explicit Non-Targets For Now

- `config`
- `notifications`
- `chat`
- `teams`
- `fs`
- `users`

These still own durable or broadly shared state and should not be converted mechanically.

## Rollout Notes

- Prefer `navigation` focus/blur for screen lifecycle like “mark viewed” or draft cleanup
- Prefer `useEngineActionListener` for mounted-screen reactions to engine pushes
- Do not move durable notification state into component listeners
- Delete temporary feature-local bridges such as increment-only refresh modules once direct subscriptions land

## Validation

- Confirm the feature still reacts while mounted
- Confirm focus/mount reload still covers missed events while unmounted
- Confirm no global store or init forwarding remains for the migrated action
- Update or delete tests that previously only exercised store plumbing

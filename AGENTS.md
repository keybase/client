# Repo Notes

- This repo uses React Compiler. Assume React Compiler patterns are enabled when editing React code, and avoid adding `useMemo`/`useCallback` by default unless they are clearly needed for correctness or compatibility with existing code.
- Functions returned from `React.useEffectEvent(...)` are special stable event functions, not normal callback dependencies. Do not include them in dependency arrays; instead, depend on the real reactive values around the effect/callback.
- Treat React mount/unmount effects as Strict-Mode-safe. Do not assume a component only mounts once; route-driven async startup and cleanup logic must be idempotent and must not leave refs or guards stuck false after a dev remount.
- Do not add `mountedRef`/`isMountedRef` guards just to suppress local React state updates after unmount; those updates are already a no-op in modern React. Only use a guard when you need to reject stale async results or protect a real side effect, and prefer request/version guards when they express the intent more directly.
- If a mount guard is truly needed, set the ref to `true` inside the effect body and set it to `false` in cleanup. Never rely on `useRef(true)` alone across the component lifetime, because Strict Mode remounts can leave the guard stuck `false` and silently drop async results.
- When a component reads multiple adjacent values from the same store hook, prefer a consolidated selector with `C.useShallow(...)` instead of multiple separate subscriptions.
- Keep types accurate. Do not use casts or misleading annotations to mask a real type mismatch just to get around an issue; fix the type or fix the implementation.
- When importing `@/constants/types` as `T`, check whether the file uses `T.*` as values, not just types. If you add calls like `T.RPCGen.*`, `T.Chat.*`, `T.Teams.*`, or any other runtime `T.*` access, do not keep `import type * as T ...`; switch it to a value import.
- Do not add new exported functions, types, or constants unless they are required outside the file. Prefer file-local helpers for one-off implementation details and tests.
- Under `shared/`, non-test TypeScript source files should use the `.tsx` extension.
- Do not edit lockfiles by hand. They are generated artifacts. If you cannot regenerate one locally, leave it unchanged.
- Components must not mutate Zustand stores directly with `useXState.setState`, `getState()`-based writes, or similar ad hoc store mutation. If a component needs to affect store state, route it through a store dispatch action or move the state out of the store.
- When a Zustand store already uses `resetState: Z.defaultReset`, prefer calling `dispatch.resetState()` for full resets instead of manually reassigning each initial field in another dispatch action.
- During refactors, do not delete existing guards, conditionals, or platform/test-specific behavior unless you have proven they are dead and the user asked for that behavior change. Port checks like `androidIsTestDevice` forward into the new code path instead of silently dropping them.
- When addressing PR or review feedback, including bot or lint-style suggestions, do not apply it mechanically. Verify that the reported issue is real in this codebase and that the proposed fix is consistent with repo rules and improves correctness, behavior, or maintainability before making changes.
- When working from a repo plan or checklist such as `PLAN.md`, update the checklist in the same change and mark implemented items done before you finish.

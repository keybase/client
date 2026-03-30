# Repo Notes

- This repo uses React Compiler. Assume React Compiler patterns are enabled when editing React code, and avoid adding `useMemo`/`useCallback` by default unless they are clearly needed for correctness or compatibility with existing code.
- Treat React mount/unmount effects as Strict-Mode-safe. Do not assume a component only mounts once; route-driven async startup and cleanup logic must be idempotent and must not leave refs or guards stuck false after a dev remount.
- When using mount guards like `mountedRef`/`isMountedRef`, always set the ref to `true` inside the effect body and set it to `false` in cleanup. Never rely on `useRef(true)` alone across the component lifetime, because Strict Mode remounts can leave the guard stuck `false` and silently drop async results.
- When a component reads multiple adjacent values from the same store hook, prefer a consolidated selector with `C.useShallow(...)` instead of multiple separate subscriptions.
- Do not add new exported functions, types, or constants unless they are required outside the file. Prefer file-local helpers for one-off implementation details and tests.
- During refactors, do not delete existing guards, conditionals, or platform/test-specific behavior unless you have proven they are dead and the user asked for that behavior change. Port checks like `androidIsTestDevice` forward into the new code path instead of silently dropping them.
- When addressing PR or review feedback, including bot or lint-style suggestions, do not apply it mechanically. Verify that the reported issue is real in this codebase and that the proposed fix is consistent with repo rules and improves correctness, behavior, or maintainability before making changes.

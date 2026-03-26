# Repo Notes

- This repo uses React Compiler. Assume React Compiler patterns are enabled when editing React code, and avoid adding `useMemo`/`useCallback` by default unless they are clearly needed for correctness or compatibility with existing code.
- When a component reads multiple adjacent values from the same store hook, prefer a consolidated selector with `C.useShallow(...)` instead of multiple separate subscriptions.

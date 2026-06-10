# Copilot Instructions

## React

- We use modern React (19+). Contexts are rendered directly as providers: `<MyContext value={...}>`, not `<MyContext.Provider value={...}>`. Do not suggest adding `.Provider`.
- We use the React Compiler. Components and hooks are memoized automatically:
  - Do not suggest adding `useMemo`, `useCallback`, or `React.memo` for performance — the compiler handles it.
  - Avoid patterns that make the compiler bail out, e.g. `try`/`catch` in a component or hook body (move it into a helper function instead).
  - `'use no memo'` directives are intentional opt-outs; do not flag or remove them.

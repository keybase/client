// Globals available on React Native's `global` object.
// `location` and `window` only exist in Chrome DevTools remote debugging builds.
declare var location: unknown
declare var window:
  | {
      __perfReact?: unknown
      requestIdleCallback?: (
        cb: (info: {didTimeout: boolean; timeRemaining: () => number}) => void,
        opts?: {timeout?: number}
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }
  | undefined

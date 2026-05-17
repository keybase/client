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

// Minimal File/DataTransfer stubs for shared files that use these types
// (actual drag-and-drop only runs on desktop, but the code is in shared files)
interface File {
  readonly type: string
  readonly name: string
}
interface DataTransfer {
  readonly files: ReadonlyArray<File>
  readonly types: ReadonlyArray<string>
}

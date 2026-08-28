// Dependency-free debug-clear registry. Kept separate from './debug' (which
// imports the logger) so that logger -> ring-logger -> registry stays acyclic.
const debugClearCBs = new Array<() => void>()

export const registerDebugClear = (cb: () => void) => {
  debugClearCBs.push(cb)
}
export const debugClear = __DEV__
  ? () => {
      for (const cb of debugClearCBs) {
        cb()
      }
    }
  : () => {}

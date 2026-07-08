// Dependency-free debug-clear registry. Kept separate from './debug' (which
// imports the logger) so that logger -> ring-logger -> registry stays acyclic.
const debugClearCBs = new Array<() => void>()
const debugUnClearCBs = new Array<() => void>()

export const registerDebugUnClear = (cb: () => void) => {
  debugUnClearCBs.push(cb)
}
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
export const debugUnClear = __DEV__
  ? () => {
      for (const cb of debugUnClearCBs) {
        cb()
      }
    }
  : () => {}

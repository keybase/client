// @flow

let logLocal = null
let warnLocal = null
let errorLocal = null

export default function setupLocalLogs () {
  if (!logLocal) logLocal = console.log.bind(console)
  if (!warnLocal) warnLocal = console.warn.bind(console)
  if (!errorLocal) errorLocal = console.error.bind(console)

  return {logLocal, warnLocal, errorLocal}
}

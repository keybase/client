// @flow

export let logLocal = null
export let warnLocal = null
export let errorLocal = null

export default function setupLocalLogs () {
  if (!logLocal) logLocal = console.log.bind(console)
  if (!warnLocal) warnLocal = console.warn.bind(console)
  if (!errorLocal) errorLocal = console.error.bind(console)
}

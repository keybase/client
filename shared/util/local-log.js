// @flow

export default function setupLocalLogs () {
  if (!console.logLocal) console.logLocal = console.log
  if (!console.warnLocal) console.warnLocal = console.warn
  if (!console.errorLocal) console.errorLocal = console.error
}

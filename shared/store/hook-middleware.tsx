// allow useWatchActions
export const hookMiddleware = () => next => action => {
  _hookCBs.forEach(cb => cb(action))
  return next(action)
}

type HookCB = (a: any) => void

const _hookCBs: Array<HookCB> = []
/** Register a useWatchActions hook */
export const registerHookMiddleware = (cb: HookCB) => {
  _hookCBs.push(cb)
  return () => {
    const idx = _hookCBs.indexOf(cb)
    if (idx !== -1) {
      _hookCBs.splice(idx, 1)
    }
  }
}

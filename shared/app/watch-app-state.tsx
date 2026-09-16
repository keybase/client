export type MobileAppState = 'active' | 'background' | 'inactive'

type AppStateLike = {
  currentState: string | null | undefined
  addEventListener: (type: 'change', listener: (state: string) => void) => {remove: () => void}
}

// RN's NativeAppState.getCurrentAppState: reads UIApplication.applicationState when called
export type QueryNativeAppState = (onState: (state: string) => void) => void

// Under iOS scenes UIApplication.applicationState still reads inactive while didBecomeActive is
// posted, so RN's AppState can report (and start with) 'inactive' and then never send 'active'
// because it only emits on a change of what it read. While we believe we're inactive, keep asking
// native directly until it says otherwise.
export const inactiveRecheckMs = 500

const asMobileAppState = (state: string | null | undefined): MobileAppState | undefined =>
  state === 'active' || state === 'background' || state === 'inactive' ? state : undefined

export const watchAppState = (p: {
  appState: AppStateLike
  queryNativeAppState?: QueryNativeAppState
  onState: (state: MobileAppState) => void
}) => {
  const {appState, queryNativeAppState, onState} = p
  let current: MobileAppState | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const scheduleRecheck = () => {
    if (!queryNativeAppState) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      queryNativeAppState(state => {
        if (stopped || current !== 'inactive') return
        const next = asMobileAppState(state)
        if (next && next !== 'inactive') {
          apply(next)
        } else {
          scheduleRecheck()
        }
      })
    }, inactiveRecheckMs)
  }

  const apply = (state: MobileAppState) => {
    current = state
    onState(state)
    if (state === 'inactive') {
      scheduleRecheck()
    } else {
      clearTimeout(timer)
    }
  }

  const sub = appState.addEventListener('change', state => {
    const next = asMobileAppState(state)
    if (next) {
      apply(next)
    }
  })

  const seeded = asMobileAppState(appState.currentState)
  if (seeded) {
    apply(seeded)
  }

  return () => {
    stopped = true
    clearTimeout(timer)
    sub.remove()
  }
}

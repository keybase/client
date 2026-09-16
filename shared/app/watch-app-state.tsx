export type MobileAppState = 'active' | 'background' | 'inactive'

export type AppStateSource = {
  current: () => string | null | undefined
  subscribe: (listener: (state: string) => void) => () => void
}

const asMobileAppState = (state: string | null | undefined): MobileAppState | undefined =>
  state === 'active' || state === 'background' || state === 'inactive' ? state : undefined

// Subscribes before reading the current state, so a change in between is never missed.
export const watchAppState = (source: AppStateSource, onState: (state: MobileAppState) => void) => {
  const unsubscribe = source.subscribe(state => {
    const next = asMobileAppState(state)
    if (next) {
      onState(next)
    }
  })
  const seeded = asMobileAppState(source.current())
  if (seeded) {
    onState(seeded)
  }
  return unsubscribe
}

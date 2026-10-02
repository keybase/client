import * as React from 'react'
import type {EventArg, NavigationAction} from '@react-navigation/core'

type Navigation = {
  addListener: (
    type: 'beforeRemove',
    cb: (e: EventArg<'beforeRemove', true, {action: NavigationAction}>) => void
  ) => () => void
}
export type BeforeRemoveEvent = EventArg<'beforeRemove', true, {action: NavigationAction}>

// The waits each route already listens for, so a render run twice (StrictMode, a hot reload) adds one
const listening = new WeakMap<object, WeakSet<Promise<unknown>>>()

// Listens for the screen's removal from its first render until `until()` settles; with no `until()` it
// doesn't listen. Not in an effect: a screen hidden under others (React Activity) and StrictMode run effect
// cleanups while the screen stays, and a screen removed while hidden must still hear it. The listener is
// the first render's.
export const useBeforeRemoveUntil = (
  navigation: Navigation | undefined,
  until: () => Promise<unknown> | undefined,
  listener: (e: BeforeRemoveEvent) => void
) => {
  React.useState(() => {
    const wait = navigation && until()
    if (!navigation || !wait) return
    let waits = listening.get(navigation)
    if (!waits) {
      waits = new WeakSet()
      listening.set(navigation, waits)
    }
    if (waits.has(wait)) return
    waits.add(wait)
    const stop = navigation.addListener('beforeRemove', listener)
    void wait.then(stop, stop)
  })
}

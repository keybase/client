import * as React from 'react'
import type * as EngineGen from '@/constants/rpc'
import logger from '@/logger'
import {registerExternalResetter} from '@/util/zustand'

type AnyListener = (action: EngineGen.Actions) => void

type Registration = {
  fn: AnyListener
  // lower runs first; ties break on registration order
  priority: number
  seq: number
  // module-init registrations outlive a sign-out; component subscriptions do not
  permanent: boolean
}

declare global {
  var __hmr_engineActionListeners: Map<EngineGen.ActionType, Array<Registration>> | undefined

  var __hmr_engineHandlerRegistrations: Map<string, () => void> | undefined

  var __hmr_engineListenerSeq: {next: number} | undefined
}

const listenersByType: Map<EngineGen.ActionType, Array<Registration>> = __DEV__
  ? (globalThis.__hmr_engineActionListeners ??= new Map())
  : new Map()

// The three central switches this replaced ran before any component
// subscription, and the platform switch ran after all of them. Ordering that
// used to be case-arm position is now stated here.
export const EnginePriority = {
  /** the shared init switch: store-level fan-out, before anything reads the result */
  shared: -300,
  /** ...and inside it, work a later handler for the same action depends on */
  sharedFirst: -400,
  /** the config store's own switch, which ran right after the shared one */
  config: -200,
  /** default: component subscriptions and anything with no ordering opinion */
  default: 0,
  /** the platform switch, which ran after everything else */
  platform: 100,
} as const

// Rides on globalThis with the map it stamps: if this module alone hot-reloads,
// a counter that restarted at 0 would sort every new registration ahead of the
// surviving ones, silently inverting the order priorities exist to pin.
const seq = __DEV__ ? (globalThis.__hmr_engineListenerSeq ??= {next: 0}) : {next: 0}

const insert = (type: EngineGen.ActionType, registration: Registration) => {
  let registrations = listenersByType.get(type)
  if (!registrations) {
    registrations = []
    listenersByType.set(type, registrations)
  }
  const at = registrations.findIndex(
    r => r.priority > registration.priority || (r.priority === registration.priority && r.seq > registration.seq)
  )
  if (at === -1) {
    registrations.push(registration)
  } else {
    registrations.splice(at, 0, registration)
  }
  return () => {
    const live = listenersByType.get(type)
    // Only touch the array the registration actually went into. A reset replaces
    // the array for a type, so an unsubscribe left over from before the reset
    // would otherwise splice a live entry out by index or delete the live array,
    // silently unsubscribing everybody who registered after the reset.
    if (live !== registrations) {
      return
    }
    const idx = registrations.indexOf(registration)
    if (idx !== -1) {
      registrations.splice(idx, 1)
    }
    if (!registrations.length) {
      listenersByType.delete(type)
    }
  }
}

export const subscribeToEngineAction = <T extends EngineGen.ActionType>(
  type: T,
  listener: (action: EngineGen.ActionOf<T>) => void
) =>
  insert(type, {
    fn: listener as unknown as AnyListener,
    permanent: false,
    priority: EnginePriority.default,
    seq: seq.next++,
  })

export type EngineHandlers = {
  [T in EngineGen.ActionType]?: (action: EngineGen.ActionOf<T>) => void
}

/**
 * Register a feature's own handlers for incoming engine actions, once, at module
 * init. Unlike subscribeToEngineAction these survive a sign-out reset, because
 * nothing re-runs module init to put them back.
 *
 * `id` makes a re-registration (HMR re-executing the module) replace the previous
 * one instead of doubling it.
 */
export const registerEngineHandlers = (
  handlers: EngineHandlers,
  options?: {id?: string; priority?: number}
) => {
  const {id, priority = EnginePriority.default} = options ?? {}
  if (__DEV__ && id) {
    const previous = (globalThis.__hmr_engineHandlerRegistrations ??= new Map()).get(id)
    previous?.()
  }
  const unsubs = Object.entries(handlers).map(([type, fn]) =>
    insert(type as EngineGen.ActionType, {
      fn: fn as AnyListener,
      permanent: true,
      priority,
      seq: seq.next++,
    })
  )
  const unregister = () => {
    for (const unsub of unsubs) unsub()
  }
  if (__DEV__ && id) {
    globalThis.__hmr_engineHandlerRegistrations?.set(id, unregister)
  }
  return unregister
}

export const useEngineActionListener = <T extends EngineGen.ActionType>(
  type: T,
  listener: (action: EngineGen.ActionOf<T>) => void,
  enabled = true
) => {
  const onAction = React.useEffectEvent(listener)
  React.useEffect(() => {
    if (!enabled) {
      return
    }
    return subscribeToEngineAction(type, action => onAction(action))
  }, [enabled, type])
}

export const notifyEngineActionListeners = (action: EngineGen.Actions) => {
  const registrations = listenersByType.get(action.type)
  if (!registrations?.length) {
    return
  }
  for (const {fn} of [...registrations]) {
    try {
      fn(action)
    } catch (error) {
      logger.error(`Error in engine action listener for ${action.type}`, error)
    }
  }
}

// Sign-out drops what components subscribed, not what modules registered at
// init: nothing re-runs module init to put those back.
export const clearAllEngineActionListeners = () => {
  // spliced in place rather than replaced, so the unregister a module-init
  // registration is holding still points at the array its entry lives in
  for (const [type, registrations] of [...listenersByType]) {
    for (let i = registrations.length - 1; i >= 0; i--) {
      if (!registrations[i]?.permanent) {
        registrations.splice(i, 1)
      }
    }
    if (!registrations.length) {
      listenersByType.delete(type)
    }
  }
}

registerExternalResetter('engine-action-listeners', clearAllEngineActionListeners)

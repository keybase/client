import * as React from 'react'
import type * as EngineGen from '@/constants/rpc'
import logger from '@/logger'

// Every subscription is removed by whoever made it: a screen's by its effect cleanup, a module's
// never. A store reset leaves the bus alone, because an account switch resets the stores while the
// logged-in screens, and the subscriptions their effects made, stay mounted.
type AnyListener = (action: EngineGen.Actions) => void

declare global {
  var __hmr_engineActionListeners: Map<EngineGen.ActionType, Set<AnyListener>> | undefined
}

const listenersByType: Map<EngineGen.ActionType, Set<AnyListener>> = __DEV__
  ? (globalThis.__hmr_engineActionListeners ??= new Map())
  : new Map()

const getListeners = (type: EngineGen.ActionType) => {
  let listeners = listenersByType.get(type)
  if (!listeners) {
    listeners = new Set()
    listenersByType.set(type, listeners)
  }
  return listeners
}

export const subscribeToEngineAction = <T extends EngineGen.ActionType>(
  type: T,
  listener: (action: EngineGen.ActionOf<T>) => void
) => {
  const listeners = getListeners(type)
  const untypedListener = listener as unknown as AnyListener
  listeners.add(untypedListener)
  return () => {
    listeners.delete(untypedListener)
    // A repeated unsubscribe must not drop a set subscribed since this one emptied.
    if (!listeners.size && listenersByType.get(type) === listeners) {
      listenersByType.delete(type)
    }
  }
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
  const listeners = listenersByType.get(action.type)
  if (!listeners?.size) {
    return
  }
  for (const listener of [...listeners]) {
    try {
      listener(action)
    } catch (error) {
      logger.error(`Error in engine action listener for ${action.type}`, error)
    }
  }
}

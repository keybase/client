import * as React from 'react'
import type * as EngineGen from '@/constants/rpc'
import logger from '@/logger'
import {registerExternalResetter} from '@/util/zustand'

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
    if (!listeners.size) {
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

export const clearAllEngineActionListeners = () => {
  listenersByType.clear()
}

registerExternalResetter('engine-action-listeners', clearAllEngineActionListeners)

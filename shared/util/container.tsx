import * as React from 'react'
import type {NavigationContainerRef} from '@react-navigation/core'
import type {createListenerMiddleware} from '@reduxjs/toolkit'
export type ListenerMiddleware = ReturnType<typeof createListenerMiddleware>
export {getRouteParams, getRouteParamsFromRoute} from '../router-v2/route-params'
export {useDebounce, useDebouncedCallback, useThrottledCallback, type DebouncedState} from 'use-debounce'
export {networkErrorCodes, isNetworkErr} from '../util/errors'

// Deprecated: avoid useEffect
export function usePrevious<T>(value: T) {
  const ref = React.useRef<T>()
  React.useEffect(() => {
    ref.current = value
  })
  return ref.current
}
// Deprecated: avoid useEffect
export function usePrevious2<T>(value: T) {
  const ref = React.useRef<T>()
  React.useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

/**
      like useEffect but doesn't call on initial mount, only when deps change
TODO deprecate
 */
export function useDepChangeEffect(f: () => void, deps: Array<unknown>) {
  const mounted = React.useRef(false)

  React.useEffect(() => {
    if (mounted.current) {
      f()
    } else {
      mounted.current = true
    }
    // eslint-disable-next-line
  }, deps)
}

import type {NavigationState} from '@react-navigation/core'
type Route = NavigationState['routes'][0]
export type RouteDef = {
  getScreen: () => React.ComponentType<any>
  getOptions?: Object | ((p: {navigation: NavigationContainerRef<{}>; route: Route}) => Object)
  screen?: React.ComponentType
}
export type RouteMap = {[K in string]?: RouteDef}

export const timeoutPromise = async (timeMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeMs)
  })

export {useSafeSubmit} from './safe-submit'
export {useSafeNavigation} from './safe-navigation'
export {produce} from 'immer'
export {default as useRPC} from './use-rpc'
export {default as useSafeCallback} from './use-safe-callback'

type Fn<ARGS extends any[], R> = (...args: ARGS) => R

// a hacky version of https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md until its really added
// its UNSAFE to call this in reaction immediately in a hook since it uses useLayoutEffect (aka the reduce useEffect changes)
export const useEvent = <Arr extends any[], R>(fn: Fn<Arr, R>): Fn<Arr, R> => {
  const ref = React.useRef<Fn<Arr, R>>(fn)
  React.useLayoutEffect(() => {
    ref.current = fn
  })
  return React.useMemo(
    () =>
      (...args: Arr): R =>
        ref.current(...args),
    []
  )
}

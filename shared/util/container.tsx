import * as React from 'react'
import {type Draft as _Draft} from 'immer'
import type {TypedActions as _TypedActions} from '../actions/typed-actions-gen'
import {useSelector, useDispatch as RRuseDispatch, shallowEqual} from 'react-redux'
import type {Dispatch as RRDispatch} from 'redux'
import flowRight from 'lodash/flowRight'
import type {NavigationContainerRef} from '@react-navigation/core'
import type {createListenerMiddleware} from '@reduxjs/toolkit'
import {useNavigation} from '@react-navigation/core'
import {type RouteKeys} from '../router-v2/route-params'
export type ListenerMiddleware = ReturnType<typeof createListenerMiddleware>
export {getRouteParams, getRouteParamsFromRoute} from '../router-v2/route-params'
export {listenAction, type ListenerApi, spawn, type ListenActionReturn} from './redux-toolkit'
export {useDebounce, useDebouncedCallback, useThrottledCallback, type DebouncedState} from 'use-debounce'
export {useAnyWaiting, useAnyErrors, useDispatchClearWaiting} from '../constants/waiting'
export {networkErrorCodes, isNetworkErr} from '../util/errors'

export type Unpacked<T> = T extends (infer U)[]
  ? U
  : T extends (...args: any[]) => infer U
  ? U
  : T extends Promise<infer U>
  ? U
  : T

// just then and catch and ignore async functions
export const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
}

export const useNav = () => {
  const n = useNavigation()
  const na: {pop?: () => void; navigate: (n: RouteKeys) => void} = n as any
  const {canGoBack} = n
  const pop: undefined | (() => void) = canGoBack() ? na.pop : undefined
  const navigate: (n: RouteKeys) => void = na.navigate
  return {
    canGoBack,
    navigate,
    pop,
  }
}

// extracts the payload from pages used in routing
export type PagesToParams<T> = {
  [K in keyof T]: T[K] extends {getScreen: infer U}
    ? U extends () => (args: infer V) => any
      ? V extends {route: {params: infer W}}
        ? W
        : undefined
      : undefined
    : undefined
}

// get the views params and wrap them as the page would see it
export type ViewPropsToPageProps<T> = T extends (p: infer P) => any ? {route: {params: P}} : never
export type ViewPropsToPagePropsMaybe<T> = T extends (p: infer P) => any
  ? {route: {params: P | undefined}}
  : never

export type RemoteWindowSerializeProps<P> = {[K in keyof P]-?: (val: P[K], old?: P[K]) => any}

export type TypedDispatch = (action: _TypedActions) => void
export type Dispatch = TypedDispatch

// Deprecated: use usePrevious2
export function usePrevious<T>(value: T) {
  const ref = React.useRef<T>()
  React.useEffect(() => {
    ref.current = value
  })
  return ref.current
}
export function usePrevious2<T>(value: T) {
  const ref = React.useRef<T>()
  React.useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

/** like useSelector but for remote stores **/
export function useRemoteStore<S>(): S {
  // TODO this will warn you not to do this, could just pass in a selector later
  return useSelector(s => s, shallowEqual) as any
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

// Get the mounted state of a component
export const useIsMounted = () => {
  const mounted = React.useRef(true)
  React.useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])
  const isMounted = React.useCallback(() => mounted.current, [])
  return isMounted
}

// Run a function on mount once
export const useOnMountOnce = (f: () => void) => {
  const onceRef = React.useRef(true)
  if (onceRef.current) {
    onceRef.current = false
    // defer a frame so you don't get react issues
    setTimeout(f, 1)
  }
}

// Run a function on unmount, doesn't rerun if the function changes
export const useOnUnMountOnce = (f: () => void) => {
  const ref = React.useRef(f)
  ref.current = f
  React.useEffect(() => {
    return () => {
      ref.current()
    }
  }, [])
}

import type {NavigationState} from '@react-navigation/core'
type Route = NavigationState['routes'][0]
export type RouteDef = {
  getScreen: () => React.ComponentType<any>
  getOptions?: Object | ((p: {navigation: NavigationContainerRef<{}>; route: Route}) => Object)
  screen?: React.ComponentType
}
export type RouteMap = {[K in string]?: RouteDef}

export async function neverThrowPromiseFunc<T>(f: () => Promise<T>) {
  try {
    return await f()
  } catch {
    return undefined
  }
}

export const assertNever = (_: never) => undefined

export const timeoutPromise = async (timeMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeMs)
  })

export {isMobile, isIOS, isAndroid, isPhone, isTablet} from '../constants/platform'
export {useSafeSubmit} from './safe-submit'
export {useSafeNavigation} from './safe-navigation'
export type TypedActions = _TypedActions
export const compose = flowRight
export {produce, castDraft, castImmutable, current} from 'immer'
export type Draft<T> = _Draft<T>
export {default as HiddenString} from './hidden-string'
export {default as useRPC} from './use-rpc'
export {default as useSafeCallback} from './use-safe-callback'
export const useDispatch = () => RRuseDispatch<RRDispatch<_TypedActions>>()

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

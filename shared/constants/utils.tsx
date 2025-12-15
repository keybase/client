import type * as React from 'react'
import {useNavigation} from '@react-navigation/core'
import {type RouteKeys} from '@/router-v2/route-params'
import logger from '@/logger'
import {storeRegistry} from './store-registry'

export const generateGUIID = () => Math.floor(Math.random() * 0xfffffffffffff).toString(16)

export const ignorePromise = (f: Promise<void> | Promise<PromiseSettledResult<void>[]>) => {
  f.then(() => {}).catch((e: unknown) => {
    logger.error('ignorePromise error', e)
  })
}

export const initListeners = () => {
  const f = async () => {
    await storeRegistry.getState('fs').dispatch.setupSubscriptions()
    storeRegistry.getState('config').dispatch.setupSubscriptions()
  }
  ignorePromise(f())
}

export type PagesToParams<T> = {
  [K in keyof T]: T[K] extends {screen: infer U}
    ? U extends (args: infer V) => any
      ? V extends {route: {params: infer W}}
        ? W
        : undefined
      : undefined
    : undefined
}

export type ViewPropsToPageProps<T> =
  T extends React.LazyExoticComponent<infer C>
    ? C extends React.ComponentType<infer P>
      ? P extends undefined | never
        ? {route: {params?: undefined}}
        : {route: {params: P}}
      : {route: {params?: undefined}}
    : T extends (p: infer P) => any
      ? P extends undefined | never
        ? {route: {params?: undefined}}
        : {route: {params: P}}
      : {route: {params?: undefined}}
export type ViewPropsToPagePropsMaybe<T> = T extends (p: infer P) => any
  ? {route: {params: P | undefined}}
  : never

export const timeoutPromise = async (timeMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeMs)
  })

export async function neverThrowPromiseFunc<T>(f: () => Promise<T>) {
  try {
    return await f()
  } catch {
    return undefined
  }
}

export function enumKeys<T extends Record<string, string | number>>(enumeration: T): (keyof T)[] {
  return Object.keys(enumeration).filter(key => typeof enumeration[key] === 'number') as (keyof T)[]
}

export const assertNever = (_: never) => undefined

export const useNav = () => {
  const na = useNavigation()
  const {canGoBack} = na
  const pop: undefined | (() => void) = canGoBack() ? na.goBack : undefined
  const navigate: (n: RouteKeys) => void = na.navigate
  return {
    canGoBack,
    navigate,
    pop,
  }
}

export {default as shallowEqual} from 'shallowequal'
export {useDebouncedCallback, useThrottledCallback, type DebouncedState} from 'use-debounce'
export {useShallow, useDeep} from '@/util/zustand'
export {default as useRPC} from '@/util/use-rpc'
export {produce} from 'immer'
export * from './immer'
export {default as featureFlags} from '../util/feature-flags'
export {useIsMounted, useOnMountOnce, useOnUnMountOnce, useEvent, useLogMount} from './react'
export {debugWarning} from '@/util/debug-warning'
export {isNetworkErr, RPCError} from '@/util/errors'

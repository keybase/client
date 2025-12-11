// Used to avoid circular dependencies, keep orders
export * from './platform'
export * from './values'
export * from './strings'
export {wrapErrors} from '@/util/debug'
export {useDarkModeState} from './darkmode'
export {useRouterState, makeScreen} from './router2'
export * as Router2 from './router2'
export {useDeepLinksState} from './deeplinks'
export * as DeepLinks from './deeplinks'
export {TBProvider_ as TBProvider, stores_ as TBstores, useContext_ as useTBContext} from './team-building'
export * as TeamBuilding from './team-building'
export {useProvisionState} from './provision'
export * as Provision from './provision'
export {useEngineState} from './engine'
export * as Tabs from './tabs'
export {useTeamsState} from './teams'
export * as Teams from './teams'
export {useWaitingState} from './waiting'
export * as Waiting from './waiting'
export {useChatState} from './chat2'
export * as Chat from './chat2'
export {useConvoState_ as useConvoState, stores_ as chatStores, ChatProvider_ as ChatProvider} from './chat2'
export {getConvoState_ as getConvoState, useContext_ as useChatContext} from './chat2'
export {useConfigState_ as useConfigState, type Store as ConfigStore} from './config'
import {useFSState} from './fs'
import {useConfigState_ as useConfigState} from './config'

export {default as shallowEqual} from 'shallowequal'
export * as PlatformSpecific from './platform-specific'

export const generateGUIID = () => Math.floor(Math.random() * 0xfffffffffffff).toString(16)

export const initListeners = () => {
  const f = async () => {
    await useFSState.getState().dispatch.setupSubscriptions()
    useConfigState.getState().dispatch.setupSubscriptions()
  }
  ignorePromise(f())
}

// extracts the payload from pages used in routing
export type PagesToParams<T> = {
  [K in keyof T]: T[K] extends {screen: infer U}
    ? U extends (args: infer V) => any
      ? V extends {route: {params: infer W}}
        ? W
        : undefined
      : undefined
    : undefined
}

// get the views params and wrap them as the page would see it
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

import logger from '@/logger'
export {debugWarning} from '@/util/debug-warning'

export const ignorePromise = (f: Promise<void> | Promise<PromiseSettledResult<void>[]>) => {
  f.then(() => {}).catch((e: unknown) => {
    // likely remove this after some time
    logger.error('ignorePromise error', e)
  })
}

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

import {useNavigation} from '@react-navigation/core'
import {type RouteKeys} from '@/router-v2/route-params'
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

export {useIsMounted, useOnMountOnce, useOnUnMountOnce, useEvent, useLogMount} from './react'
export {useDebouncedCallback, useThrottledCallback, type DebouncedState} from 'use-debounce'
export {useShallow, useDeep} from '@/util/zustand'
export {isNetworkErr, RPCError} from '@/util/errors'
export {default as useRPC} from '@/util/use-rpc'
export {produce} from 'immer'
export * from './immer'
export {default as featureFlags} from '../util/feature-flags'

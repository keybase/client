import {useNavigation} from '@react-navigation/core'
import {type RouteKeys} from '@/router-v2/route-params'
import logger from '@/logger'

export const generateGUIID = () => Math.floor(Math.random() * 0xfffffffffffff).toString(16)

export const ignorePromise = (f: Promise<void> | Promise<PromiseSettledResult<void>[]>) => {
  f.then(() => {}).catch((e: unknown) => {
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

export {wrapErrors} from '@/util/debug'
export {default as shallowEqual} from '@/util/shallow-equal'
export {useDebouncedCallback, useThrottledCallback, type DebouncedState} from '@/util/use-debounce'
export {useShallow, useDeep} from '@/util/zustand'
export {default as useRPC} from '@/util/use-rpc'
export {produce} from 'immer'
export * from './immer'
export {default as featureFlags} from '../util/feature-flags'
export {useOnMountOnce, useOnUnMountOnce, useLogMount} from './react'
export {debugWarning} from '@/util/debug-warning'
export {isNetworkErr, RPCError} from '@/util/errors'

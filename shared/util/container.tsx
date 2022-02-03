import * as React from 'react'
import {Draft as _Draft} from 'immer'
import {TypedActions as _TypedActions} from '../actions/typed-actions-gen'
import {ActionHandler as _ActionHandler} from './make-reducer'
import {TypedState as _TypedState} from '../constants/reducer'
import {RouteProps as _RouteProps, GetRouteType} from '../route-tree/render-route'
import {StatusCode} from '../constants/types/rpc-gen'
import {anyWaiting, anyErrors} from '../constants/waiting'
import flowRight from 'lodash/flowRight'
import {useSelector as RRuseSelector, useDispatch as RRuseDispatch} from 'react-redux'
import typedConnect from './typed-connect'

// to keep fallback objects static for react
export const emptyArray: Array<any> = []
export const emptySet = new Set<any>()
export const emptyMap = new Map<any, any>()
export const NullComponent = () => null

export const networkErrorCodes = [
  StatusCode.scgenericapierror,
  StatusCode.scapinetworkerror,
  StatusCode.sctimeout,
]

export const isNetworkErr = (code: number) => networkErrorCodes.includes(code)

export function getRouteProps<O extends _RouteProps<any>, R extends GetRouteType<O>, K extends keyof R>(
  ownProps: O,
  key: K,
  notSetVal: R[K] // this could go away if we type the routes better and ensure its always passed as a prop
): R[K] {
  const val = ownProps.navigation.getParam(key)
  return val === undefined ? notSetVal : val
}

export function getRoutePropsOr<O extends _RouteProps<any>, R extends GetRouteType<O>, K extends keyof R, D>(
  ownProps: O,
  key: K,
  notSetVal: D
): R[K] | D {
  const val = ownProps.navigation.getParam(key)
  return val === undefined ? notSetVal : val
}

export type RemoteWindowSerializeProps<P> = {[K in keyof P]-?: (val: P[K], old?: P[K]) => any}

export type TypedDispatch = (action: _TypedActions) => void
export type Dispatch = TypedDispatch

export const useAnyWaiting = (...waitingKeys: string[]) =>
  useSelector(state => anyWaiting(state, ...waitingKeys))
export const useAnyErrors = (...waitingKeys: string[]) => useSelector(state => anyErrors(state, waitingKeys))
export function usePrevious<T>(value: T) {
  const ref = React.useRef<T>()
  React.useEffect(() => {
    ref.current = value
  })
  return ref.current
}

/** like useSelector but for remote stores **/
export function useRemoteStore<S>(): S {
  return useSelector(s => s) as unknown as S
}
/**
      like useEffect but doesn't call on initial mount, only when deps change
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

export type Route = {
  getScreen: () => React.ComponentType<any>
  screen?: React.ComponentType
}
export type RouteMap = {[K in string]: Route}

export const assertNever = (_: never) => undefined

export const timeoutPromise = (timeMs: number) =>
  new Promise(resolve => {
    setTimeout(() => resolve(undefined), timeMs)
  })

const connect = typedConnect
export {connect}
export {isMobile, isIOS, isAndroid, isPhone, isTablet} from '../constants/platform'
export {anyWaiting, anyErrors} from '../constants/waiting'
export {safeSubmit, safeSubmitPerMount} from './safe-submit'
export {useSafeNavigation} from './safe-navigation'
export type RouteProps<P = {}> = _RouteProps<P>
export type TypedActions = _TypedActions
export type TypedState = _TypedState
export const compose = flowRight
export {default as hoistNonReactStatic} from 'hoist-non-react-statics'
export {produce, castDraft, castImmutable} from 'immer'
export type Draft<T> = _Draft<T>
export {default as HiddenString} from './hidden-string'
export {default as makeReducer} from './make-reducer'
export type ActionHandler<S, A> = _ActionHandler<S, A>
export {default as useRPC} from './use-rpc'
export {default as useSafeCallback} from './use-safe-callback'
export {default as useFocusBlur} from './use-focus-blur'
export {default as useWatchActions} from './use-watch-actions'
export type RootState = _TypedState
export const useDispatch = RRuseDispatch
export const useSelector = RRuseSelector

// BEGIN debugging connect
// import isEqual from 'lodash/isEqual'
// const debugMergeProps = __DEV__
//   ? () => {
//       let oldsp = {}
//       let oldop = {}
//       return (sp, op, mp) => {
//         Object.keys(oldsp).forEach(key => {
//           if (oldsp[key] !== sp[key] && isEqual(oldsp[key], sp[key])) {
//             console.log('DEBUGMERGEPROPS sp: ', key, oldsp[key], sp[key], 'orig: ', mp)
//           }
//         })
//         Object.keys(oldop).forEach(key => {
//           if (oldop[key] !== op[key] && isEqual(oldop[key], op[key])) {
//             console.log('DEBUGMERGEPROPS op: ', key, oldop[key], op[key], 'orig: ', mp)
//           }
//         })
//         oldsp = sp || {}
//         oldop = op || {}
//       }
//     }
//   : () => () => {}
//
// const debugConnect: any = (msp, mdp, mp) => {
//   console.log('DEBUG: using debugMergeProps connect')
//   const dmp = debugMergeProps()
//   return typedConnect(msp, mdp, (sp, dp, op) => {
//     dmp(sp, op, mp)
//     return mp(sp, dp, op)
//   })
// }
// const connect: typeof typedConnect = __DEV__ ? debugConnect : typedConnect
// if (__DEV__) {
//   console.log('\n\n\nDEBUG: debugConnect enabled')
// }

import * as React from 'react'
// eslint-disable-next-line
import {Draft as _Draft} from 'immer'
import {TypedActions} from '../actions/typed-actions-gen'
import {TypedState} from '../constants/reducer'
import {RouteProps as _RouteProps, GetRouteType} from '../route-tree/render-route'
import {PropsWithSafeNavigation as _PropsWithSafeNavigation} from './safe-navigation'
import {StatusCode} from '../constants/types/rpc-gen'
import {anyWaiting, anyErrors} from '../constants/waiting'
import {useSelector} from 'react-redux'

export const NullComponent = () => null
export const actionHasError = <NoError extends {}, HasError extends {error: boolean}>(
  a: NoError | HasError
): a is HasError => Object.prototype.hasOwnProperty.call(a, 'error')

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

export type TypedDispatch = (action: TypedActions) => void
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

export type Route = {
  getScreen: () => React.ComponentType<any>
  screen?: React.ComponentType
}
export type RouteMap = {[K in string]: Route}

export {
  branch,
  defaultProps,
  lifecycle,
  pure,
  renderComponent,
  renderNothing,
  withHandlers,
  withStateHandlers,
  withProps,
  mapProps,
  withPropsOnChange,
  setDisplayName,
} from 'recompose'
export {default as connect, namedConnect, connectDEBUG} from './typed-connect'
export {default as remoteConnect} from './typed-remote-connect'
export {isMobile, isIOS, isAndroid} from '../constants/platform'
export {anyWaiting, anyErrors} from '../constants/waiting'
export {safeSubmit, safeSubmitPerMount} from './safe-submit'
export {default as withSafeNavigation, useSafeNavigation} from './safe-navigation'
export type RouteProps<P = {}> = _RouteProps<P>
export type TypedActions = TypedActions
export type TypedState = TypedState
export type PropsWithSafeNavigation<P> = _PropsWithSafeNavigation<P>
export {useSelector, useDispatch} from 'react-redux'
export {flowRight as compose} from 'lodash-es'
export {default as hoistNonReactStatic} from 'hoist-non-react-statics'
export {produce} from 'immer'
export type Draft<T> = _Draft<T>

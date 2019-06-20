import {TypedActions} from '../actions/typed-actions-gen'
import {TypedState} from '../constants/reducer'
import {RouteProps as _RouteProps} from '../route-tree/render-route'
import {PropsWithSafeNavigation as _PropsWithSafeNavigation} from './safe-navigation'
import {StatusCode} from '../constants/types/rpc-gen'
export {flowRight as compose} from 'lodash-es'

export const NullComponent = () => null
export const actionHasError = <NoError extends {}, HasError extends {error: boolean}>(
  a: NoError | HasError
): a is HasError => a.hasOwnProperty('error')

export const networkErrorCodes = [
  StatusCode.scgenericapierror,
  StatusCode.scapinetworkerror,
  StatusCode.sctimeout,
]

export const getRouteProps = (ownProps: any, key: string) => ownProps.navigation.getParam(key)

export type TypedDispatch = (action: TypedActions) => void
export type Dispatch = TypedDispatch

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
export {default as connect, namedConnect} from './typed-connect'
export {default as remoteConnect} from './typed-remote-connect'
export {isMobile} from '../constants/platform'
export {anyWaiting, anyErrors} from '../constants/waiting'
export {safeSubmit, safeSubmitPerMount} from './safe-submit'
export {default as withSafeNavigation} from './safe-navigation'
export type RouteProps<P, S> = _RouteProps<P, S>
export type TypedActions = TypedActions
export type TypedState = TypedState
export type PropsWithSafeNavigation<P> = _PropsWithSafeNavigation<P>
export {useSelector, useDispatch} from 'react-redux'

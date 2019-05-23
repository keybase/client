import {TypedActions} from '../actions/typed-actions-gen'
import {TypedState} from '../constants/reducer'
import {RouteProps} from '../route-tree/render-route'
import {PropsWithSafeNavigation} from './safe-navigation'
import {constantsStatusCode} from '../constants/types/rpc-gen'

export const NullComponent = () => null
export const actionHasError = (a: Object) => a.hasOwnProperty('error')

export const networkErrorCodes = [
  constantsStatusCode.scgenericapierror,
  constantsStatusCode.scapinetworkerror,
  constantsStatusCode.sctimeout,
]

export const getRouteProps = (ownProps: any, key: string) => ownProps.navigation.getParam(key)

export type TypedDispatch = (action: TypedActions) => void
export type Dispatch = TypedDispatch

export {
  branch,
  compose,
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
export {RouteProps, TypedActions, TypedState, PropsWithSafeNavigation}

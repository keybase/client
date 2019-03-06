// @flow
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'
import type {RouteProps} from '../route-tree/render-route'
import {constantsStatusCode} from '../constants/types/rpc-gen'

export const NullComponent = () => null
export const actionHasError = (a: Object) => !!a.error

export const networkErrorCodes = [
  constantsStatusCode.scgenericapierror,
  constantsStatusCode.scapinetworkerror,
  constantsStatusCode.sctimeout,
]

type TypedDispatch = (action: TypedActions) => void
type Dispatch = TypedDispatch

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
export {safeSubmit, safeSubmitPerMount} from './safe-submit'
export type {RouteProps, TypedActions, TypedState, TypedDispatch, Dispatch}

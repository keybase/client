import {TypedActions} from '../actions/typed-actions-gen'
import {TypedState} from '../constants/reducer'
import {RouteProps as _RouteProps} from '../route-tree/render-route'
import {PropsWithSafeNavigation as _PropsWithSafeNavigation} from './safe-navigation'
import {StatusCode} from '../constants/types/rpc-gen'

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

// type WithUIPromise<T> = {
//   uiPromise: {
//     resolve: (arg: T) => void
//     reject: (err: Error) => void
//   }
// }
// type UIPromiseType<A> = A extends WithUIPromise<infer U> ? WithUIPromise<U> : never
// export function dispatchUIPromise<T>(
//   dispatch,
//   actionCreator: (payload: UIPromiseType<T>) => Object,
//   arg: Omit<UIPromiseType<T>, 'uiPromise'>
// ): Promise<T> {
//   return new Promise<T>((resolve, reject) => dispatch(actionCreator({...arg, uiPromise: {resolve, reject}})))
// }

// interface UIPromiseActionCreatorArg<T> {
//   uiPromise: {
//     resolve: (arg: T) => void
//     reject: (err: Error) => void
//   }
// }

// type UIPromiseActionCreator<AC extends (...args) => any> = Parameters<AC> extends UIPromiseActionCreatorArg<infer T>
//   ? (arg: UIPromiseActionCreatorArg<T>) => Object
//   : never

// export function dispatchUIPromise<AC extends UIPromiseActionCreator<infer U>>(dispatch, actionCreator: AC, arg: Omit<Parameters<AC>, 'uiPromise'>) {
//   return new Promise<U>((resolve, reject) => dispatch(actionCreator({...arg, uiPromise: {resolve, reject}})))
// }
interface UIPromiseActionCreatorArg<PType> {
  uiPromise: {
    resolve: (res: PType) => void
    reject: (err: Error) => void
  }
}
type UI<Payload> = Payload extends UIPromiseActionCreatorArg<infer PType>
  ? (payload: Payload) => object
  : never
export function dispatchUIPromise<PType>(
  dispatch,
  actionCreator: (arg: UIPromiseActionCreatorArg<PType>) => object,
  payload: Omit<UIPromiseActionCreatorArg<PType>, 'uiPromise'>
) {
  return new Promise<PType>((resolve, reject) =>
    dispatch(actionCreator({...payload, uiPromise: {resolve, reject}}))
  )
}

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
export type RouteProps<P, S> = _RouteProps<P, S>
export type TypedActions = TypedActions
export type TypedState = TypedState
export type PropsWithSafeNavigation<P> = _PropsWithSafeNavigation<P>

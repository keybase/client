// @flow
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'

export const NullComponent = () => null

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
export {default as connect} from './typed-connect'
export {default as remoteConnect} from './typed-remote-connect'
export {isMobile} from '../constants/platform'
export {safeSubmit, safeSubmitPerMount} from './safe-submit'
export type {TypedActions, TypedState, TypedDispatch, Dispatch}

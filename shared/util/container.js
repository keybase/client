// @flow
import * as I from 'immutable'
import {isEqualWith} from 'lodash-es'
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
import {connect as _connect} from 'react-redux'
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'

const createShallowEqualSelector = createSelectorCreator(defaultMemoize, (a, b) =>
  isEqualWith(a, b, (a, b, indexOrKey, object, other, stack) => (stack ? a === b : undefined))
)

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const NullComponent = () => null

type TypedDispatch = (action: TypedActions) => void
type Dispatch = TypedDispatch

// store shape isn't TypedState
const remoteConnect = _connect

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
export {default as createCachedSelector} from 're-reselect'
export {default as connect} from './typed-connect'
export {
  createShallowEqualSelector,
  createImmutableEqualSelector,
  createSelector,
  createSelectorCreator,
  defaultMemoize,
  remoteConnect,
  NullComponent,
}
export {isMobile} from '../constants/platform'
export {safeSubmit, safeSubmitPerMount} from './safe-submit'
export type {TypedState, TypedDispatch, Dispatch}

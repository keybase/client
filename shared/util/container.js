// @flow
import * as I from 'immutable'
import {isEqualWith} from 'lodash-es'
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'

const createShallowEqualSelector = createSelectorCreator(defaultMemoize, (a, b) =>
  isEqualWith(a, b, (a, b, indexOrKey, object, other, stack) => (stack ? a === b : undefined))
)

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const NullComponent = () => null

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
export {
  createShallowEqualSelector,
  createImmutableEqualSelector,
  createSelector,
  createSelectorCreator,
  defaultMemoize,
  NullComponent,
}
export {isMobile} from '../constants/platform'
export {safeSubmit, safeSubmitPerMount} from './safe-submit'
export type {TypedActions, TypedState, TypedDispatch, Dispatch}

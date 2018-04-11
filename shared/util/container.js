// @flow
import * as I from 'immutable'
import {isEqualWith} from 'lodash-es'
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'

const createShallowEqualSelector = createSelectorCreator(defaultMemoize, (a, b) =>
  isEqualWith(a, b, (a, b, indexOrKey, object, other, stack) => (stack ? a === b : undefined))
)

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const NullComponent = () => null

export {connect} from 'react-redux'
export {
  branch,
  compose,
  defaultProps,
  lifecycle,
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
export type {TypedState} from '../constants/reducer'
export {
  createShallowEqualSelector,
  createImmutableEqualSelector,
  createSelector,
  createSelectorCreator,
  defaultMemoize,
  NullComponent,
}
export {Dispatch} from '../constants/types/flux'
export {isMobile} from '../constants/platform'

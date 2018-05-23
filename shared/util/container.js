// @flow
import * as I from 'immutable'
import {isEqualWith} from 'lodash-es'
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
// import {compose, setDisplayName} from 'recompose'
import {connect} from 'react-redux'

const createShallowEqualSelector = createSelectorCreator(defaultMemoize, (a, b) =>
  isEqualWith(a, b, (a, b, indexOrKey, object, other, stack) => (stack ? a === b : undefined))
)

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const NullComponent = () => null

// const namedConnect = <MSP, MDP, MP>(
// name: string,
// mapStateToProps: MSP,
// mapDispatchToProps: MDP,
// mergeProps: MP
// ): $Call<connect, MSP, MDP, MP> =>
// compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName(name))

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
export type {TypedState} from '../constants/reducer'
export {
  connect,
  createShallowEqualSelector,
  createImmutableEqualSelector,
  createSelector,
  createSelectorCreator,
  defaultMemoize,
  NullComponent,
  // namedConnect,
}
export {Dispatch} from '../constants/types/flux'
export {isMobile} from '../constants/platform'

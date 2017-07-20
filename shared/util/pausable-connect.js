// @flow
import {createConnect} from 'react-redux/src/connect/connect'
import defaultSelectorFactory from 'react-redux/src/connect/selectorFactory'

import typeof {connect} from 'react-redux'

function selectorFactory(dispatch, factoryOptions) {
  const selector = defaultSelectorFactory(dispatch, factoryOptions)
  let cachedResult
  const pausableSelector = function(state, ownProps) {
    // We run the selector the first time the HoC is mounted, even if not
    // active. Some connected components have expectations of the structure of
    // their props, so we can't render them until we have data from the
    // selector.
    if (ownProps.isActiveRoute || cachedResult === undefined) {
      cachedResult = selector(state, ownProps)

      // isActiveRoute is always passed through to the child component. It's
      // not necessary to do this in mapStateToProps or mergeProps -- whatever
      // the selector returns will be clobbered here anyway.
      cachedResult.isActiveRoute = ownProps.isActiveRoute
    } else if (cachedResult.isActiveRoute !== ownProps.isActiveRoute) {
      // We copy the result into a new object so that it is !== the previous
      // cachedResult.
      cachedResult = {...cachedResult, isActiveRoute: ownProps.isActiveRoute}
    }
    return cachedResult
  }
  // If what we return is === what we returned prior, the connected component
  // will not be updated.
  return pausableSelector
}

// pausableConnect creates a connected HoC which behaves the same as connect
// when the isActiveRoute prop is truthy. When isActiveRoute is falsy, the
// component will not run its mapStateToProps/mapDispatchToProps/mergeProps
// functions, and the child component will not be updated. When isActiveRoute
// changes from falsy to truthy, the child component will be updated to the
// latest state as expected.
const pausableConnect: connect = createConnect({selectorFactory})

export default pausableConnect

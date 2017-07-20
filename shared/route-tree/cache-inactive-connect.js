// @flow

// This function wraps a mapStatetoProps function. The mapStatetoProps function
// should accept isActiveRoute as an ownProp and return an object with an
// isActiveRoute property.
//
// When ownProps.isActiveRoute=true, mapStatetoProps is always called.
//
// When the mapStatetoProps function returns isActiveRoute=false and
// ownProps.isActiveRoute=false, we go to sleep until mapStatetoProps returns
// isActiveRoute=true again (after ownProps.isActiveRoute becomes true).
function cacheWhenRouteInactive<A: Function>(mapStatetoProps: A): A {
  // $FlowIssue Difficult to type this properly wrt our redux-connect types
  return function(state, ownProps) {
    let cachedResult = mapStatetoProps(state, ownProps)
    return function cachedMapStateToProps(state, ownProps) {
      if (__DEV__) {
        if (cachedResult.isActiveRoute !== true && cachedResult.isActiveRoute !== false) {
          console.warn('cacheWhenRouteInactive: mapStatetoProps did not return a value for isActiveRoute')
        }
      }
      if (cachedResult.isActiveRoute || ownProps.isActiveRoute !== cachedResult.isActiveRoute) {
        cachedResult = mapStatetoProps(state, ownProps)
      }
      return cachedResult
    }
  }
}

export default cacheWhenRouteInactive

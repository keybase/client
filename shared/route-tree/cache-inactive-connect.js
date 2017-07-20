// @flow

function cacheWhenRouteInactive<A: Function>(mapStatetoProps: A): A {
  // $FlowIssue Difficult to type this properly wrt our redux-connect types
  return function(state, ownProps) {
    let cachedResult = mapStatetoProps(state, ownProps)
    return function cachedMapStateToProps(state, ownProps) {
      if (__DEV__) {
        if (cachedResult.isActiveRoute !== true && cachedResult.isActiveRoute !== false) {
          console.warn('cacheWhenRouteInactive ')
        }
      }
      if (ownProps.isActiveRoute || ownProps.isActiveRoute !== cachedResult.isActiveRoute) {
        console.log('XXX updating', ownProps.isActiveRoute, ownProps.routePath.join('/'))
        cachedResult = mapStatetoProps(state, ownProps)
      } else {
        console.log('XXX skipping', ownProps.isActiveRoute, ownProps.routePath.join('/'))
      }
      return cachedResult
    }
  }
}

export default cacheWhenRouteInactive

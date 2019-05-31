import * as I from 'immutable'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as React from 'react'

// We wrap any non upgraded routes as having all the old style props (which don't really work)
const shimAsRouteTree = (Original: any) => {
  class ShimmedOldRouteTree extends React.PureComponent<any> {
    static navigationOptions = Original.navigationOptions
    _routeProps = {get: key => this.props.navigation.getParam(key)}
    _routeState = {
      get: key => {
        throw new Error('Route state NOT supported anymore')
      },
    }
    _routePath = I.List()
    _routeLeafTags = I.Map()
    _routeStack = I.Map()
    _setRouteState = () => {
      throw new Error('Route state NOT supported anymore')
    }
    _navigateUp = () => RouteTreeGen.createNavigateUp()
    _navigateAppend = path => RouteTreeGen.createNavigateAppend({path})

    render() {
      return (
        <Original
          navigation={this.props.navigation}
          routeProps={this._routeProps}
          shouldRender={true}
          routeState={this._routeState}
          routeSelected={null}
          routePath={this._routePath}
          routeLeafTags={this._routeLeafTags}
          routeStack={this._routeStack}
          setRouteState={this._setRouteState}
          navigateUp={this._navigateUp}
          navigateAppend={this._navigateAppend}
        />
      )
    }
  }
  return ShimmedOldRouteTree
}

export const shim = (routes: any, platformWrapper: any) => {
  return Object.keys(routes).reduce((map, route) => {
    let _cached = null

    map[route] = {
      ...routes[route],
      getScreen: () => {
        if (_cached) {
          return _cached
        }

        let Component = routes[route].getScreen()
        // Wrap as an old style route tree component, TODO get rid of these eventually
        Component = routes[route].upgraded ? Component : shimAsRouteTree(Component)

        _cached = platformWrapper(Component)
        return _cached
      },
    }

    return map
  }, {})
}

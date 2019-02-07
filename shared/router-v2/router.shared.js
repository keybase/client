// @flow
import * as I from 'immutable'
import * as React from 'react'
import {StackActions, NavigationActions} from '@react-navigation/core'
import shallowEqual from 'shallowequal'
import * as RouteTreeGen from '../actions/route-tree-gen'

// Wraps all our screens with a component that injects bridging props that the old screens assumed (routeProps, routeState, etc)
// TODO eventually remove this when we clean up all those components
// letting native/desktop specifcy a wrapper component. maybe we don't nedd this. think about it
export const shimRoutes = (routes: any, Parent: any, UpgradedParent: any) =>
  Object.keys(routes).reduce((map, route) => {
    const getOriginal = routes[route].getScreen
    // don't wrap upgraded ones
    if (routes[route].upgraded) {
      if (UpgradedParent) {
        map[route] = {
          ...routes[route],
          getScreen: () => {
            const Original = getOriginal()
            class Shimmed extends React.PureComponent<any> {
              static navigationOptions = Original.navigationOptions
              render() {
                return (
                  <UpgradedParent>
                    <Original {...this.props} />
                  </UpgradedParent>
                )
              }
            }
            return Shimmed
          },
        }
      } else {
        map[route] = routes[route]
      }
    } else {
      map[route] = {
        ...routes[route],
        getScreen: () => {
          const Original = getOriginal()
          class Shimmed extends React.PureComponent<any> {
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
              const wrapped = (
                <Original
                  navigation={this.props.navigation}
                  routeProps={this._routeProps}
                  shouldRender={true}
                  routeState={this._routeState}
                  routeSelected={null}
                  routePath={this._routePath}
                  routeLeafTags={this._routeLeafTags}
                  routeStack={this._routeLeafTags}
                  setRouteState={this._setRouteState}
                  navigateUp={this._navigateUp}
                  navigateAppend={this._navigateAppend}
                />
              )
              return Parent ? <Parent>{wrapped}</Parent> : wrapped
            }
          }
          return Shimmed
        },
      }
    }
    return map
  }, {})

const findVisibleRoute = s => {
  if (!s) return null
  if (!s.routes) return s
  const route = s.routes[s.index]
  if (!route) return null
  if (route.routes) return findVisibleRoute(route)
  return route
}
export const oldActionToNewActions = (action: any, navigation: any) => {
  switch (action.type) {
    case RouteTreeGen.navigateTo: // fallthrough
    case RouteTreeGen.switchTo: // fallthrough
    case RouteTreeGen.navigateAppend: {
      if (!navigation) {
        return
      }
      const p = action.payload.path.last
        ? action.payload.path.last()
        : action.payload.path[action.payload.path.length - 1]
      if (!p) {
        return
      }
      let routeName = null
      let params

      if (typeof p === 'string') {
        routeName = p
      } else {
        routeName = p.selected
        params = p.props
      }

      if (!routeName) {
        return
      }
      // don't allow pushing a dupe
      const visible = findVisibleRoute(navigation.state)
      if (visible) {
        if (routeName === visible.routeName && shallowEqual(visible.params, params)) {
          console.log('Skipping append dupe')
          return
        }
      }

      return [StackActions.push({params, routeName})]
    }
    case RouteTreeGen.switchRouteDef: {
      // used to tell if its the login one or app one. this will all go away soon
      const routeName = action.payload.routeDef.defaultSelected === 'tabs:loginTab' ? 'loggedOut' : 'loggedIn'
      const switchStack = [NavigationActions.navigate({params: undefined, routeName})]

      // navving away from default?
      const appendAction = oldActionToNewActions({
        payload: action.payload,
        type: RouteTreeGen.navigateAppend,
      })

      return appendAction ? [...switchStack, ...appendAction] : switchStack
    }
    case RouteTreeGen.navigateUp:
      return [StackActions.pop()]
  }
}

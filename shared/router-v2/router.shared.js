// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import {StackActions} from '@react-navigation/core'
import shallowEqual from 'shallowequal'
import * as RouteTreeGen from '../actions/route-tree-gen'

// Wraps all our screens with a component that injects bridging props that the old screens assumed (routeProps, routeState, etc)
// TODO eventually remove this when we clean up all those components
export const shimRoutes = (routes: any) =>
  Object.keys(routes).reduce((map, route) => {
    const getOriginal = routes[route].getScreen
    // don't wrap upgraded ones
    if (routes[route].upgraded) {
      map[route] = routes[route]
    } else {
      map[route] = {
        getScreen: () => {
          const Original = getOriginal()
          const Shimmed = p => (
            <>
              <Kb.SafeAreaViewTop />
              <Original
                {...p}
                routeProps={{
                  get: key => p.navigation.getParam(key),
                }}
                shouldRender={true}
                routeState={{
                  get: key => {
                    throw new Error('Route state NOT supported anymore')
                  },
                }}
                routeSelected={null}
                routePath={I.List()}
                routeLeafTags={I.Map()}
                routeStack={I.Map()}
                setRouteState={() => {
                  throw new Error('Route state NOT supported anymore')
                }}
                navigateUp={() => RouteTreeGen.createNavigateUp()}
                navigateAppend={p => RouteTreeGen.createNavigateAppend(p)}
              />
            </>
          )

          Shimmed.navigationOptions = Original.navigationOptions
          return Shimmed
        },
      }
    }
    return map
  }, {})

export const oldActionToNewAction = (action: any, navigation: any) => {
  switch (action.type) {
    case RouteTreeGen.navigateTo: // fallthrough
    case RouteTreeGen.navigateAppend:
      {
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

        if (routeName && navigation) {
          const state = navigation.state
          // don't allow pushing a dupe
          const topRoute = state.routes[state.index]
          if (topRoute) {
            if (routeName === topRoute.routeName && shallowEqual(topRoute.params, params)) {
              console.log('Skipping append dupe')
              return
            }
          }

          return StackActions.push({params, routeName})
        }
      }
      break
    case RouteTreeGen.navigateUp:
      return StackActions.pop()
  }
}

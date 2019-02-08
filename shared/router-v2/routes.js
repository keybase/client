// @flow
// This pulls existing routes and converts them into new style routes. This is a temporary
// bridging effort. After we switch over we could simplify this and just have all the routes here and just build static lists with require()/dynamic import
//
// import * as I from 'immutable'
import * as I from 'immutable'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {newRoutes as deviceNewRoutes} from '../devices/routes'
import {newRoutes as chatNewRoutes, newModalRoutes as chatNewModalRoutes} from '../chat/routes'
import {newRoutes as peopleNewRoutes} from '../people/routes'
import {newRoutes as fsNewRoutes} from '../fs/routes'
import {newRoutes as settingsNewRoutes} from '../settings/routes'
import {newRoutes as teamsNewRoutes} from '../teams/routes'
import {newRoutes as walletsNewRoutes} from '../wallets/routes'
import {newRoutes as _loggedOutRoutes} from '../login/routes'
import {newRoutes as gitNewRoutes} from '../git/routes'
import {newRoutes as profileNewRoutes, newModalRoutes as profileNewModalRoutes} from '../profile/routes'
// import OldPeopleRoutes from '../people/routes'
import * as Tabs from '../constants/tabs'

export const nameToTab = {}
const _routes = {}

// const oldRoutes = [] //  [{route: OldPeopleRoutes, tab: Tabs.peopleTab}]

// const convert = ({route, tab, name}) => {
// let r = route
// if (typeof r === 'function') {
// r = r()
// }

// if (nameToTab[name]) {
// console.log('Routev2 bridge, saw dupe route, maybe a dupe?', name)
// // don't allow dupes, there are recursive routes so don't allow that
// return
// }
// nameToTab[name] = tab
// routes[name] = {getScreen: () => r.component}

// const children = I.Map(r.children).toJS()
// Object.keys(children).forEach(name => {
// convert({name, route: children[name], tab})
// })
// }

// oldRoutes.forEach(({route, tab}) => {
// convert({name: tab, route, tab})
// })

const _newRoutes = [
  {route: deviceNewRoutes, tab: Tabs.devicesTab},
  {route: chatNewRoutes, tab: Tabs.chatTab},
  {route: peopleNewRoutes, tab: Tabs.peopleTab},
  {route: profileNewRoutes, tab: Tabs.peopleTab},
  {route: fsNewRoutes, tab: Tabs.fsTab},
  {route: settingsNewRoutes, tab: Tabs.settingsTab},
  {route: teamsNewRoutes, tab: Tabs.teamsTab},
  {route: walletsNewRoutes, tab: Tabs.walletsTab},
  {route: gitNewRoutes, tab: Tabs.gitTab},
]

_newRoutes.forEach(({route, tab}) => {
  Object.keys(route).forEach(name => {
    if (nameToTab[name]) {
      throw new Error('New route with dupe name, disallowed! ' + name)
    }
    nameToTab[name] = tab
    _routes[name] = route[name]
  })
})

const _modalRoutes = {
  ...profileNewModalRoutes,
  ...chatNewModalRoutes,
}

// TEMP
console.log('aaa all routes', _routes)
console.log('aaa all loggedout routes', _loggedOutRoutes)
console.log('aaa all modal routes', _modalRoutes)
console.log('aaa routes to tab', nameToTab)

// Wraps all our screens with a Parent that injects bridging props that the old screens assumed (routeProps, routeState, etc)
// TODO eventually remove this when we clean up all those components
// Wraps all new routes with a UpgradedParent that adds keyboard avoiding etc (maybe we can move this up)
const shimRoutes = (routes: any) =>
  Object.keys(routes).reduce((map, route) => {
    const getOriginal = routes[route].getScreen
    // don't wrap upgraded ones
    if (routes[route].upgraded) {
      // if (UpgradedParent) {
      // // Don't recreate these classes every time getScreen is called
      // let _cached = null
      // map[route] = {
      // ...routes[route],
      // getScreen: () => {
      // if (_cached) return _cached

      // const Original = getOriginal()
      // class Shimmed extends React.PureComponent<any> {
      // static navigationOptions = Original.navigationOptions
      // render() {
      // return (
      // <UpgradedParent>
      // <Original {...this.props} />
      // </UpgradedParent>
      // )
      // }
      // }
      // _cached = Shimmed
      // return Shimmed
      // },
      // }
      // } else {
      map[route] = routes[route]
      // }
    } else {
      let _cached = null
      map[route] = {
        ...routes[route],
        getScreen: () => {
          if (_cached) return _cached
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
              // return Parent ? <Parent>{wrapped}</Parent> : wrapped
              return wrapped
            }
          }
          _cached = Shimmed
          return Shimmed
        },
      }
    }
    return map
  }, {})

export const loggedOutRoutes = shimRoutes(_loggedOutRoutes)
export const modalRoutes = shimRoutes(_modalRoutes)
export const routes = shimRoutes(_routes)

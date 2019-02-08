// @flow
// This pulls existing routes and converts them into new style routes. This is a temporary
// bridging effort. After we switch over we could simplify this and just have all the routes here and just build static lists with require()/dynamic import
//
// import * as I from 'immutable'
import {newRoutes as deviceNewRoutes} from '../devices/routes'
import {newRoutes as chatNewRoutes} from '../chat/routes'
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
export const routes = {}

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

const newRoutes = [
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

newRoutes.forEach(({route, tab}) => {
  Object.keys(route).forEach(name => {
    if (nameToTab[name]) {
      throw new Error('New route with dupe name, disallowed! ' + name)
    }
    nameToTab[name] = tab
    routes[name] = route[name]
  })
})

export const modalRoutes = {
  ...profileNewModalRoutes,
}

export const loggedOutRoutes = _loggedOutRoutes

// TEMP
console.log('aaa all routes', routes)
console.log('aaa all loggedout routes', loggedOutRoutes)
console.log('aaa all modal routes', modalRoutes)
console.log('aaa routes to tab', nameToTab)

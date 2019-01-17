// @flow
// This pulls existing routes and converts them into new style routes. This is a temporary
// bridging effort. After we switch over we could simplify this and just have all the routes here and just build static lists with require()/dynamic import
//
import * as I from 'immutable'
import OldDeviceRoutes from '../devices/routes'
import OldPeopleRoutes from '../people/routes'
import * as Tabs from '../constants/tabs'

const nameToTab = {}
const routes = {}

const oldRoutes = [
  {route: OldDeviceRoutes, tab: Tabs.devicesTab},
  {route: OldPeopleRoutes, tab: Tabs.peopleTab},
]

const convert = ({route, tab, name}) => {
  let r = route
  if (typeof r === 'function') {
    r = r()
  }

  const prefix = tab + ':'
  let screenName = prefix + name
  if (nameToTab[screenName]) {
    // don't allow dupes, there are recursive routes so don't allow that
    return
  }
  nameToTab[screenName] = tab
  routes[screenName] = r.component

  const children = I.Map(r.children).toJS()
  Object.keys(children).forEach(name => {
    convert({name, route: children[name], tab})
  })
}

oldRoutes.forEach(({route, tab}) => {
  convert({name: 'root', route, tab})
})

export default routes

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

  if (nameToTab[name]) {
    console.log('Routev2 bridge, saw dupe route, maybe a dupe?', name)
    // don't allow dupes, there are recursive routes so don't allow that
    return
  }
  nameToTab[name] = tab
  routes[name] = r.component

  const children = I.Map(r.children).toJS()
  Object.keys(children).forEach(name => {
    convert({name, route: children[name], tab})
  })
}

oldRoutes.forEach(({route, tab}) => {
  convert({name: tab, route, tab})
})

export default routes

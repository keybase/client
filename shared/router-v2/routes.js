// @flow
// This pulls existing routes and converts them into new style routes. This is a temporary
// bridging effort. After we switch over we could simplify this and just have all the routes here
//
import * as I from 'immutable'
import OldDeviceRoutes from '../devices/routes'
import * as Tabs from '../constants/tabs'

const nameToTab = {}
const routes = {}

const oldRoutes = [{routes: OldDeviceRoutes, tab: Tabs.devicesTab}]

const convert = ({route, tab, name}) => {
  const prefix = tab + ':'
  let screenName = prefix + name
  nameToTab[screenName] = tab
  routes[screenName] = route.component

  const children = I.Map(route.children).toJS()
  Object.keys(children).forEach(name => {
    convert({name, route: children[name], tab})
  })
}

oldRoutes.forEach(({routes, tab}) => {
  let route = routes
  if (typeof routes === 'function') {
    route = route()
  }
  convert({name: 'root', route, tab})
})

export default routes
// const Home = p => <p onClick={() => p.navigation.navigate('Docs')}>HOME</p>
// const Docs = p => <p onClick={() => p.navigation.navigate('Home')}>Docs</p>

// export default {
// Home: {getScreen: () => Home},
// Docs: {getScreen: () => Docs},
// }

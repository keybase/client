// @flow
// This pulls existing routes and converts them into new style routes. This is a temporary
// bridging effort. After we switch over we could simplify this and just have all the routes here
//
import * as React from 'react'
import OldDeviceRoutes from '../devices/routes'

const oldRoutes = [OldDeviceRoutes]
const routes = oldRoutes.reduce((map, old) => {
  if (typeof old === 'function') {
    old = old()
  }
  console.log('aaa', old)

  return map
}, {})

const Home = p => <p onClick={() => p.navigation.navigate('Docs')}>HOME</p>
const Docs = p => <p onClick={() => p.navigation.navigate('Home')}>Docs</p>

export default {
  Home: {getScreen: () => Home},
  Docs: {getScreen: () => Docs},
}
// export default routes

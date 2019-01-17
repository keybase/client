// @flow
// This pulls existing routes and converts them into new style routes. This is a temporary
// bridging effort. After we switch over we could simplify this and just have all the routes here
//
import OldDeviceRoutes from '../device/routes'


const oldRoutes = [OldDeviceRoutes]
const routes = oldRoutes.reduce((map, old) => {
  console.log('aaa', old)

  return map
}, {})

export default routes

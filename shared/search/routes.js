// @flow
import Search from './container'
import {RouteDefNode} from '../route-tree'
import {isMobile} from '../constants/platform'
import {profileRoute} from '../profile/routes'
import NonUser from './user-pane/non-user.container'

const routeTree = new RouteDefNode({
  children: {
    profile: profileRoute,
    ...(isMobile
      ? {
          nonProfile: {
            component: NonUser,
          },
        }
      : {}),
  },
  component: Search,
})

export default routeTree

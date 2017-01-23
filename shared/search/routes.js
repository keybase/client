// @flow
import {RouteDefNode} from '../route-tree'
import {profileRoute} from '../profile/routes'
import Search from './container'

const routeTree = new RouteDefNode({
  children: {
    profile: profileRoute,
  },
  component: Search,
})

export default routeTree

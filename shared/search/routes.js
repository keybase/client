// @flow
import {RouteDefNode} from '../route-tree'
import {profileRoute} from '../profile/routes'
import Search from './'

const routeTree = new RouteDefNode({
  component: Search,
  children: {
    profile: profileRoute,
  },
})

export default routeTree

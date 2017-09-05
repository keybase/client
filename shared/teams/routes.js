// @flow
import TeamsContainer from './container'
import {RouteDefNode} from '../route-tree'

const routeTree = new RouteDefNode({
  component: TeamsContainer,
  tags: {title: 'Teams'},
})

export default routeTree

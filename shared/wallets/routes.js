// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import Container from './container'

const routeTree = makeRouteDefNode({
  children: {},
  component: Container,
  defaultSelected: '',
  tags: makeLeafTags({}),
})

export default routeTree

// @flow
import MainPage from './container.js'
import {RouteDefNode} from '../route-tree'

const routeTree = new RouteDefNode({
  children: {},
  component: MainPage,
  tags: {title: 'Git'},
})

export default routeTree

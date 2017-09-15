// @flow
import * as I from 'immutable'
import MainPage from './container.js'
import NewRepo from './new-repo/container'
import DeleteRepo from './delete-repo/container'
import {RouteDefNode} from '../route-tree'

const routeTree = new RouteDefNode({
  children: {
    deleteRepo: {
      component: DeleteRepo,
    },
    newRepo: {
      component: NewRepo,
    },
  },
  component: MainPage,
  initialState: {expandedSet: I.Set()},
  tags: {title: 'Git'},
})

export default routeTree

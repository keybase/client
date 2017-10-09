// @flow
import * as I from 'immutable'
import MainPage from './container.js'
import NewRepo from './new-repo/container'
import DeleteRepo from './delete-repo/container'
import {makeRouteDefNode} from '../route-tree'

const routeTree = makeRouteDefNode({
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

// @flow
import * as I from 'immutable'
import MainPage from './container.js'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const routeTree = makeRouteDefNode({
  children: {},
  component: MainPage,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Fs'}),
})

export default routeTree

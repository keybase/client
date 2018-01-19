// @flow
import * as I from 'immutable'
import Files from './container.js'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const routeTree = makeRouteDefNode({
  children: {},
  component: Files,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Files'}),
})

export default routeTree

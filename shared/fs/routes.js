// @flow
import * as I from 'immutable'
import Files from './container'
import {Folder} from '.'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const folderRoute = makeRouteDefNode({
  children: {
    folder: () => folderRoute,
  },
  component: Files,
})

const routeTree = makeRouteDefNode({
  children: {
    folder: folderRoute,
  },
  component: Files,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Files'}),
})

export default routeTree

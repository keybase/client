// @flow
import * as I from 'immutable'
import Files from './container'
import ConnectedDropdownPopupMenu from './header/popup-container'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc.desktop'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const folderRoute = makeRouteDefNode({
  children: {
    folder: () => folderRoute,
    breadcrumbAction: {
      component: RelativePopupHoc(ConnectedDropdownPopupMenu),
      tags: makeLeafTags({layerOnTop: true}),
    },
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

// @flow
import * as I from 'immutable'
import Files from './container'
import BreadcrumbPopupMenu from './header/breadcrumb-popup'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const folderRoute = makeRouteDefNode({
  children: {
    folder: () => folderRoute,
    breadcrumbAction: {
      component: RelativePopupHoc(BreadcrumbPopupMenu),
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

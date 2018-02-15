// @flow
import * as React from 'react'
import * as I from 'immutable'
import Files from './container'
import ConnectedDropdownPopupMenu from './header/popup-container'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc.desktop'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'
import {Box} from '../common-adapters'

const folderRoute = makeRouteDefNode({
  children: {
    folder: () => folderRoute,
    breadcrumbAction: {
      component: isMobile ? <Box /> : RelativePopupHoc(ConnectedDropdownPopupMenu),
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

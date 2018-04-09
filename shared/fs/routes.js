// @flow
import * as I from 'immutable'
import Files from './container'
import FilePreview from './filepreview/container'
import SortBarPopupMenu from './sortbar/sort-setting-popup.js'
import BreadcrumbPopupMenu from './popups/breadcrumb-popup-container'
import FinderPopupMenu from './finder-popup'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import RowPopupMenu from './popups/row-action-popup-container'
import TransferPopup from './popups/transfer-container.js'

const _folderRoute = {
  children: {
    folder: () => folderRoute,
    preview: {
      component: FilePreview,
      initialState: {},
      tags: makeLeafTags({title: 'Preview'}),
    },
    breadcrumbAction: {
      component: RelativePopupHoc(BreadcrumbPopupMenu),
      tags: makeLeafTags({layerOnTop: true}),
    },
    sortbarAction: {
      component: RelativePopupHoc(SortBarPopupMenu),
      tags: makeLeafTags({layerOnTop: true}),
    },
    rowAction: {
      component: RelativePopupHoc(RowPopupMenu),
      tags: makeLeafTags({layerOnTop: true}),
    },
    finderAction: {
      component: RelativePopupHoc(FinderPopupMenu),
      tags: makeLeafTags({layerOnTop: true}),
    },
    transferPopup: {
      component: RelativePopupHoc(TransferPopup),
      tags: makeLeafTags({layerOnTop: true}),
    },
  },
  component: Files,
}

const folderRoute = makeRouteDefNode(_folderRoute)

const routeTree = makeRouteDefNode({
  ..._folderRoute,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Files'}),
})

export default routeTree

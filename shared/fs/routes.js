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
import SecurityPrefs from './common/security-prefs-container'

const _commonChildren = {
  finderAction: {
    component: RelativePopupHoc(FinderPopupMenu),
    tags: makeLeafTags({layerOnTop: true}),
  },
  pathItemAction: {
    component: RelativePopupHoc(RowPopupMenu),
    tags: makeLeafTags({layerOnTop: true}),
  },
  transferPopup: {
    component: RelativePopupHoc(TransferPopup),
    tags: makeLeafTags({layerOnTop: true}),
  },
  securityPrefs: {
    component: SecurityPrefs,
  },
}

const _folderRoute = {
  children: {
    ..._commonChildren,
    folder: () => makeRouteDefNode(_folderRoute),
    preview: {
      component: FilePreview,
      children: _commonChildren,
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
  },
  component: Files,
}

const routeTree = makeRouteDefNode({
  ..._folderRoute,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Files'}),
})

export default routeTree

// @flow
import * as I from 'immutable'
import BreadcrumbPopupMenu from './popups/breadcrumb-popup-container'
import Files from './container'
import {BarePreview, NormalPreview} from './filepreview'
import FinderPopupMenu from './finder-popup'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc'
import RowPopupMenu from './popups/row-action-popup-container'
import SecurityPrefs from './common/security-prefs-container'
import SortBarPopupMenu from './sortbar/sort-setting-popup.js'
import DownloadPopup from './popups/download-container'

const _commonChildren = {
  finderAction: {
    component: RelativePopupHoc(FinderPopupMenu),
    tags: makeLeafTags({layerOnTop: true}),
  },
  pathItemAction: {
    component: RelativePopupHoc(RowPopupMenu),
    tags: makeLeafTags({layerOnTop: true}),
  },
  downloadPopup: {
    component: RelativePopupHoc(DownloadPopup),
    tags: makeLeafTags({layerOnTop: true}),
  },
  securityPrefs: {
    component: SecurityPrefs,
  },
  barePreview: () =>
    makeRouteDefNode({
      component: BarePreview,
      children: _commonChildren,
      tags: makeLeafTags({
        hideStatusBar: true,
        fullscreen: true,
        title: 'Preview',
      }),
    }),
  preview: () =>
    makeRouteDefNode({
      component: NormalPreview,
      children: _commonChildren,
      tags: makeLeafTags({
        title: 'Preview',
      }),
    }),
}

const _folderRoute = {
  children: {
    ..._commonChildren,
    folder: () => makeRouteDefNode(_folderRoute),
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

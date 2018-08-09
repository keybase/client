// @flow
import * as I from 'immutable'
import Files from './container'
import {BarePreview, NormalPreview} from './filepreview'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc'
import SecurityPrefs from './common/security-prefs-container'
import DownloadPopup from './popups/download-container'

const _commonChildren = {
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
  },
  component: Files,
}

const routeTree = makeRouteDefNode({
  ..._folderRoute,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Files'}),
})

export default routeTree

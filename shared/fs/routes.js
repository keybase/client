// @flow
import * as I from 'immutable'
import Files from './container'
import {BarePreview, NormalPreview} from './filepreview'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import SecurityPrefs from './common/security-prefs-container'

const _commonChildren = {
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
        underStatusBar: true,
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

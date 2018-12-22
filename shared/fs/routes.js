// @flow
import * as I from 'immutable'
import Files from './container'
import {isMobile} from '../constants/platform'
import {BarePreview} from './filepreview'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import SecurityPrefs from './common/security-prefs-container'
import DestinationPicker from './destination-picker/container'
import SendLinkToChat from './send-link-to-chat/container'
import OopsNoAccess from './oops-no-access/container'

const _destinationPicker = {
  children: {
    destinationPicker: () => makeRouteDefNode(_destinationPicker),
  },
  component: DestinationPicker,
  tags: makeLeafTags({
    layerOnTop: !isMobile,
    renderTopmostOnly: !isMobile,
    title: 'Move or Copy',
  }),
}

const _commonChildren = {
  destinationPicker: () => makeRouteDefNode(_destinationPicker),
  securityPrefs: {
    component: SecurityPrefs,
  },
  sendLinkToChat: {
    component: SendLinkToChat,
    tags: makeLeafTags({
      layerOnTop: !isMobile,
      renderTopmostOnly: !isMobile,
      title: 'Send link to chat',
    }),
  },
}

const _mainRoute = {
  children: {
    ..._commonChildren,
    barePreview: () =>
      makeRouteDefNode({
        children: _commonChildren,
        component: BarePreview,
        tags: makeLeafTags({
          fullscreen: true,
          title: 'Preview',
        }),
      }),
    main: () => makeRouteDefNode(_mainRoute),
    oopsNoAccess: () =>
      makeRouteDefNode({
        component: OopsNoAccess,
        tags: makeLeafTags({
          layerOnTop: !isMobile,
          renderTopmostOnly: !isMobile,
          title: 'Permission error',
        }),
      }),
  },
  component: Files,
}

const routeTree = makeRouteDefNode({
  ..._mainRoute,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Files'}),
})

export default routeTree

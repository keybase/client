// @flow
import * as I from 'immutable'
import {isMobile} from '../constants/platform'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const routeTree = () => {
  const Files = require('./container').default
  const {BarePreview} = require('./filepreview')
  const SecurityPrefs = require('./common/security-prefs-container').default
  const DestinationPicker = require('./destination-picker/container').default
  const SendLinkToChat = require('./send-link-to-chat/container').default
  const Oops = require('./oops/container').default

  const _destinationPicker = {
    children: {
      destinationPicker: () => makeRouteDefNode(_destinationPicker),
    },
    component: DestinationPicker,
    tags: makeLeafTags({
      fullscreen: isMobile,
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
        fullscreen: isMobile,
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
      oops: () =>
        makeRouteDefNode({
          component: Oops,
          tags: makeLeafTags({
            fullscreen: isMobile,
            layerOnTop: !isMobile,
            renderTopmostOnly: !isMobile,
            title: 'Permission error',
          }),
        }),
    },
    component: Files,
  }
  return makeRouteDefNode({
    ..._mainRoute,
    initialState: {expandedSet: I.Set()},
    tags: makeLeafTags({title: 'Files'}),
  })
}

export default routeTree

// @flow
import * as I from 'immutable'
import {isMobile} from '../constants/platform'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const routeTree = () => {
  const Files = require('./container').default
  const {BarePreview} = require('./filepreview')
  const KextPermissionPopup = require('./banner/system-file-manager-integration-banner/kext-permission-popup-container')
    .default
  const DestinationPicker = require('./destination-picker/container').default
  const ReallyDelete = require('./really-delete/container').default
  const SendLinkToChat = require('./send-link-to-chat/container').default
  const SendAttachmentToChat = require('./send-attachment-to-chat/container').default
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
    ...(isMobile
      ? {}
      : {
          kextPermission: {
            component: KextPermissionPopup,
            tags: makeLeafTags({
              layerOnTop: true,
              renderTopmostOnly: true,
            }),
          },
        }),
    reallyDelete: {
      component: ReallyDelete,
      tags: makeLeafTags({
        fullscreen: isMobile,
        layerOnTop: !isMobile,
        renderTopmostOnly: !isMobile,
        title: 'Really Delete Folder?',
      }),
    },
    sendAttachmentToChat: {
      component: SendAttachmentToChat,
      tags: makeLeafTags({
        fullscreen: isMobile,
        layerOnTop: !isMobile,
        renderTopmostOnly: !isMobile,
        title: 'Send attachment to chat',
      }),
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

export const newRoutes = {
  main: {getScreen: () => require('./container').default, upgraded: true},
  'settingsTabs.fsTab': {getScreen: () => require('./container').default, upgraded: true},
  'tabs.fsTab': {getScreen: () => require('./container').default, upgraded: true},
}

export const newModalRoutes = {
  barePreview: {getScreen: () => require('./filepreview').BarePreview},
  destinationPicker: {getScreen: () => require('./destination-picker/container').default, upgraded: true},
  oops: {getScreen: () => require('./oops/container').default, upgraded: true},
  reallyDelete: {getScreen: () => require('./really-delete/container').default, upgraded: true},
  sendAttachmentToChat: {
    getScreen: () => require('./send-attachment-to-chat/container').default,
    upgraded: true,
  },
  sendLinkToChat: {getScreen: () => require('./send-link-to-chat/container').default, upgraded: true},
}

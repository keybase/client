// @flow
import * as I from 'immutable'
import Files from './container'
import {isMobile} from '../constants/platform'
import {BarePreview} from './filepreview'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import SecurityPrefs from './common/security-prefs-container'
import DestinationPicker from './destination-picker/container'
import SendLinkToChat from './send-link-to-chat/container'

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
  },
  component: Files,
}

const routeTree = makeRouteDefNode({
  ..._mainRoute,
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Files'}),
})

export default routeTree

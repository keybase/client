// @flow
import {RouteDefNode} from '../route-tree'
import ConversationList from './conversations-list/container'
import Conversation from './conversation/container'
import EnterPaperkey from './conversation/enter-paper-key'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import MessagePopup from './conversation/messages/popup.native'

const conversationRoute = new RouteDefNode({
  component: Conversation,
  children: {
    attachment: {
      component: AttachmentPopup,
      tags: {hideStatusBar: true, fullscreen: true},
      children: {},
    },
    attachmentInput: {
      component: AttachmentInputPopup,
      tags: {layerOnTop: true},
      children: {},
    },
    messageAction: {
      component: MessagePopup,
      tags: {layerOnTop: true},
    },
    enterPaperkey: {
      component: EnterPaperkey,
    },
  },
})

const routeTree = new RouteDefNode({
  component: ConversationList,
  children: () => conversationRoute,
  tags: {persistChildren: true, underStatusBar: true},
})

export default routeTree

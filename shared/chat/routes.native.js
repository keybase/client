// @flow
import {RouteDefNode} from '../route-tree'
import ConversationList from './conversations-list/container'
import Conversation from './conversation/container'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import MessagePopup from './conversation/messages/popup.native'

const conversationRoute = new RouteDefNode({
  component: Conversation,
  children: {
    attachment: {
      component: AttachmentPopup,
      tags: {layerOnTop: true},
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
  },
})

const routeTree = new RouteDefNode({
  component: ConversationList,
  children: () => conversationRoute,
  tags: {persistChildren: true},
})

export default routeTree

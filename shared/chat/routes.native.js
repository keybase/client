// @flow
import {RouteDefNode} from '../route-tree'
import ConversationList from './conversations-list/container'
import Conversation from './conversation/container'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import MessagePopup from './conversation/messages/popup.native'
import {nothingSelected} from '../constants/chat'

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
  defaultSelected: nothingSelected,
  children: (name) => {
    if (name === nothingSelected) {
      return new RouteDefNode({component: ConversationList})
    }
    return conversationRoute
  },
})

export default routeTree

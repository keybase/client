// @flow
import {RouteDefNode} from '../route-tree'
import ConversationList from './conversations-list/container'
import Conversation from './conversation/container'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
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
  },
})

const routeTree = new RouteDefNode({
  containerComponent: ConversationList,
  defaultSelected: nothingSelected,
  children: () => conversationRoute,
})

export default routeTree

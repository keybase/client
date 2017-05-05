// @flow
import {RouteDefNode} from '../route-tree'
import ConversationList from './inbox/container'
import Conversation from './conversation/container'
import EnterPaperkey from './conversation/rekey/enter-paper-key'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import MessagePopup from './conversation/messages/popup.native'
import BlockConversationWarning from './conversation/block-conversation-warning/container'

const conversationRoute = new RouteDefNode({
  component: Conversation,
  children: {
    attachment: {
      component: AttachmentPopup,
      tags: {hideStatusBar: true, fullscreen: true},
      children: {
        messageAction: {
          component: MessagePopup,
          tags: {layerOnTop: true},
        },
      },
    },
    attachmentInput: {
      component: AttachmentInputPopup,
      tags: {layerOnTop: true},
      children: {},
    },
    enterPaperkey: {
      component: EnterPaperkey,
    },
    messageAction: {
      component: MessagePopup,
      tags: {keepKeyboardOnLeave: true, layerOnTop: true},
    },
    showBlockConversationDialog: {
      component: BlockConversationWarning,
      tags: {layerOnTop: true},
      children: {},
    },

  },
})

const routeTree = new RouteDefNode({
  component: ConversationList,
  children: () => conversationRoute,
  tags: {persistChildren: true, underStatusBar: true},
})

export default routeTree

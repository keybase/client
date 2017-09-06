// @flow
import {RouteDefNode} from '../route-tree'
import ConvListOrSearch from './conversation-list-or-search.native'
import Conversation from './conversation/container'
import EnterPaperkey from './conversation/rekey/enter-paper-key'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import MessagePopup from './conversation/messages/popup.native'
import BlockConversationWarning from './conversation/block-conversation-warning/container'
import InfoPanel from './conversation/info-panel/container'
import NewTeamDialog from '../teams/new-team/container'
import ManageChannels from './manage-channels/container'
import CreateChannel from './create-channel/container'

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
    infoPanel: {
      component: InfoPanel,
      children: {
        showBlockConversationDialog: {
          component: BlockConversationWarning,
          tags: {hideStatusBar: true},
          children: {},
        },
      },
    },
    enterPaperkey: {
      component: EnterPaperkey,
    },
    messageAction: {
      component: MessagePopup,
      tags: {keepKeyboardOnLeave: true, layerOnTop: true},
    },
    showNewTeamDialog: {
      component: NewTeamDialog,
      tags: {layerOnTop: true},
      children: {},
    },
  },
})

const manageChannelsRoute = new RouteDefNode({
  component: ManageChannels,
  children: {},
  tags: {hideStatusBar: true, underStatusBar: true},
})

const createChannelRoute = new RouteDefNode({
  component: CreateChannel,
  tags: {hideStatusBar: true, underStatusBar: true},
  children: {},
})

const routeTree = new RouteDefNode({
  component: ConvListOrSearch,
  children: key => {
    if (key === 'manageChannels') {
      return manageChannelsRoute
    } else if (key === 'createChannel') {
      return createChannelRoute
    }

    return conversationRoute
  },
  tags: {persistChildren: true},
})

export default routeTree

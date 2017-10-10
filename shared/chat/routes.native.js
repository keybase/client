// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import ConvListOrSearch from './conversation-list-or-search.native'
import Conversation from './conversation/container'
import EnterPaperkey from './conversation/rekey/enter-paper-key'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import MessagePopup from './conversation/messages/popup.native'
import BlockConversationWarning from './conversation/block-conversation-warning/container'
import InfoPanel from './conversation/info-panel/container'
import NewTeamDialog from './new-team-dialog-container.js'
import ManageChannels from './manage-channels/container'
import CreateChannel from './create-channel/container'

const conversationRoute = makeRouteDefNode({
  component: Conversation,
  children: {
    attachment: {
      component: AttachmentPopup,
      tags: makeLeafTags({hideStatusBar: true, fullscreen: true}),
      children: {
        messageAction: {
          component: MessagePopup,
          tags: makeLeafTags({layerOnTop: true}),
        },
      },
    },
    attachmentInput: {
      component: AttachmentInputPopup,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    infoPanel: {
      component: InfoPanel,
      children: {
        showBlockConversationDialog: {
          component: BlockConversationWarning,
          tags: makeLeafTags({hideStatusBar: true}),
          children: {},
        },
        showNewTeamDialog: {
          component: NewTeamDialog,
          tags: makeLeafTags({layerOnTop: true}),
          children: {},
        },
      },
    },
    enterPaperkey: {
      component: EnterPaperkey,
    },
    messageAction: {
      component: MessagePopup,
      tags: makeLeafTags({keepKeyboardOnLeave: true, layerOnTop: true}),
    },
    showNewTeamDialog: {
      component: NewTeamDialog,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
  },
})

const manageChannelsRoute = makeRouteDefNode({
  component: ManageChannels,
  children: {},
  tags: makeLeafTags({hideStatusBar: true}),
})

const createChannelRoute = makeRouteDefNode({
  component: CreateChannel,
  tags: makeLeafTags({hideStatusBar: true}),
  children: {},
})

const routeTree = makeRouteDefNode({
  component: ConvListOrSearch,
  children: key => {
    if (key === 'manageChannels') {
      return manageChannelsRoute
    } else if (key === 'createChannel') {
      return createChannelRoute
    }

    return conversationRoute
  },
  tags: makeLeafTags({persistChildren: true}),
})

export default routeTree

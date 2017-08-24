// @flow
import {RouteDefNode} from '../route-tree'
import Conversation from './conversation/container'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import BlockConversationWarning from './conversation/block-conversation-warning/container'
import NewTeamDialog from './conversation/new-team/container'
import ManageChannels from './manage-channels/container'
import CreateChannel from './create-channel/container'
import {nothingSelected} from '../constants/chat'
import Render from './render.desktop'

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
    showBlockConversationDialog: {
      component: BlockConversationWarning,
      tags: {layerOnTop: true},
      children: {},
    },
    showNewTeamDialog: {
      component: NewTeamDialog,
      tags: {layerOnTop: true},
      children: {},
    },
    manageChannels: {
      component: ManageChannels,
      tags: {layerOnTop: true},
      children: {},
    },
    createChannel: {
      component: CreateChannel,
      tags: {layerOnTop: true},
      children: {},
    },
  },
})

const routeTree = new RouteDefNode({
  containerComponent: Render,
  defaultSelected: nothingSelected,
  children: () => conversationRoute,
  tags: {persistChildren: true},
})

export default routeTree

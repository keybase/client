// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import Conversation from './conversation/container'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import BlockConversationWarning from './conversation/block-conversation-warning/container'
import NewTeamDialogFromChat from './new-team-dialog-container.js'
import ManageChannels from './manage-channels/container'
import CreateChannel from './create-channel/container'
import TeamInfo from './team-info/container'
import {nothingSelected} from '../constants/chat'
import Render from './render.desktop'

const conversationRoute = makeRouteDefNode({
  component: Conversation,
  children: {
    attachment: {
      component: AttachmentPopup,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    attachmentInput: {
      component: AttachmentInputPopup,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    showBlockConversationDialog: {
      component: BlockConversationWarning,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    showNewTeamDialog: {
      component: NewTeamDialogFromChat,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    manageChannels: {
      component: ManageChannels,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    teamInfo: {
      component: TeamInfo,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    createChannel: {
      component: CreateChannel,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
  },
})

const routeTree = makeRouteDefNode({
  containerComponent: Render,
  defaultSelected: nothingSelected,
  children: () => conversationRoute,
  tags: makeLeafTags({persistChildren: true}),
  initialState: {smallTeamsExpanded: false},
})

export default routeTree

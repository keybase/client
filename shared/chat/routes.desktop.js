// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {MaybePopupHoc} from '../common-adapters'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc.desktop'
import Conversation from './conversation/container'
import AttachmentPopup from './conversation/attachment-popup/container'
import AttachmentInputPopup from './conversation/attachment-input/container'
import BlockConversationWarning from './conversation/block-conversation-warning/container'
import NewTeamDialogFromChat from './new-team-dialog-container.js'
import ManageChannels from './manage-channels/container'
import DeleteHistoryWarning from './delete-history-warning/container'
import {ConnectedMessageAction} from './conversation/messages/popup.desktop'
import EditChannel from './manage-channels/edit-channel-container'
import CreateChannel from './create-channel/container'
import {nothingSelected} from '../constants/chat'
import Render from './render.desktop'
import ReallyLeaveTeam from '../teams/really-leave-team/container-chat'
import {isMobile} from '../constants/platform'

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
    messageAction: {
      component: RelativePopupHoc(ConnectedMessageAction),
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    deleteHistoryWarning: {
      component: MaybePopupHoc(false)(DeleteHistoryWarning),
      tags: makeLeafTags({layerOnTop: !isMobile}),
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
      children: {
        editChannel: {
          component: MaybePopupHoc(false)(EditChannel),
          tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
          children: {},
        },
      },
    },
    createChannel: {
      component: CreateChannel,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    reallyLeaveTeam: {
      children: {},
      component: ReallyLeaveTeam,
      tags: makeLeafTags({layerOnTop: !isMobile}),
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

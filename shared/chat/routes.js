// @flow
import AttachmentInputPopup from './conversation/attachment-input/container'
import AttachmentPopup from './conversation/attachment-popup/container'
import BlockConversationWarning from './conversation/block-conversation-warning/container'
import Conversation from './conversation/container'
import CreateChannel from './create-channel/container'
import EditChannel from './manage-channels/edit-channel-container'
import EnterPaperkey from './conversation/rekey/enter-paper-key'
import Inbox from './inbox/container'
import InfoPanel from './conversation/info-panel/container'
import ManageChannels from './manage-channels/container'
import MessagePopup from './conversation/messages/message-popup'
import NewTeamDialogFromChat from './new-team-dialog-container'
import ReallyLeaveTeam from '../teams/really-leave-team/container-chat'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc'
import Render from './render'
import {MaybePopupHoc} from '../common-adapters'
import {isMobile} from '../constants/platform'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import DeleteHistoryWarning from './delete-history-warning/container'

const conversationRoute = makeRouteDefNode({
  component: Conversation,
  children: {
    attachment: {
      component: AttachmentPopup,
      tags: makeLeafTags(isMobile ? {hideStatusBar: true, fullscreen: true} : {layerOnTop: true}),
      children: {
        messageAction: {
          component: RelativePopupHoc(MessagePopup),
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
        reallyLeaveTeam: {
          component: ReallyLeaveTeam,
          tags: makeLeafTags({layerOnTop: false}),
          children: {},
        },
        showBlockConversationDialog: {
          component: BlockConversationWarning,
          tags: makeLeafTags({hideStatusBar: true}),
          children: {},
        },
        showNewTeamDialog: {
          component: NewTeamDialogFromChat,
          tags: makeLeafTags({layerOnTop: true}),
          children: {},
        },
      },
    },
    showBlockConversationDialog: {
      component: BlockConversationWarning,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    deleteHistoryWarning: {
      component: DeleteHistoryWarning,
      tags: makeLeafTags({layerOnTop: false}),
      children: {},
    },
    messageAction: {
      component: RelativePopupHoc(MessagePopup),
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
    enterPaperkey: {
      component: EnterPaperkey,
    },
  },
})

const manageChannelsRoute = makeRouteDefNode({
  component: ManageChannels,
  children: {
    editChannel: {
      component: EditChannel,
      tags: makeLeafTags({hideStatusBar: true, layerOnTop: false}),
      children: {},
    },
  },
  tags: makeLeafTags({hideStatusBar: true}),
})

const createChannelRoute = makeRouteDefNode({
  component: CreateChannel,
  tags: makeLeafTags({hideStatusBar: true}),
  children: {},
})

const routeTree = isMobile
  ? makeRouteDefNode({
      component: Inbox,
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
  : makeRouteDefNode({
      containerComponent: Render,
      defaultSelected: '0',
      children: () => conversationRoute,
      tags: makeLeafTags({persistChildren: true}),
      initialState: {smallTeamsExpanded: false},
    })

export default routeTree

// @flow
import * as WalletConstants from '../constants/wallets'
import AttachmentGetTitles from './conversation/attachment-get-titles/container'
import AttachmentFullscreen from './conversation/attachment-fullscreen/container'
import AttachmentVideoFullscreen from './conversation/attachment-video-fullscreen/container'
import BlockConversationWarning from './conversation/block-conversation-warning/container'
import Conversation from './conversation/container'
import CreateChannel from './create-channel/container'
import EditChannel from './manage-channels/edit-channel-container'
import EnterPaperkey from './conversation/rekey/enter-paper-key'
import Inbox from './inbox/container'
import InfoPanel from './conversation/info-panel/container'
import ManageChannels from './manage-channels/container'
import NewTeamDialogFromChat from './new-team-dialog-container'
import ReallyLeaveTeam from '../teams/really-leave-team/container-chat'
import InboxAndConversation from './inbox-and-conversation'
import {MaybePopupHoc} from '../common-adapters'
import {isMobile} from '../constants/platform'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import DeleteHistoryWarning from './delete-history-warning/container'
import RetentionWarning from '../teams/team/settings-tab/retention/warning/container'
import ChooseEmoji from './conversation/messages/react-button/emoji-picker/container'
import ConfirmForm from '../wallets/confirm-form/container'
import SendForm from '../wallets/send-form/container'

// Arbitrarily stackable routes from the chat tab
const chatChildren = {
  chooseEmoji: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: ChooseEmoji,
    tags: makeLeafTags({layerOnTop: false}),
  },
  createChannel: {
    component: CreateChannel,
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  editChannel: {
    component: MaybePopupHoc(isMobile)(EditChannel),
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  manageChannels: {
    component: ManageChannels,
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  reallyLeaveTeam: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: ReallyLeaveTeam,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  retentionWarning: {
    component: RetentionWarning,
    children: key => makeRouteDefNode(chatChildren[key]),
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  showBlockConversationDialog: {
    component: BlockConversationWarning,
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  showNewTeamDialog: {
    component: NewTeamDialogFromChat,
    tags: makeLeafTags({layerOnTop: !isMobile}),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  attachmentFullscreen: {
    component: AttachmentFullscreen,
    tags: makeLeafTags(isMobile ? {hideStatusBar: true, fullscreen: true} : {layerOnTop: true}),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  attachmentVideoFullscreen: {
    component: AttachmentVideoFullscreen,
    tags: makeLeafTags(
      isMobile ? {hideStatusBar: true, underStatusBar: true, fullscreen: true} : {layerOnTop: true}
    ),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  attachmentGetTitles: {
    component: AttachmentGetTitles,
    tags: makeLeafTags({layerOnTop: true}),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  infoPanel: {
    component: InfoPanel,
    children: key => makeRouteDefNode(chatChildren[key]),
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  deleteHistoryWarning: {
    component: DeleteHistoryWarning,
    tags: makeLeafTags({layerOnTop: !isMobile}),
    children: key => makeRouteDefNode(chatChildren[key]),
  },
  enterPaperkey: {
    component: EnterPaperkey,
  },
  [WalletConstants.sendReceiveFormRouteKey]: {
    children: {
      [WalletConstants.confirmFormRouteKey]: {
        children: {},
        component: ConfirmForm,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
    },
    component: SendForm,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
}

const conversationRoute = makeRouteDefNode({
  component: Conversation,
  children: chatChildren,
})

const routeTree = isMobile
  ? makeRouteDefNode({
      component: Inbox,
      children: key => {
        if (key !== 'conversation') {
          return makeRouteDefNode(chatChildren[key])
        }
        return conversationRoute
      },
      tags: makeLeafTags({persistChildren: true}),
    })
  : makeRouteDefNode({
      containerComponent: InboxAndConversation,
      defaultSelected: '0',
      children: () => conversationRoute,
      tags: makeLeafTags({persistChildren: true}),
      initialState: {smallTeamsExpanded: false},
    })

export default routeTree

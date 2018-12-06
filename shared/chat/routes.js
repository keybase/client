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
import TeamBuilding from '../team-building/container'
import {MaybePopupHoc} from '../common-adapters'
import {isMobile} from '../constants/platform'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import DeleteHistoryWarning from './delete-history-warning/container'
import RetentionWarning from '../teams/team/settings-tab/retention/warning/container'
import ChooseEmoji from './conversation/messages/react-button/emoji-picker/container'
import ConfirmForm from '../wallets/confirm-form/container'
import SendForm from '../wallets/send-form/container'
import ChooseAsset from '../wallets/send-form/choose-asset/container'
import QRScan from '../wallets/qr-scan/container'

// Arbitrarily stackable routes from the chat tab
const chatChildren = {
  attachmentFullscreen: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: AttachmentFullscreen,
    tags: makeLeafTags(
      isMobile ? {fullscreen: true, hideStatusBar: true, underNotch: true} : {layerOnTop: true}
    ),
  },
  attachmentGetTitles: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: AttachmentGetTitles,
    tags: makeLeafTags(isMobile ? {} : {layerOnTop: true}),
  },
  attachmentVideoFullscreen: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: AttachmentVideoFullscreen,
    tags: makeLeafTags(isMobile ? {fullscreen: true} : {layerOnTop: true}),
  },
  chooseEmoji: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: ChooseEmoji,
    tags: makeLeafTags({layerOnTop: false}),
  },
  createChannel: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: CreateChannel,
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
  },
  deleteHistoryWarning: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: DeleteHistoryWarning,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  editChannel: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: MaybePopupHoc(isMobile)(EditChannel),
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
  },
  enterPaperkey: {
    component: EnterPaperkey,
  },
  infoPanel: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: InfoPanel,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  manageChannels: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: ManageChannels,
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
  },
  newChat: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: TeamBuilding,
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
  },
  reallyLeaveTeam: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: ReallyLeaveTeam,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  retentionWarning: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: RetentionWarning,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  showBlockConversationDialog: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: BlockConversationWarning,
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
  },
  showNewTeamDialog: {
    children: key => makeRouteDefNode(chatChildren[key]),
    component: NewTeamDialogFromChat,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  [WalletConstants.sendReceiveFormRouteKey]: {
    children: {
      [WalletConstants.confirmFormRouteKey]: {
        children: {},
        component: ConfirmForm,
        tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true, underNotch: true}),
      },
      [WalletConstants.chooseAssetFormRouteKey]: {
        children: {},
        component: ChooseAsset,
        tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile, renderTopmostOnly: true}),
      },
      qrScan: {
        component: QRScan,
        tags: makeLeafTags({layerOnTop: true, underNotch: true}),
      },
    },
    component: SendForm,
    tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true, underNotch: true}),
  },
}

const conversationRoute = makeRouteDefNode({
  children: chatChildren,
  component: Conversation,
})

const routeTree = isMobile
  ? makeRouteDefNode({
      children: key => {
        if (key !== 'conversation') {
          return makeRouteDefNode(chatChildren[key])
        }
        return conversationRoute
      },
      component: Inbox,
      tags: makeLeafTags({persistChildren: true}),
    })
  : makeRouteDefNode({
      children: () => conversationRoute,
      containerComponent: InboxAndConversation,
      defaultSelected: '0',
      initialState: {smallTeamsExpanded: false},
      tags: makeLeafTags({persistChildren: true}),
    })

export default routeTree

// @flow
import {isMobile} from '../constants/platform'

// Arbitrarily stackable routes from the chat tab
const routeTree = () => {
  const WalletConstants = require('../constants/wallets')
  const AttachmentGetTitles = require('./conversation/attachment-get-titles/container').default
  const AttachmentFullscreen = require('./conversation/attachment-fullscreen/container').default
  const AttachmentVideoFullscreen = require('./conversation/attachment-video-fullscreen/container').default
  const BlockConversationWarning = require('./conversation/block-conversation-warning/container').default
  const Conversation = require('./conversation/container').default
  const CreateChannel = require('./create-channel/container').default
  const EditChannel = require('./manage-channels/edit-channel-container').default
  const EnterPaperkey = require('./conversation/rekey/enter-paper-key').default
  const Inbox = require('./inbox/container').default
  const InfoPanel = require('./conversation/info-panel/container').default
  const ManageChannels = require('./manage-channels/container').default
  const NewTeamDialogFromChat = require('./new-team-dialog-container').default
  const ReallyLeaveTeam = require('../teams/really-leave-team/container-chat').default
  const InboxAndConversation = require('./inbox-and-conversation').default
  const TeamBuilding = require('../team-building/container').default
  const {MaybePopupHoc} = require('../common-adapters')
  const {makeRouteDefNode, makeLeafTags} = require('../route-tree')
  const DeleteHistoryWarning = require('./delete-history-warning/container').default
  const RetentionWarning = require('../teams/team/settings-tab/retention/warning/container').default
  const ChooseEmoji = require('./conversation/messages/react-button/emoji-picker/container').default
  const PaymentsConfirm = require('./payments/confirm/container').default

  const SendRequestFormRoutes = require('../wallets/routes-send-request-form').default()

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
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    paymentsConfirm: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: PaymentsConfirm,
      tags: makeLeafTags({layerOnTop: !isMobile}),
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
    [WalletConstants.sendRequestFormRouteKey]: SendRequestFormRoutes,
  }

  const conversationRoute = makeRouteDefNode({
    children: chatChildren,
    component: Conversation,
  })
  return isMobile
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
}

export default routeTree

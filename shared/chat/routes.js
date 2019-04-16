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
  const {makeRouteDefNode, makeLeafTags} = require('../route-tree')
  const DeleteHistoryWarning = require('./delete-history-warning/container').default
  const RetentionWarning = require('../teams/team/settings-tab/retention/warning/container').default
  const ChooseEmoji = require('./conversation/messages/react-button/emoji-picker/container').default
  const PaymentsConfirm = require('./payments/confirm/container').default
  const AddToChannel = require('./conversation/info-panel/add-to-channel/container').default

  const SendRequestFormRoutes = require('../wallets/routes-send-request-form').default()

  const chatChildren = {
    chatAddToChannel: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: AddToChannel,
      tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile}),
    },
    chatAttachmentFullscreen: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: AttachmentFullscreen,
      tags: makeLeafTags(
        isMobile ? {fullscreen: true, hideStatusBar: true, underNotch: true} : {layerOnTop: true}
      ),
    },
    chatAttachmentGetTitles: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: AttachmentGetTitles,
      tags: makeLeafTags(isMobile ? {} : {layerOnTop: true}),
    },
    chatAttachmentVideoFullscreen: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: AttachmentVideoFullscreen,
      tags: makeLeafTags(isMobile ? {fullscreen: true} : {layerOnTop: true}),
    },
    chatChooseEmoji: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: ChooseEmoji,
      tags: makeLeafTags({layerOnTop: false}),
    },
    chatCreateChannel: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: CreateChannel,
      tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    },
    chatDeleteHistoryWarning: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: DeleteHistoryWarning,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    chatEditChannel: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: EditChannel,
      tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    },
    chatEnterPaperkey: {
      // TODO dead route?
      component: EnterPaperkey,
    },
    chatInfoPanel: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: InfoPanel,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    chatManageChannels: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: ManageChannels,
      tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    },
    chatNewChat: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: TeamBuilding,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    chatPaymentsConfirm: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: PaymentsConfirm,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    chatShowBlockConversationDialog: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: BlockConversationWarning,
      tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    },
    chatShowNewTeamDialog: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: NewTeamDialogFromChat,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    retentionWarning: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: RetentionWarning,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    teamReallyLeaveTeam: {
      children: key => makeRouteDefNode(chatChildren[key]),
      component: ReallyLeaveTeam,
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
          if (key !== 'chatConversation') {
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

export const newRoutes = {
  chatChooseEmoji: {
    getScreen: () => require('./conversation/messages/react-button/emoji-picker/container').default,
    upgraded: true,
  },
  chatConversation: {getScreen: () => require('./conversation/container').default, upgraded: true},
  chatEnterPaperkey: {
    getScreen: () => require('./conversation/rekey/enter-paper-key').default,
    upgraded: true,
  },
  'tabs.chatTab': {
    getScreen: () =>
      // TODO mark as upgraded when inbox doesn't use routeState anymore
      isMobile ? require('./inbox/container').default : require('./inbox-and-conversation-2.desktop').default,
  },
}

export const newModalRoutes = {
  chatAddToChannel: {
    getScreen: () => require('./conversation/info-panel/add-to-channel/container').default,
    upgraded: true,
  },
  chatAttachmentFullscreen: {
    getScreen: () => require('./conversation/attachment-fullscreen/container').default,
    upgraded: true,
  },
  chatAttachmentGetTitles: {
    getScreen: () => require('./conversation/attachment-get-titles/container').default,
    upgraded: true,
  },
  chatAttachmentVideoFullscreen: {
    getScreen: () => require('./conversation/attachment-video-fullscreen/container').default,
    upgraded: true,
  },
  chatCreateChannel: {getScreen: () => require('./create-channel/container').default}, // TODO upgrade / figure out route introspection in there
  chatDeleteHistoryWarning: {
    getScreen: () => require('./delete-history-warning/container').default,
    upgraded: true,
  },
  chatEditChannel: {
    getScreen: () => require('./manage-channels/edit-channel-container').default,
    upgraded: true,
  },
  chatInfoPanel: {getScreen: () => require('./conversation/info-panel/container').default, upgraded: true},
  // TODO upgrade the ones below
  chatManageChannels: {getScreen: () => require('./manage-channels/container').default},
  chatNewChat: {getScreen: () => require('../team-building/container').default},
  chatPaymentsConfirm: {getScreen: () => require('./payments/confirm/container').default},
  chatShowBlockConversationDialog: {
    getScreen: () => require('./conversation/block-conversation-warning/container').default,
  },
  chatShowNewTeamDialog: {getScreen: () => require('./new-team-dialog-container').default},
}

export default routeTree

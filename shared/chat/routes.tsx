import {isMobile} from '../constants/platform'

export const newRoutes = {
  chatConversation: {getScreen: () => require('./conversation/container').default, upgraded: true},
  chatEnterPaperkey: {
    getScreen: () => require('./conversation/rekey/enter-paper-key').default,
    upgraded: true,
  },
  chatRoot: {
    getScreen: () =>
      isMobile ? require('./inbox/container').default : require('./inbox-and-conversation-2.desktop').default,
    upgraded: true,
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
  chatChooseEmoji: {
    getScreen: () => require('./conversation/messages/react-button/emoji-picker/container').default,
    upgraded: true,
  },
  chatCreateChannel: {getScreen: () => require('./create-channel/container').default, upgraded: true},
  chatDeleteHistoryWarning: {
    getScreen: () => require('./delete-history-warning/container').default,
    upgraded: true,
  },
  chatEditChannel: {
    getScreen: () => require('./manage-channels/edit-channel-container').default,
    upgraded: true,
  },
  chatInfoPanel: {getScreen: () => require('./conversation/info-panel/container').default, upgraded: true},
  chatManageChannels: {getScreen: () => require('./manage-channels/container').default, upgraded: true},
  chatNewChat: {getScreen: () => require('../team-building/container').default, upgraded: true},
  chatPaymentsConfirm: {getScreen: () => require('./payments/confirm/container').default, upgraded: true},
  chatShowBlockConversationDialog: {
    getScreen: () => require('./conversation/block-conversation-warning/container').default,
    upgraded: true,
  },
  chatShowNewTeamDialog: {getScreen: () => require('./new-team-dialog-container').default, upgraded: true},
}

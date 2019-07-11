import {isMobile} from '../constants/platform'

import ChatConversation from './conversation/container'
import ChatEnterPaperkey from './conversation/rekey/enter-paper-key'
import ChatRoot from './inbox/container'
import ChatAddToChannel from './conversation/info-panel/add-to-channel/container'
import ChatAttachmentFullscreen from './conversation/attachment-fullscreen/container'
import ChatAttachmentGetTitles from './conversation/attachment-get-titles/container'
import ChatChooseEmoji from './conversation/messages/react-button/emoji-picker/container'
import ChatCreateChannel from './create-channel/container'
import ChatDeleteHistoryWarning from './delete-history-warning/container'
import ChatEditChannel from './manage-channels/edit-channel-container'
import ChatInfoPanel from './conversation/info-panel/container'
import ChatManageChannels from './manage-channels/container'
import ChatNewChat from '../team-building/container'
import ChatPaymentsConfirm from './payments/confirm/container'
import ChatShowBlockConversationDialog from './conversation/block-conversation-warning/container'
import ChatShowNewTeamDialog from './new-team-dialog-container'

export const newRoutes = {
  chatConversation: {
    getScreen: (): typeof ChatConversation => require('./conversation/container').default,
    upgraded: true,
  },
  chatEnterPaperkey: {
    getScreen: (): typeof ChatEnterPaperkey => require('./conversation/rekey/enter-paper-key').default,
    upgraded: true,
  },
  chatRoot: {
    getScreen: (): typeof ChatRoot =>
      isMobile ? require('./inbox/container').default : require('./inbox-and-conversation-2.desktop').default,
    upgraded: true,
  },
}

export const newModalRoutes = {
  chatAddToChannel: {
    getScreen: (): typeof ChatAddToChannel =>
      require('./conversation/info-panel/add-to-channel/container').default,
    upgraded: true,
  },
  chatAttachmentFullscreen: {
    getScreen: (): typeof ChatAttachmentFullscreen =>
      // @ts-ignore TODO fix
      require('./conversation/attachment-fullscreen/container').default,
    upgraded: true,
  },
  chatAttachmentGetTitles: {
    getScreen: (): typeof ChatAttachmentGetTitles =>
      require('./conversation/attachment-get-titles/container').default,
    upgraded: true,
  },
  chatChooseEmoji: {
    getScreen: (): typeof ChatChooseEmoji =>
      require('./conversation/messages/react-button/emoji-picker/container').default,
    upgraded: true,
  },
  chatCreateChannel: {
    getScreen: (): typeof ChatCreateChannel => require('./create-channel/container').default,
    upgraded: true,
  },
  chatDeleteHistoryWarning: {
    getScreen: (): typeof ChatDeleteHistoryWarning => require('./delete-history-warning/container').default,
    upgraded: true,
  },
  chatEditChannel: {
    getScreen: (): typeof ChatEditChannel => require('./manage-channels/edit-channel-container').default,
    upgraded: true,
  },
  chatInfoPanel: {
    getScreen: (): typeof ChatInfoPanel => require('./conversation/info-panel/container').default,
    upgraded: true,
  },
  // TODO connect broken
  chatManageChannels: {
    getScreen: (): typeof ChatManageChannels => require('./manage-channels/container').default,
    upgraded: true,
  },
  chatNewChat: {
    getScreen: (): typeof ChatNewChat => require('../team-building/container').default,
    upgraded: true,
  },
  chatPaymentsConfirm: {
    getScreen: (): typeof ChatPaymentsConfirm => require('./payments/confirm/container').default,
    upgraded: true,
  },
  chatShowBlockConversationDialog: {
    getScreen: (): typeof ChatShowBlockConversationDialog =>
      require('./conversation/block-conversation-warning/container').default,
    upgraded: true,
  },
  // TODO connect broken
  chatShowNewTeamDialog: {
    getScreen: (): typeof ChatShowNewTeamDialog => require('./new-team-dialog-container').default,
    upgraded: true,
  },
}

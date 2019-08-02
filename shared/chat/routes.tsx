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
  chatConversation: {getScreen: (): typeof ChatConversation => require('./conversation/container').default},
  chatEnterPaperkey: {
    getScreen: (): typeof ChatEnterPaperkey => require('./conversation/rekey/enter-paper-key').default,
  },
  chatRoot: {
    getScreen: (): typeof ChatRoot =>
      isMobile ? require('./inbox/container').default : require('./inbox-and-conversation-2.desktop').default,
  },
}

export const newModalRoutes = {
  chatAddToChannel: {
    getScreen: (): typeof ChatAddToChannel =>
      require('./conversation/info-panel/add-to-channel/container').default,
  },
  chatAttachmentFullscreen: {
    getScreen: (): typeof ChatAttachmentFullscreen =>
      // @ts-ignore TODO fix
      require('./conversation/attachment-fullscreen/container').default,
  },
  chatAttachmentGetTitles: {
    getScreen: (): typeof ChatAttachmentGetTitles =>
      require('./conversation/attachment-get-titles/container').default,
  },
  chatChooseEmoji: {
    getScreen: (): typeof ChatChooseEmoji =>
      require('./conversation/messages/react-button/emoji-picker/container').default,
  },
  chatCreateChannel: {
    getScreen: (): typeof ChatCreateChannel => require('./create-channel/container').default,
  },
  chatDeleteHistoryWarning: {
    getScreen: (): typeof ChatDeleteHistoryWarning => require('./delete-history-warning/container').default,
  },
  chatEditChannel: {
    getScreen: (): typeof ChatEditChannel => require('./manage-channels/edit-channel-container').default,
  },
  chatInfoPanel: {
    getScreen: (): typeof ChatInfoPanel => require('./conversation/info-panel/container').default,
  },
  // TODO connect broken
  chatManageChannels: {
    getScreen: (): typeof ChatManageChannels => require('./manage-channels/container').default,
  },
  chatNewChat: {getScreen: (): typeof ChatNewChat => require('../team-building/container').default},
  chatPaymentsConfirm: {
    getScreen: (): typeof ChatPaymentsConfirm => require('./payments/confirm/container').default,
  },
  chatShowBlockConversationDialog: {
    getScreen: (): typeof ChatShowBlockConversationDialog =>
      require('./conversation/block-conversation-warning/container').default,
  },
  // TODO connect broken
  chatShowNewTeamDialog: {
    getScreen: (): typeof ChatShowNewTeamDialog => require('./new-team-dialog-container').default,
  },
}

import type {TeamBuilderProps} from '../team-building/container'
import * as ChatConstants from '../constants/chat2'
import type * as Types from '../constants/types/chat2'
import type * as TeamsTypes from '../constants/types/teams'
import type BlockModal from './blocking/block-modal/container'
import type ChatAddToChannelNew from './conversation/info-panel/add-to-channel/index.new'
import type ChatAttachmentFullscreen from './conversation/attachment-fullscreen/container'
import type ChatAttachmentGetTitles from './conversation/attachment-get-titles/container'
import type ChatConfirmRemoveBot from './conversation/bot/confirm'
import type ChatConversation from './conversation/container'
import type ChatCreateChannel from './create-channel/container'
import type ChatDeleteHistoryWarning from './delete-history-warning/container'
import type ChatEnterPaperkey from './conversation/rekey/enter-paper-key'
import type ChatForwardMsgPick from './conversation/fwd-msg/team-picker'
import type ChatInfoPanel from './conversation/info-panel/container'
import type ChatInstallBot from './conversation/bot/install'
import type ChatInstallBotPick from './conversation/bot/team-picker'
import type ChatLocationPopup from './conversation/input-area/normal/location-popup'
import type ChatNewChat from '../team-building/container'
import type ChatPDF from './pdf'
import type ChatPaymentsConfirm from './payments/confirm/container'
import type ChatRoot from './inbox/container'
import type ChatSearchBot from './conversation/bot/search'
import type ChatShowNewTeamDialog from './new-team-dialog-container'
import type ChatUnfurlMapPopup from './conversation/messages/text/unfurl/unfurl-list/map-popup'
import type PunycodeLinkWarning from './punycode-link-warning'
import type SendToChat from './send-to-chat'
import type {RenderableEmoji} from '../util/emoji'
import type {Routable as ChatChooseEmoji} from './emoji-picker/container'
import type {BlockModalContext} from './blocking/block-modal'

export const newRoutes = {
  chatConversation: {getScreen: (): typeof ChatConversation => require('./conversation/container').default},
  chatEnterPaperkey: {
    getScreen: (): typeof ChatEnterPaperkey => require('./conversation/rekey/enter-paper-key').default,
  },
  chatRoot: {
    getOptions: ({navigation, route}) =>
      ChatConstants.isSplit
        ? require('./inbox-and-conversation-2').getOptions({navigation, route})
        : require('./inbox/defer-loading').getOptions({navigation, route}),
    getScreen: (): typeof ChatRoot =>
      ChatConstants.isSplit
        ? require('./inbox-and-conversation-2').default
        : require('./inbox/defer-loading').default,
  },
}

export const newModalRoutes = {
  chatAddToChannel: {
    getScreen: (): typeof ChatAddToChannelNew =>
      require('./conversation/info-panel/add-to-channel/index.new').default,
  },
  chatAttachmentFullscreen: {
    getScreen: (): typeof ChatAttachmentFullscreen =>
      require('./conversation/attachment-fullscreen/container').default,
  },
  chatAttachmentGetTitles: {
    getScreen: (): typeof ChatAttachmentGetTitles =>
      require('./conversation/attachment-get-titles/container').default,
  },
  chatBlockingModal: {
    getScreen: (): typeof BlockModal => require('./blocking/block-modal/container').default,
  },
  chatChooseEmoji: {
    getScreen: (): typeof ChatChooseEmoji => require('./emoji-picker/container').Routable,
  },
  chatConfirmNavigateExternal: {
    getScreen: (): typeof PunycodeLinkWarning => require('./punycode-link-warning').default,
  },
  chatConfirmRemoveBot: {
    getScreen: (): typeof ChatConfirmRemoveBot => require('./conversation/bot/confirm').default,
  },
  chatCreateChannel: {
    getScreen: (): typeof ChatCreateChannel => require('./create-channel/container').default,
  },
  chatDeleteHistoryWarning: {
    getScreen: (): typeof ChatDeleteHistoryWarning => require('./delete-history-warning/container').default,
  },
  chatForwardMsgPick: {
    getScreen: (): typeof ChatForwardMsgPick => require('./conversation/fwd-msg/team-picker').default,
  },
  chatInfoPanel: {
    getScreen: (): typeof ChatInfoPanel => require('./conversation/info-panel/container').default,
  },
  chatInstallBot: {
    getScreen: (): typeof ChatInstallBot => require('./conversation/bot/install').default,
  },
  chatInstallBotPick: {
    getScreen: (): typeof ChatInstallBotPick => require('./conversation/bot/team-picker').default,
  },
  chatLocationPreview: {
    getScreen: (): typeof ChatLocationPopup =>
      require('./conversation/input-area/normal/location-popup').default,
  },
  chatNewChat: {getScreen: (): typeof ChatNewChat => require('../team-building/container').default},
  chatPDF: {getScreen: (): typeof ChatPDF => require('./pdf').default},
  chatPaymentsConfirm: {
    getScreen: (): typeof ChatPaymentsConfirm => require('./payments/confirm/container').default,
  },
  chatSearchBots: {
    getScreen: (): typeof ChatSearchBot => require('./conversation/bot/search').default,
  },
  // TODO connect broken
  chatShowNewTeamDialog: {
    getScreen: (): typeof ChatShowNewTeamDialog => require('./new-team-dialog-container').default,
  },
  chatUnfurlMapPopup: {
    getScreen: (): typeof ChatUnfurlMapPopup =>
      require('./conversation/messages/text/unfurl/unfurl-list/map-popup').default,
  },
  sendToChat: {
    getScreen: (): typeof SendToChat => require('./send-to-chat').default,
  },
}

export type RootParamListChat = {
  chatNewChat: TeamBuilderProps
  chatConversation: {conversationIDKey?: Types.ConversationIDKey}
  chatRoot: {conversationIDKey?: Types.ConversationIDKey}
  chatChooseEmoji: {
    conversationIDKey: Types.ConversationIDKey
    small: boolean
    hideFrequentEmoji: boolean
    onlyTeamCustomEmoji: boolean
    onPickAction: (emojiStr: string, renderableEmoji: RenderableEmoji) => void
    onPickAddToMessageOrdinal: Types.Ordinal
    onDidPick: () => void
  }
  chatUnfurlMapPopup: {
    conversationIDKey: Types.ConversationIDKey
    coord: Types.Coordinate
    isAuthor: boolean
    author?: string
    isLiveLocation: boolean
    url: string
  }
  chatCreateChannel: {
    navToChatOnSuccess?: boolean
    teamID: TeamsTypes.TeamID
  }
  chatDeleteHistoryWarning: {conversationIDKey: Types.ConversationIDKey}
  chatShowNewTeamDialog: {conversationIDKey: Types.ConversationIDKey}
  chatPDF: {
    message: Types.MessageAttachment
    url?: string
  }
  chatConfirmNavigateExternal: {
    display: string
    punycode: string
    url: string
  }
  sendToChat: {
    canBack: boolean
    isFromShareExtension: boolean
    text: string // incoming share (text)
    sendPaths: Array<string> // KBFS or incoming share (files)
  }
  chatLocationPreview: {conversationIDKey: Types.ConversationIDKey}
  chatBlockingModal: {
    blockUserByDefault?: boolean
    context?: BlockModalContext
    convID?: string
    others?: Array<string>
    team?: string
    username?: string
  }
  chatAttachmentGetTitles: {
    conversationIDKey: Types.ConversationIDKey
    pathAndOutboxIDs: Array<Types.PathAndOutboxID>
    selectConversationWithReason?: 'extension' | 'files'
    // If tlfName is set, we'll use Chat2Gen.createAttachmentsUpload. Otherwise
    // Chat2Gen.createAttachFromDragAndDrop is used.
    tlfName?: string
    // don't use the drag drop functionality, just upload the outbox IDs
    noDragDrop?: Boolean
  }
  chatAddToChannel: {
    conversationIDKey: Types.ConversationIDKey
    teamID: TeamsTypes.TeamID
  }
  chatForwardMsgPick: {
    srcConvID: Types.ConversationIDKey
    ordinal: Types.Ordinal
  }
  chatAttachmentFullscreen: {
    conversationIDKey: Types.ConversationIDKey
    ordinal: Types.Ordinal
  }
  chatInstallBot: {
    botUsername: string
    conversationIDKey?: Types.ConversationIDKey
    teamID?: TeamsTypes.TeamID
  }
  chatInstallBotPick: {
    botUsername: string
  }
  chatSearchBots: {
    conversationIDKey?: Types.ConversationIDKey
    teamID?: TeamsTypes.TeamID
  }
  chatConfirmRemoveBot: {
    botUsername: string
    conversationIDKey?: Types.ConversationIDKey
    teamID?: TeamsTypes.TeamID
  }
  chatInfoPanel: {
    conversationIDKey?: Types.ConversationIDKey
    tab?: 'settings' | 'members' | 'attachments' | 'bots'
  }
  chatEnterPaperkey: undefined
  chatPaymentsConfirm: undefined
}

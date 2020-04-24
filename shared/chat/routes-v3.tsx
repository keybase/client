import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Constants from '../constants/chat2'
import * as Types from '../constants/types/chat2'
import ChatConversation from './conversation/container'
import ChatEnterPaperkey from './conversation/rekey/enter-paper-key'
import ChatAddToChannel from './conversation/info-panel/add-to-channel/container'
import ChatAddToChannelNew from './conversation/info-panel/add-to-channel/index.new'
import ChatAttachmentFullscreenType from './conversation/attachment-fullscreen/container'
import ChatAttachmentGetTitles from './conversation/attachment-get-titles/container'
import {Routable as ChatChooseEmoji} from './conversation/messages/react-button/emoji-picker/container'
import ChatCreateChannel from './create-channel/container'
import ChatDeleteHistoryWarning from './delete-history-warning/container'
import ChatEditChannel from './manage-channels/edit-channel-container'
import ChatInfoPanel from './conversation/info-panel/container'
import ChatManageChannels from './manage-channels/container'
import ChatNewChat from '../team-building/container'
import ChatPaymentsConfirm from './payments/confirm/container'
import ChatShowNewTeamDialog from './new-team-dialog-container'
import ChatLocationPopup from './conversation/input-area/normal/location-popup'
import ChatUnfurlMapPopup from './conversation/messages/wrapper/unfurl/map/popup'
import PunycodeLinkWarning from './punycode-link-warning'
import BlockModal from './blocking/block-modal/container'
import ChatInstallBot from './conversation/bot/install'
import ChatInstallBotPick from './conversation/bot/team-picker'
import ChatSearchBot from './conversation/bot/search'
import ChatConfirmRemoveBot from './conversation/bot/confirm'
import ChatPDF from './pdf'
import * as ChatConstants from '../constants/chat2'
import flags from '../util/feature-flags'
import {Stack, ModalStack} from '../router-v3/stack'
import {ScreenProps, ModalScreenProps} from '../router-v3/types'

// TODO port
const newRoutes = {
  chatConversation: {getScreen: (): typeof ChatConversation => require('./conversation/container').default},
  chatEnterPaperkey: {
    getScreen: (): typeof ChatEnterPaperkey => require('./conversation/rekey/enter-paper-key').default,
  },
}

const ChatRoot = (props: ScreenProps<'chatRoot'>) => {
  if (ChatConstants.isSplit) {
    const InboxAndConversation = require('./inbox-and-conversation-2').default
    return <InboxAndConversation conversationIDKey={props.route.params.conversationIDKey} />
  } else {
    const DeferLoading = require('./inbox/defer-loading').default
    return <DeferLoading />
  }
}

export const screens = [
  <Stack.Screen
    key="chatRoot"
    name="chatRoot"
    component={ChatRoot}
    options={props => {
      if (ChatConstants.isSplit) {
        const Header = require('./header').default
        return {
          header: undefined,
          headerTitle: () => <Header conversationIDKey={props.route.params.conversationIDKey} />,
          headerTitleContainerStyle: {left: 0, right: 0},
        }
      } else {
        const HeaderNewChatButton = require('./inbox/new-chat-button').default
        return {
          headerRight: () => <HeaderNewChatButton />,
          headerTitle: () => (
            <Kb.Text type="BodyBig" lineClamp={1}>
              Chats
            </Kb.Text>
          ),
        }
      }
    }}
  />,
]

const ChatAttachmentFullscreen = (props: ModalScreenProps<'chatAttachmentFullscreen'>) => {
  const AttachmentFullscreen = require('./conversation/attachment-fullscreen/container')
    .default as typeof ChatAttachmentFullscreenType
  const {
    conversationIDKey = Constants.noConversationIDKey,
    ordinal = Types.numberToOrdinal(0),
  } = props.route.params
  return <AttachmentFullscreen conversationIDKey={conversationIDKey} ordinal={ordinal} />
}

KB.debugConsoleLog('TODO safeAreaStyle?')
export const modalScreens = [
  <ModalStack.Screen
    key="chatAttachmentFullscreen"
    name="chatAttachmentFullscreen"
    component={ChatAttachmentFullscreen}
    options={
      {
        // safeAreaStyle: {
        // backgroundColor: 'black', // true black
        // },
      }
    }
  />,
]

// TODO port
const newModalRoutes = {
  chatAddToChannel: flags.teamsRedesign
    ? {
        getScreen: (): typeof ChatAddToChannelNew =>
          require('./conversation/info-panel/add-to-channel/index.new').default,
      }
    : {
        getScreen: (): typeof ChatAddToChannel =>
          require('./conversation/info-panel/add-to-channel/container').default,
      },
  chatAttachmentGetTitles: {
    getScreen: (): typeof ChatAttachmentGetTitles =>
      require('./conversation/attachment-get-titles/container').default,
  },
  chatBlockingModal: {
    getScreen: (): typeof BlockModal => require('./blocking/block-modal/container').default,
  },
  chatChooseEmoji: {
    getScreen: (): typeof ChatChooseEmoji =>
      require('./conversation/messages/react-button/emoji-picker/container').Routable,
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
  chatEditChannel: {
    getScreen: (): typeof ChatEditChannel => require('./manage-channels/edit-channel-container').default,
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
  chatManageChannels: {
    getScreen: (): typeof ChatManageChannels => require('./manage-channels/container').default,
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
      require('./conversation/messages/wrapper/unfurl/map/popup').default,
  },
}

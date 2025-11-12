import * as React from 'react'
import * as C from '@/constants'
import chatNewChat from '../team-building/page'

const ChatAddToChannel = React.lazy(async () => import('./conversation/info-panel/add-to-channel'))
const chatAddToChannel = {
  screen: function AddToChannel(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof ChatAddToChannel>>
  ) {
    return <ChatAddToChannel {...p.route.params} />
  },
}

const ChatAttachmentFullscreen = React.lazy(async () => import('./conversation/attachment-fullscreen'))
const chatAttachmentFullscreen = {
  screen: function AttachmentFullscreen(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof ChatAttachmentFullscreen>>
  ) {
    return <ChatAttachmentFullscreen {...p.route.params} />
  },
}

const ChatAttachmentGetTitles = React.lazy(async () => import('./conversation/attachment-get-titles'))
const chatAttachmentGetTitles = {
  screen: function AttachmentGetTitles(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof ChatAttachmentGetTitles>>
  ) {
    return <ChatAttachmentGetTitles {...p.route.params} />
  },
}

const ChatBlockingModal = React.lazy(async () => import('./blocking/block-modal'))
const chatBlockingModal = {
  screen: function BlockingModal(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof ChatBlockingModal>>
  ) {
    return <ChatBlockingModal {...p.route.params} />
  },
}

const ChatChooseEmoji = React.lazy(async () => import('./emoji-picker'))
const chatChooseEmoji = {
  screen: function ChooseEmoji(p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof ChatChooseEmoji>>) {
    return <ChatChooseEmoji {...p.route.params} />
  },
}

const ChatConfirmNavigateExternal = React.lazy(async () => import('./punycode-link-warning'))
const chatConfirmNavigateExternal = {
  screen: function ConfirmNavigateExternal(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof ChatConfirmNavigateExternal>>
  ) {
    return <ChatConfirmNavigateExternal {...p.route.params} />
  },
}

const ChatConfirmRemoveBot = React.lazy(async () => import('./conversation/bot/confirm'))
const chatConfirmRemoveBot = {
  screen: function ConfirmRemoveBot(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof ChatConfirmRemoveBot>>
  ) {
    return <ChatConfirmRemoveBot {...p.route.params} />
  },
}

const Convo = React.lazy(async () => import('./conversation/container'))
const chatConversation = {
  getOptions: {headerShown: false},
  screen: function ChatConversation(p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Convo>>) {
    return (
      <C.Chat.ProviderScreen rp={p}>
        <Convo {...p.route.params} />
      </C.Chat.ProviderScreen>
    )
  },
}

const ChatCreateChannel = React.lazy(async () => import('./create-channel'))
const chatCreateChannel = {
  screen: function CreateChannel(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof ChatCreateChannel>>
  ) {
    return <ChatCreateChannel {...p.route.params} />
  },
}

const DeleteHistoryWarning = React.lazy(async () => import('./delete-history-warning'))
const chatDeleteHistoryWarning = {screen: DeleteHistoryWarning}

const EnterPaperkey = React.lazy(async () => import('./conversation/rekey/enter-paper-key'))
const chatEnterPaperkey = {getOptions: {headerShown: false}, screen: EnterPaperkey}

const ForwardMsgPick = React.lazy(async () => import('./conversation/fwd-msg'))
const chatForwardMsgPick = {screen: ForwardMsgPick}

const InfoPanel = React.lazy(async () => import('./conversation/info-panel'))
const chatInfoPanel = {
  screen: function InfoPanelScreen(p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof InfoPanel>>) {
    return <InfoPanel {...p.route.params} />
  },
}

const InstallBot = React.lazy(async () => import('./conversation/bot/install'))
const chatInstallBot = {
  screen: function InstallBotScreen(p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof InstallBot>>) {
    return <InstallBot {...p.route.params} />
  },
}

const InstallBotPick = React.lazy(async () => import('./conversation/bot/team-picker'))
const chatInstallBotPick = {
  screen: function InstallBotPickScreen(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof InstallBotPick>>
  ) {
    return <InstallBotPick {...p.route.params} />
  },
}

const LocationPreview = React.lazy(async () => import('./conversation/input-area/location-popup'))
const chatLocationPreview = {screen: LocationPreview}

const MessagePopup = React.lazy(async () => {
  const {MessagePopupModal} = await import('./conversation/messages/message-popup')
  return {default: MessagePopupModal}
})
const chatMessagePopup = {screen: MessagePopup}

const PDF = React.lazy(async () => import('./pdf'))
const chatPDF = {
  screen: function PDFScreen(p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof PDF>>) {
    return <PDF {...p.route.params} />
  },
}

const RootSingle = React.lazy(async () => import('./inbox/defer-loading'))
const chatRootSingle = {getOptions: {headerShown: false}, screen: RootSingle}

const RootSplit = React.lazy(async () => import('./inbox-and-conversation-2'))
const chatRootSplit = {getOptions: {headerShown: false}, screen: RootSplit}

const SearchBots = React.lazy(async () => import('./conversation/bot/search'))
const chatSearchBots = {
  screen: function SearchBotsScreen(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof SearchBots>>
  ) {
    return <SearchBots {...p.route.params} />
  },
}

const ShowNewTeamDialog = React.lazy(async () => import('./new-team-dialog-container'))
const chatShowNewTeamDialog = {screen: ShowNewTeamDialog}

const UnfurlMapPopup = React.lazy(
  async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup')
)
const chatUnfurlMapPopup = {screen: UnfurlMapPopup}

const SendToChat = React.lazy(async () => import('./send-to-chat'))
const chatSendToChat = {
  screen: function SendToChatScreen(
    p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof SendToChat>>
  ) {
    return <SendToChat {...p.route.params} />
  },
}

export const newRoutes = {
  chatConversation,
  chatEnterPaperkey,
  chatRoot: C.Chat.isSplit ? chatRootSplit : chatRootSingle,
}

export const newModalRoutes = {
  chatAddToChannel,
  chatAttachmentFullscreen,
  chatAttachmentGetTitles,
  chatBlockingModal,
  chatChooseEmoji,
  chatConfirmNavigateExternal,
  chatConfirmRemoveBot,
  chatCreateChannel,
  chatDeleteHistoryWarning,
  chatForwardMsgPick,
  chatInfoPanel,
  chatInstallBot,
  chatInstallBotPick,
  chatLocationPreview,
  chatMessagePopup,
  chatNewChat,
  chatPDF,
  chatSearchBots,
  chatSendToChat,
  chatShowNewTeamDialog,
  chatUnfurlMapPopup,
}

export type RootParamListChat = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>

import * as React from 'react'
import * as C from '@/constants'
import chatNewChat from '../team-building/page'

// Helper to reduce boilerplate for chat screens that need route params
function makeChatScreen<T extends React.LazyExoticComponent<any>>(
  Component: T,
  options?: {getOptions?: unknown}
) {
  return {
    ...options,
    screen: function Screen(p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<T>>) {
      const C = Component as any
      return <C {...p.route.params} />
    },
  }
}

const ChatAddToChannel = React.lazy(async () => import('./conversation/info-panel/add-to-channel'))
const chatAddToChannel = makeChatScreen(ChatAddToChannel)

const ChatAttachmentFullscreen = React.lazy(async () => import('./conversation/attachment-fullscreen'))
const chatAttachmentFullscreen = makeChatScreen(ChatAttachmentFullscreen)

const ChatAttachmentGetTitles = React.lazy(async () => import('./conversation/attachment-get-titles'))
const chatAttachmentGetTitles = makeChatScreen(ChatAttachmentGetTitles)

const ChatBlockingModal = React.lazy(async () => import('./blocking/block-modal'))
const chatBlockingModal = makeChatScreen(ChatBlockingModal)

const ChatChooseEmoji = React.lazy(async () => import('./emoji-picker'))
const chatChooseEmoji = makeChatScreen(ChatChooseEmoji)

const ChatConfirmNavigateExternal = React.lazy(async () => import('./punycode-link-warning'))
const chatConfirmNavigateExternal = makeChatScreen(ChatConfirmNavigateExternal)

const ChatConfirmRemoveBot = React.lazy(async () => import('./conversation/bot/confirm'))
const chatConfirmRemoveBot = makeChatScreen(ChatConfirmRemoveBot)

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
const chatCreateChannel = makeChatScreen(ChatCreateChannel)

const DeleteHistoryWarning = React.lazy(async () => import('./delete-history-warning'))
const chatDeleteHistoryWarning = {screen: makeChatScreen(DeleteHistoryWarning).screen}

const EnterPaperkey = React.lazy(async () => import('./conversation/rekey/enter-paper-key'))
const chatEnterPaperkey = {getOptions: {headerShown: false}, screen: EnterPaperkey}

const ForwardMsgPick = React.lazy(async () => import('./conversation/fwd-msg'))
const chatForwardMsgPick = {screen: ForwardMsgPick}

const InfoPanel = React.lazy(async () => import('./conversation/info-panel'))
const chatInfoPanel = makeChatScreen(InfoPanel)

const InstallBot = React.lazy(async () => import('./conversation/bot/install'))
const chatInstallBot = makeChatScreen(InstallBot)

const InstallBotPick = React.lazy(async () => import('./conversation/bot/team-picker'))
const chatInstallBotPick = makeChatScreen(InstallBotPick)

const LocationPreview = React.lazy(async () => import('./conversation/input-area/location-popup'))
const chatLocationPreview = {screen: LocationPreview}

const MessagePopup = React.lazy(async () => {
  const {MessagePopupModal} = await import('./conversation/messages/message-popup')
  return {default: MessagePopupModal}
})
const chatMessagePopup = {screen: MessagePopup}

const PDF = React.lazy(async () => import('./pdf'))
const chatPDF = makeChatScreen(PDF)

const RootSingle = React.lazy(async () => import('./inbox/defer-loading'))
const chatRootSingle = {getOptions: {headerShown: false}, screen: RootSingle}

const RootSplit = React.lazy(async () => import('./inbox-and-conversation-2'))
const chatRootSplit = {getOptions: {headerShown: false}, screen: RootSplit}

const SearchBots = React.lazy(async () => import('./conversation/bot/search'))
const chatSearchBots = makeChatScreen(SearchBots)

const ShowNewTeamDialog = React.lazy(async () => import('./new-team-dialog-container'))
const chatShowNewTeamDialog = {screen: ShowNewTeamDialog}

const UnfurlMapPopup = React.lazy(
  async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup')
)
const chatUnfurlMapPopup = {screen: UnfurlMapPopup}

const SendToChat = React.lazy(async () => import('./send-to-chat'))
const chatSendToChat = makeChatScreen(SendToChat)

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

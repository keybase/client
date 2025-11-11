import * as React from 'react'
import * as C from '@/constants'
import chatNewChat from '../team-building/page'

// Add To Channel
const AddToChannel = React.lazy(async () => import('./conversation/info-panel/add-to-channel'))
const chatAddToChannel = {screen: AddToChannel}

// Attachment Fullscreen
const AttachmentFullscreen = React.lazy(async () => import('./conversation/attachment-fullscreen'))
const chatAttachmentFullscreen = {screen: AttachmentFullscreen}

// Attachment Get Titles
const AttachmentGetTitles = React.lazy(async () => import('./conversation/attachment-get-titles'))
const chatAttachmentGetTitles = {screen: AttachmentGetTitles}

// Blocking Modal
const BlockingModal = React.lazy(async () => import('./blocking/block-modal'))
const chatBlockingModal = {screen: BlockingModal}

// Choose Emoji
const ChooseEmoji = React.lazy(async () => import('./emoji-picker'))
const chatChooseEmoji = {screen: ChooseEmoji}

// Confirm Navigate External
const ConfirmNavigateExternal = React.lazy(async () => import('./punycode-link-warning'))
const chatConfirmNavigateExternal = {screen: ConfirmNavigateExternal}

// Confirm Remove Bot
const ConfirmRemoveBot = React.lazy(async () => import('./conversation/bot/confirm'))
const chatConfirmRemoveBot = {screen: ConfirmRemoveBot}

// Conversation
const Convo = React.lazy(async () => import('./conversation'))
const chatConversation = {
  getOptions: {
    headerShown: false,
  },
  screen: function ChatConversation(p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Convo>>) {
    return (
      <C.Chat.ProviderScreen rp={p}>
        <Convo {...p.route.params} />
      </C.Chat.ProviderScreen>
    )
  },
}

// Create Channel
const CreateChannel = React.lazy(async () => import('./create-channel'))
const chatCreateChannel = {screen: CreateChannel}

// Delete History Warning
const DeleteHistoryWarning = React.lazy(async () => import('./delete-history-warning'))
const chatDeleteHistoryWarning = {screen: DeleteHistoryWarning}

// Enter Paperkey
const EnterPaperkey = React.lazy(async () => import('./conversation/rekey/enter-paper-key'))
const chatEnterPaperkey = {
  getOptions: {
    headerShown: false,
  },
  screen: EnterPaperkey,
}

// Forward Msg Pick
const ForwardMsgPick = React.lazy(async () => import('./conversation/fwd-msg'))
const chatForwardMsgPick = {screen: ForwardMsgPick}

// Info Panel
const InfoPanel = React.lazy(async () => import('./conversation/info-panel'))
const chatInfoPanel = {screen: InfoPanel}

// Install Bot
const InstallBot = React.lazy(async () => import('./conversation/bot/install'))
const chatInstallBot = {screen: InstallBot}

// Install Bot Pick
const InstallBotPick = React.lazy(async () => import('./conversation/bot/team-picker'))
const chatInstallBotPick = {screen: InstallBotPick}

// Location Preview
const LocationPreview = React.lazy(async () => import('./conversation/input-area/location-popup'))
const chatLocationPreview = {screen: LocationPreview}

// Message Popup
const MessagePopup = React.lazy(async () => import('./conversation/messages/message-popup'))
const chatMessagePopup = {screen: MessagePopup}

// PDF
const PDF = React.lazy(async () => import('./pdf'))
const chatPDF = {screen: PDF}

// Root Single
const RootSingle = React.lazy(async () => import('./inbox/defer-loading'))
const chatRootSingle = {
  getOptions: {
    headerShown: false,
  },
  screen: RootSingle,
}

// Root Split
const RootSplit = React.lazy(async () => import('./inbox-and-conversation-2'))
const chatRootSplit = {
  getOptions: {
    headerShown: false,
  },
  screen: RootSplit,
}

// Search Bots
const SearchBots = React.lazy(async () => import('./conversation/bot/search'))
const chatSearchBots = {screen: SearchBots}

// Show New Team Dialog
const ShowNewTeamDialog = React.lazy(async () => import('./new-team-dialog-container'))
const chatShowNewTeamDialog = {screen: ShowNewTeamDialog}

// Unfurl Map Popup
const UnfurlMapPopup = React.lazy(async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup'))
const chatUnfurlMapPopup = {screen: UnfurlMapPopup}

// Send To Chat
const SendToChat = React.lazy(async () => import('./send-to-chat'))
const chatSendToChat = {screen: SendToChat}

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


import * as React from 'react'
import * as C from '@/constants'
import chatNewChat from '../team-building/page'

const AddToChannel = React.lazy(async () => import('./conversation/info-panel/add-to-channel'))
const chatAddToChannel = {screen: AddToChannel}

const AttachmentFullscreen = React.lazy(async () => import('./conversation/attachment-fullscreen'))
const chatAttachmentFullscreen = {screen: AttachmentFullscreen}

const AttachmentGetTitles = React.lazy(async () => import('./conversation/attachment-get-titles'))
const chatAttachmentGetTitles = {screen: AttachmentGetTitles}

const BlockingModal = React.lazy(async () => import('./blocking/block-modal'))
const chatBlockingModal = {screen: BlockingModal}

const ChooseEmoji = React.lazy(async () => import('./emoji-picker'))
const chatChooseEmoji = {screen: ChooseEmoji}

const ConfirmNavigateExternal = React.lazy(async () => import('./punycode-link-warning'))
const chatConfirmNavigateExternal = {screen: ConfirmNavigateExternal}

const ConfirmRemoveBot = React.lazy(async () => import('./conversation/bot/confirm'))
const chatConfirmRemoveBot = {screen: ConfirmRemoveBot}

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

const CreateChannel = React.lazy(async () => import('./create-channel'))
const chatCreateChannel = {screen: CreateChannel}

const DeleteHistoryWarning = React.lazy(async () => import('./delete-history-warning'))
const chatDeleteHistoryWarning = {screen: DeleteHistoryWarning}

const EnterPaperkey = React.lazy(async () => import('./conversation/rekey/enter-paper-key'))
const chatEnterPaperkey = {
  getOptions: {
    headerShown: false,
  },
  screen: EnterPaperkey,
}

const ForwardMsgPick = React.lazy(async () => import('./conversation/fwd-msg'))
const chatForwardMsgPick = {screen: ForwardMsgPick}

const InfoPanel = React.lazy(async () => import('./conversation/info-panel'))
const chatInfoPanel = {screen: InfoPanel}

const InstallBot = React.lazy(async () => import('./conversation/bot/install'))
const chatInstallBot = {screen: InstallBot}

const InstallBotPick = React.lazy(async () => import('./conversation/bot/team-picker'))
const chatInstallBotPick = {screen: InstallBotPick}

const LocationPreview = React.lazy(async () => import('./conversation/input-area/location-popup'))
const chatLocationPreview = {screen: LocationPreview}

const MessagePopup = React.lazy(async () => import('./conversation/messages/message-popup'))
const chatMessagePopup = {screen: MessagePopup}

const PDF = React.lazy(async () => import('./pdf'))
const chatPDF = {screen: PDF}

const RootSingle = React.lazy(async () => import('./inbox/defer-loading'))
const chatRootSingle = {
  getOptions: {
    headerShown: false,
  },
  screen: RootSingle,
}

const RootSplit = React.lazy(async () => import('./inbox-and-conversation-2'))
const chatRootSplit = {
  getOptions: {
    headerShown: false,
  },
  screen: RootSplit,
}

const SearchBots = React.lazy(async () => import('./conversation/bot/search'))
const chatSearchBots = {screen: SearchBots}

const ShowNewTeamDialog = React.lazy(async () => import('./new-team-dialog-container'))
const chatShowNewTeamDialog = {screen: ShowNewTeamDialog}

const UnfurlMapPopup = React.lazy(async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup'))
const chatUnfurlMapPopup = {screen: UnfurlMapPopup}

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


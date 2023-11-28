import * as C from '@/constants'
import chatAddToChannel from './conversation/info-panel/add-to-channel/page'
import chatAttachmentFullscreen from './conversation/attachment-fullscreen/page'
import chatAttachmentGetTitles from './conversation/attachment-get-titles/page'
import chatBlockingModal from './blocking/block-modal/page'
import chatChooseEmoji from './emoji-picker/page'
import chatConfirmNavigateExternal from './punycode-link-warning.page'
import chatConfirmRemoveBot from './conversation/bot/confirm.page'
import chatConversation from './conversation/page'
import chatCreateChannel from './create-channel/page'
import chatDeleteHistoryWarning from './delete-history-warning/page'
import chatEnterPaperkey from './conversation/rekey/enter-paper-key.page'
import chatForwardMsgPick from './conversation/fwd-msg/page'
import chatInfoPanel from './conversation/info-panel/page'
import chatInstallBot from './conversation/bot/install.page'
import chatInstallBotPick from './conversation/bot/team-picker.page'
import chatLocationPreview from './conversation/input-area/normal/location-popup.page'
import chatMessagePopup from './conversation/messages/message-popup/page'
import chatNewChat from '../team-building/page'
import chatPDF from './pdf/page'
import chatRootSingle from './inbox/defer-loading.page'
import chatRootSplit from './inbox-and-conversation-2.page'
import chatSearchBots from './conversation/bot/search.page'
import chatShowNewTeamDialog from './new-team-dialog-container.page'
import chatUnfurlMapPopup from './conversation/messages/text/unfurl/unfurl-list/map-popup.page'
import chatSendToChat from './send-to-chat/page'

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

import * as React from 'react'
import * as C from '@/constants'
import chatNewChat from '../team-building/page'

const Convo = React.lazy(async () => import('./conversation/container'))

export const newRoutes = {
  chatConversation: C.Chat.makeChatScreen(Convo, {
    getOptions: {headerShown: false},
  }),
  chatEnterPaperkey: {
    getOptions: {headerShown: false},
    screen: React.lazy(async () => import('./conversation/rekey/enter-paper-key')),
  },
  chatRoot: C.Chat.isSplit
    ? C.Chat.makeChatScreen(
        React.lazy(async () => import('./inbox-and-conversation-2')),
        {getOptions: {headerShown: false}}
      )
    : C.Chat.makeChatScreen(
        React.lazy(async () => import('./inbox/defer-loading')),
        {getOptions: {headerShown: false}}
      ),
}

export const newModalRoutes = {
  chatAddToChannel: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/info-panel/add-to-channel'))
  ),
  chatAttachmentFullscreen: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-fullscreen'))
  ),
  chatAttachmentGetTitles: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-get-titles'))
  ),
  chatBlockingModal: C.Chat.makeChatScreen(
    React.lazy(async () => import('./blocking/block-modal/container'))
  ),
  chatChooseEmoji: C.Chat.makeChatScreen(React.lazy(async () => import('./emoji-picker/container'))),
  chatConfirmNavigateExternal: C.Chat.makeChatScreen(
    React.lazy(async () => import('./punycode-link-warning'))
  ),
  chatConfirmRemoveBot: C.Chat.makeChatScreen(React.lazy(async () => import('./conversation/bot/confirm'))),
  chatCreateChannel: C.Chat.makeChatScreen(React.lazy(async () => import('./create-channel/container'))),
  chatDeleteHistoryWarning: C.Chat.makeChatScreen(
    React.lazy(async () => import('./delete-history-warning/container'))
  ),
  chatForwardMsgPick: C.Chat.makeChatScreen(React.lazy(async () => import('./conversation/fwd-msg'))),
  chatInfoPanel: C.Chat.makeChatScreen(React.lazy(async () => import('./conversation/info-panel'))),
  chatInstallBot: C.Chat.makeChatScreen(React.lazy(async () => import('./conversation/bot/install'))),
  chatInstallBotPick: C.Chat.makeChatScreen(React.lazy(async () => import('./conversation/bot/team-picker'))),
  chatLocationPreview: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/input-area/location-popup'))
  ),
  chatMessagePopup: C.Chat.makeChatScreen(
    React.lazy(async () => {
      const {MessagePopupModal} = await import('./conversation/messages/message-popup')
      return {default: MessagePopupModal}
    })
  ),
  chatNewChat,
  chatPDF: C.Chat.makeChatScreen(React.lazy(async () => import('./pdf'))),
  chatSearchBots: C.Chat.makeChatScreen(React.lazy(async () => import('./conversation/bot/search'))),
  chatSendToChat: C.Chat.makeChatScreen(React.lazy(async () => import('./send-to-chat'))),
  chatShowNewTeamDialog: C.Chat.makeChatScreen(React.lazy(async () => import('./new-team-dialog-container'))),
  chatUnfurlMapPopup: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup'))
  ),
}

export type RootParamListChat = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>

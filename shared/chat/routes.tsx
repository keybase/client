import * as React from 'react'
import * as C from '@/constants'
import chatNewChat from '../team-building/page'

function makeChatScreen<T extends React.LazyExoticComponent<any>>(
  Component: T,
  options?: {getOptions?: unknown}
) {
  return {
    ...options,
    screen: (p: C.Chat.ChatProviderProps<C.ViewPropsToPageProps<T>>) => {
      const Comp = Component as any
      return <Comp {...(p.route.params ?? {})} />
    },
  }
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

export const newRoutes = {
  chatConversation,
  chatEnterPaperkey: makeChatScreen(
    React.lazy(async () => import('./conversation/rekey/enter-paper-key')),
    {getOptions: {headerShown: false}}
  ),
  chatRoot: C.Chat.isSplit
    ? makeChatScreen(
        React.lazy(async () => import('./inbox-and-conversation-2')),
        {getOptions: {headerShown: false}}
      )
    : makeChatScreen(
        React.lazy(async () => import('./inbox/defer-loading')),
        {getOptions: {headerShown: false}}
      ),
}

export const newModalRoutes = {
  chatAddToChannel: makeChatScreen(
    React.lazy(async () => import('./conversation/info-panel/add-to-channel'))
  ),
  chatAttachmentFullscreen: makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-fullscreen'))
  ),
  chatAttachmentGetTitles: makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-get-titles'))
  ),
  chatBlockingModal: makeChatScreen(React.lazy(async () => import('./blocking/block-modal/container'))),
  chatChooseEmoji: makeChatScreen(React.lazy(async () => import('./emoji-picker'))),
  chatConfirmNavigateExternal: makeChatScreen(React.lazy(async () => import('./punycode-link-warning'))),
  chatConfirmRemoveBot: makeChatScreen(React.lazy(async () => import('./conversation/bot/confirm'))),
  chatCreateChannel: makeChatScreen(React.lazy(async () => import('./create-channel'))),
  chatDeleteHistoryWarning: makeChatScreen(
    React.lazy(async () => import('./delete-history-warning/container'))
  ),
  chatForwardMsgPick: makeChatScreen(React.lazy(async () => import('./conversation/fwd-msg'))),
  chatInfoPanel: makeChatScreen(React.lazy(async () => import('./conversation/info-panel'))),
  chatInstallBot: makeChatScreen(React.lazy(async () => import('./conversation/bot/install'))),
  chatInstallBotPick: makeChatScreen(React.lazy(async () => import('./conversation/bot/team-picker'))),
  chatLocationPreview: makeChatScreen(
    React.lazy(async () => import('./conversation/input-area/location-popup'))
  ),
  chatMessagePopup: makeChatScreen(
    React.lazy(async () => {
      const {MessagePopupModal} = await import('./conversation/messages/message-popup')
      return {default: MessagePopupModal}
    })
  ),
  chatNewChat,
  chatPDF: makeChatScreen(React.lazy(async () => import('./pdf'))),
  chatSearchBots: makeChatScreen(React.lazy(async () => import('./conversation/bot/search'))),
  chatSendToChat: makeChatScreen(React.lazy(async () => import('./send-to-chat'))),
  chatShowNewTeamDialog: makeChatScreen(React.lazy(async () => import('./new-team-dialog-container'))),
  chatUnfurlMapPopup: makeChatScreen(
    React.lazy(async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup'))
  ),
}

export type RootParamListChat = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>

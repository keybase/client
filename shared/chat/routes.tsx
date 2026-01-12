import * as React from 'react'
import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import chatNewChat from '../team-building/page'
import {headerNavigationOptions} from './conversation/header-area'
import inboxGetOptions from './inbox/get-options'
import inboxAndConvoGetOptions from './inbox-and-conversation-2-get-options'

const Convo = React.lazy(async () => import('./conversation/container'))

export const newRoutes = {
  chatConversation: Chat.makeChatScreen(Convo, {
    canBeNullConvoID: true,
    getOptions: p => ({
      ...headerNavigationOptions(p.route),
      presentation: undefined,
    }),
  }),
  chatEnterPaperkey: {
    screen: React.lazy(async () => import('./conversation/rekey/enter-paper-key')),
  },
  chatRoot: Chat.isSplit
    ? Chat.makeChatScreen(
        React.lazy(async () => import('./inbox-and-conversation-2')),
        {getOptions: inboxAndConvoGetOptions, skipProvider: true}
      )
    : Chat.makeChatScreen(
        React.lazy(async () => import('./inbox/defer-loading')),
        {getOptions: inboxGetOptions, skipProvider: true}
      ),
}

export const newModalRoutes = {
  chatAddToChannel: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/info-panel/add-to-channel'))
  ),
  chatAttachmentFullscreen: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-fullscreen/screen')),
    {
      getOptions: {
        ...(C.isIOS ? {orientation: 'all', presentation: 'transparentModal'} : {}),
        safeAreaStyle: {backgroundColor: 'black'}, // true black
      },
    }
  ),
  chatAttachmentGetTitles: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-get-titles'))
  ),
  chatBlockingModal: Chat.makeChatScreen(React.lazy(async () => import('./blocking/block-modal'))),
  chatChooseEmoji: Chat.makeChatScreen(React.lazy(async () => import('./emoji-picker/container'))),
  chatConfirmNavigateExternal: Chat.makeChatScreen(
    React.lazy(async () => import('./punycode-link-warning')),
    {skipProvider: true}
  ),
  chatConfirmRemoveBot: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/confirm')),
    {canBeNullConvoID: true}
  ),
  chatCreateChannel: Chat.makeChatScreen(
    React.lazy(async () => import('./create-channel')),
    {skipProvider: true}
  ),
  chatDeleteHistoryWarning: Chat.makeChatScreen(React.lazy(async () => import('./delete-history-warning'))),
  chatForwardMsgPick: Chat.makeChatScreen(React.lazy(async () => import('./conversation/fwd-msg'))),
  chatInfoPanel: Chat.makeChatScreen(React.lazy(async () => import('./conversation/info-panel'))),
  chatInstallBot: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/install')),
    {skipProvider: true}
  ),
  chatInstallBotPick: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/team-picker')),
    {skipProvider: true}
  ),
  chatLocationPreview: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/input-area/location-popup'))
  ),
  chatMessagePopup: Chat.makeChatScreen(
    React.lazy(async () => {
      const {MessagePopupModal} = await import('./conversation/messages/message-popup')
      return {default: MessagePopupModal}
    })
  ),
  chatNewChat,
  chatPDF: Chat.makeChatScreen(
    React.lazy(async () => import('./pdf')),
    {getOptions: C.isMobile ? undefined : {modal2: true, modal2Type: 'SuperWide'}}
  ),
  chatSearchBots: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/search')),
    {canBeNullConvoID: true}
  ),
  chatSendToChat: Chat.makeChatScreen(
    React.lazy(async () => import('./send-to-chat')),
    {skipProvider: true}
  ),
  chatShowNewTeamDialog: Chat.makeChatScreen(React.lazy(async () => import('./new-team-dialog-container'))),
  chatUnfurlMapPopup: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup'))
  ),
}

export type RootParamListChat = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>

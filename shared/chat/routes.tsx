import * as React from 'react'
import * as C from '@/constants'
import chatNewChat from '../team-building/page'
import {headerNavigationOptions} from './conversation/header-area/container'
import inboxGetOptions from './inbox/get-options'
import inboxAndConvoGetOptions from './inbox-and-conversation-2-get-options'

const Convo = React.lazy(async () => import('./conversation/container'))

export const newRoutes = {
  chatConversation: C.Chat.makeChatScreen(Convo, {
    canBeNullConvoID: true,
    getOptions: p => ({
      ...headerNavigationOptions(p.route),
      presentation: undefined,
    }),
  }),
  chatEnterPaperkey: {
    screen: React.lazy(async () => import('./conversation/rekey/enter-paper-key')),
  },
  chatRoot: C.Chat.isSplit
    ? C.Chat.makeChatScreen(
        React.lazy(async () => import('./inbox-and-conversation-2')),
        {getOptions: inboxAndConvoGetOptions, skipProvider: true}
      )
    : C.Chat.makeChatScreen(
        React.lazy(async () => import('./inbox/defer-loading')),
        {getOptions: inboxGetOptions, skipProvider: true}
      ),
}

export const newModalRoutes = {
  chatAddToChannel: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/info-panel/add-to-channel'))
  ),
  chatAttachmentFullscreen: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-fullscreen/screen')),
    {
      getOptions: {
        ...(C.isIOS ? {orientation: 'all', presentation: 'transparentModal'} : {}),
        safeAreaStyle: {backgroundColor: 'black'}, // true black
      },
    }
  ),
  chatAttachmentGetTitles: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-get-titles'))
  ),
  chatBlockingModal: C.Chat.makeChatScreen(
    React.lazy(async () => import('./blocking/block-modal'))
  ),
  chatChooseEmoji: C.Chat.makeChatScreen(React.lazy(async () => import('./emoji-picker/container'))),
  chatConfirmNavigateExternal: C.Chat.makeChatScreen(
    React.lazy(async () => import('./punycode-link-warning')),
    {skipProvider: true}
  ),
  chatConfirmRemoveBot: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/confirm')),
    {canBeNullConvoID: true}
  ),
  chatCreateChannel: C.Chat.makeChatScreen(
    React.lazy(async () => import('./create-channel/container')),
    {skipProvider: true}
  ),
  chatDeleteHistoryWarning: C.Chat.makeChatScreen(
    React.lazy(async () => import('./delete-history-warning'))
  ),
  chatForwardMsgPick: C.Chat.makeChatScreen(React.lazy(async () => import('./conversation/fwd-msg'))),
  chatInfoPanel: C.Chat.makeChatScreen(React.lazy(async () => import('./conversation/info-panel'))),
  chatInstallBot: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/install')),
    {skipProvider: true}
  ),
  chatInstallBotPick: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/team-picker')),
    {skipProvider: true}
  ),
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
  chatPDF: C.Chat.makeChatScreen(
    React.lazy(async () => import('./pdf')),
    {getOptions: C.isMobile ? undefined : {modal2: true, modal2Type: 'SuperWide'}}
  ),
  chatSearchBots: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/search')),
    {canBeNullConvoID: true}
  ),
  chatSendToChat: C.Chat.makeChatScreen(
    React.lazy(async () => import('./send-to-chat')),
    {skipProvider: true}
  ),
  chatShowNewTeamDialog: C.Chat.makeChatScreen(React.lazy(async () => import('./new-team-dialog-container'))),
  chatUnfurlMapPopup: C.Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup'))
  ),
}

export type RootParamListChat = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>

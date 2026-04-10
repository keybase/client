import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Chat from '@/stores/chat'
import * as FS from '@/constants/fs'
import type * as T from '@/constants/types'
import chatNewChat from '../team-building/page'
import {headerNavigationOptions} from './conversation/header-area'
import {useConfigState} from '@/stores/config'
import {useModalHeaderState} from '@/stores/modal-header'
import {ModalTitle} from '@/teams/common'
import inboxGetOptions from './inbox/get-options'
import inboxAndConvoGetOptions from './inbox-and-conversation-get-options'
import {defineRouteMap, withRouteParams} from '@/constants/types/router'
import type {BlockModalContext} from './blocking/block-modal'
import type {ChatRootRouteParams} from './inbox-and-conversation'
const Convo = React.lazy(async () => import('./conversation/container'))

type ChatBlockingRouteParams = {
  blockUserByDefault?: boolean
  filterUserByDefault?: boolean
  flagUserByDefault?: boolean
  reportsUserByDefault?: boolean
  context?: BlockModalContext
  conversationIDKey?: T.Chat.ConversationIDKey
  others?: Array<string>
  team?: string
  username?: string
}
type ChatSearchBotsRouteParams = {
  teamID?: T.Teams.TeamID
  conversationIDKey?: T.Chat.ConversationIDKey
}
type ChatShowNewTeamDialogRouteParams = {
  conversationIDKey?: T.Chat.ConversationIDKey
}
const emptyChatBlockingRouteParams: ChatBlockingRouteParams = {}
const emptyChatSearchBotsRouteParams: ChatSearchBotsRouteParams = {}
const emptyChatShowNewTeamDialogRouteParams: ChatShowNewTeamDialogRouteParams = {}
const emptyChatRootRouteParams: ChatRootRouteParams = {}

const PDFShareButton = ({url}: {url?: string}) => {
  const showShareActionSheet = useConfigState(s => s.dispatch.defer.showShareActionSheet)
  return (
    <Kb.Icon
      type="iconfont-share"
      onClick={() => showShareActionSheet?.(url ?? '', '', 'application/pdf')}
    />
  )
}

const PDFHeaderTitle = () => {
  const title = useModalHeaderState(s => s.title)
  return <Kb.Text type="BodyBig">{title || 'PDF'}</Kb.Text>
}

const FwdMsgHeaderTitle = () => {
  const title = useModalHeaderState(s => s.title)
  return <>{title || 'Forward to team or chat'}</>
}

const BotInstallHeaderTitle = () => {
  const subScreen = useModalHeaderState(s => s.botSubScreen)
  return <>{subScreen === 'channels' ? 'Channels' : ''}</>
}

const BotInstallHeaderLeft = () => {
  const {subScreen, inTeam, readOnly, onAction} = useModalHeaderState(
    C.useShallow(s => ({inTeam: s.botInTeam, onAction: s.onAction, readOnly: s.botReadOnly, subScreen: s.botSubScreen}))
  )
  if (subScreen === 'channels') {
    return <Kb.Text type="BodyBigLink" onClick={onAction}>Back</Kb.Text>
  }
  if (Kb.Styles.isMobile || subScreen === 'install') {
    const label = subScreen === 'install'
      ? (Kb.Styles.isMobile ? 'Back' : <Kb.Icon type="iconfont-arrow-left" />)
      : inTeam || readOnly ? 'Close' : 'Cancel'
    return <Kb.Text type="BodyBigLink" onClick={onAction}>{label}</Kb.Text>
  }
  return null
}

const AddToChannelHeaderTitle = ({teamID}: {teamID: T.Teams.TeamID}) => {
  const title = useModalHeaderState(s => s.title)
  const displayTitle = title || 'Add to channel'
  if (Kb.Styles.isMobile) return <>{displayTitle}</>
  return <ModalTitle teamID={teamID} title={displayTitle} />
}

const AddToChannelHeaderRight = () => {
  const {enabled, waiting, onAction} = useModalHeaderState(
    C.useShallow(s => ({enabled: s.actionEnabled, onAction: s.onAction, waiting: s.actionWaiting}))
  )
  if (!Kb.Styles.isMobile) return null
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={!waiting && enabled ? onAction : undefined}
      style={!enabled ? {opacity: 0.4} : undefined}
    >
      Add
    </Kb.Text>
  )
}

const SendToChatHeaderLeft = ({canBack}: {canBack?: boolean}) => {
  const clearModals = C.Router2.clearModals
  const navigateUp = C.Router2.navigateUp
  if (canBack) {
    return <Kb.Text type="BodyBigLink" onClick={navigateUp}>Back</Kb.Text>
  }
  return <Kb.Text type="BodyBigLink" onClick={clearModals}>Cancel</Kb.Text>
}

export const newRoutes = defineRouteMap({
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
    ? {
        ...withRouteParams<ChatRootRouteParams>(
          Chat.makeChatScreen(React.lazy(async () => import('./inbox-and-conversation')), {
            getOptions: inboxAndConvoGetOptions,
            skipProvider: true,
          })
        ),
        initialParams: emptyChatRootRouteParams,
      }
    : {
        ...withRouteParams<ChatRootRouteParams>(
          Chat.makeChatScreen(React.lazy(async () => import('./inbox/defer-loading')), {
            getOptions: inboxGetOptions,
            skipProvider: true,
          })
        ),
        initialParams: emptyChatRootRouteParams,
      },
})

export const newModalRoutes = defineRouteMap({
  chatAddToChannel: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/info-panel/add-to-channel')),
    {
      getOptions: ({route}) => ({
        headerRight: () => <AddToChannelHeaderRight />,
        headerTitle: () => <AddToChannelHeaderTitle teamID={route.params.teamID} />,
      }),
    }
  ),
  chatAttachmentFullscreen: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-fullscreen/screen')),
    {
      getOptions: {
        ...(C.isIOS ? {orientation: 'all', presentation: 'transparentModal'} : {}),
        headerShown: false,
        modalStyle: {flex: 1, maxHeight: 9999, width: '100%'},
        overlayStyle: {alignSelf: 'stretch', paddingBottom: 16, paddingLeft: 40, paddingRight: 40, paddingTop: 40},
        safeAreaStyle: {backgroundColor: 'black'}, // true black
      },
    }
  ),
  chatAttachmentGetTitles: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-get-titles')),
    {getOptions: {modalStyle: {height: 660, maxHeight: 660}}}
  ),
  chatBlockingModal: {
    ...Chat.makeChatScreen(React.lazy(async () => import('./blocking/block-modal')), {
      getOptions: {
        headerTitle: () => <Kb.Icon type="iconfont-user-block" sizeType="Big" color={Kb.Styles.globalColors.red} />,
      },
    }),
    initialParams: emptyChatBlockingRouteParams,
  },
  chatChooseEmoji: Chat.makeChatScreen(React.lazy(async () => import('./emoji-picker/container')), {
    getOptions: {headerShown: false},
  }),
  chatConfirmNavigateExternal: Chat.makeChatScreen(
    React.lazy(async () => import('./punycode-link-warning')),
    {skipProvider: true}
  ),
  chatConfirmRemoveBot: Chat.makeChatScreen(React.lazy(async () => import('./conversation/bot/confirm')), {canBeNullConvoID: true}),
  chatCreateChannel: Chat.makeChatScreen(
    React.lazy(async () => import('./create-channel')),
    {skipProvider: true}
  ),
  chatDeleteHistoryWarning: Chat.makeChatScreen(React.lazy(async () => import('./delete-history-warning'))),
  chatForwardMsgPick: Chat.makeChatScreen(React.lazy(async () => import('./conversation/fwd-msg')), {
    getOptions: {headerTitle: () => <FwdMsgHeaderTitle />},
  }),
  chatInfoPanel: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/info-panel')),
    {getOptions: C.isMobile ? undefined : {modalStyle: {height: '80%', width: '80%'}}}
  ),
  chatInstallBot: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/install')),
    {
      getOptions: {
        headerLeft: () => <BotInstallHeaderLeft />,
        headerTitle: () => <BotInstallHeaderTitle />,
        ...(C.isMobile ? undefined : {modalStyle: {height: 660, maxHeight: 660}}),
      },
      skipProvider: true,
    }
  ),
  chatInstallBotPick: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/bot/team-picker')),
    {getOptions: {title: 'Add to team or chat'}, skipProvider: true}
  ),
  chatLocationPreview: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/input-area/location-popup')),
    {getOptions: {title: 'Location'}}
  ),
  chatMessagePopup: Chat.makeChatScreen(
    React.lazy(async () => {
      const {MessagePopupModal} = await import('./conversation/messages/message-popup')
      return {default: MessagePopupModal}
    })
  ),
  chatNewChat,
  chatPDF: Chat.makeChatScreen(React.lazy(async () => import('./pdf')), {
    getOptions: p => ({
      headerRight: C.isMobile ? () => <PDFShareButton url={p.route.params.url} /> : undefined,
      headerTitle: () => <PDFHeaderTitle />,
      modalStyle: {height: '80%', maxHeight: '80%', width: '80%'},
      overlayStyle: {alignSelf: 'stretch'},
    }),
  }),
  chatSearchBots: {
    ...Chat.makeChatScreen(React.lazy(async () => import('./conversation/bot/search')), {
      canBeNullConvoID: true,
      getOptions: {title: 'Add a bot'},
    }),
    initialParams: emptyChatSearchBotsRouteParams,
  },
  chatSendToChat: Chat.makeChatScreen(
    React.lazy(async () => import('./send-to-chat')),
    {
      getOptions: ({route}) => ({
        headerLeft: () => <SendToChatHeaderLeft canBack={route.params.canBack} />,
        title: FS.getSharePathArrayDescription(route.params.sendPaths || []),
      }),
      skipProvider: true,
    }
  ),
  chatShowNewTeamDialog: {
    ...Chat.makeChatScreen(React.lazy(async () => import('./new-team-dialog-container'))),
    initialParams: emptyChatShowNewTeamDialogRouteParams,
  },
  chatUnfurlMapPopup: Chat.makeChatScreen(
    React.lazy(async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup')),
    {getOptions: {title: 'Location'}}
  ),
})

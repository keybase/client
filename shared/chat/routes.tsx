import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Chat from '@/constants/chat'
import {makeChatScreen} from '@/chat/make-chat-screen'
import * as FS from '@/constants/fs'
import type * as T from '@/constants/types'
import chatNewChat from '@/team-building/page'
import {TeamBuilderScreen} from '@/team-building/page'
import {headerNavigationOptions} from '@/chat/conversation/header-area'
import {useModalHeaderState} from '@/stores/modal-header'
import {ModalTitle} from '@/teams/common'
import inboxGetOptions from '@/chat/inbox/get-options'
import inboxAndConvoGetOptions from '@/chat/inbox-and-conversation-get-options'
import {defineRouteMap} from '@/constants/types/router'
import type {BlockModalContext} from '@/chat/blocking/block-modal'
import type {ChatRootRouteParams} from '@/chat/inbox-and-conversation'
import {onTeamBuildingFinished} from '@/chat/team-building-finished'
import {showShareActionSheet} from '@/util/storeless-actions'
const Convo = React.lazy(async () => import('@/chat/conversation/container'))

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

const ChatTeamBuilderScreen = (p: Parameters<typeof TeamBuilderScreen>[0]) => (
  <TeamBuilderScreen {...p} onComplete={onTeamBuildingFinished} />
)

const PDFShareButton = ({url}: {url?: string}) => {
  return (
    <Kb.Icon type="iconfont-share" onClick={() => showShareActionSheet(url ?? '', '', 'application/pdf')} />
  )
}

const BotInstallHeaderTitle = () => {
  const subScreen = useModalHeaderState(s => s.botSubScreen)
  return <>{subScreen === 'channels' ? 'Channels' : ''}</>
}

const BotInstallHeaderLeft = () => {
  const {subScreen, inTeam, readOnly, onAction} = useModalHeaderState(
    C.useShallow(s => ({
      inTeam: s.botInTeam,
      onAction: s.onAction,
      readOnly: s.botReadOnly,
      subScreen: s.botSubScreen,
    }))
  )
  if (subScreen === 'channels') {
    return (
      <Kb.Text type="BodyBigLink" onClick={onAction}>
        Back
      </Kb.Text>
    )
  }
  if (Kb.Styles.isMobile || subScreen === 'install') {
    const label =
      subScreen === 'install' ? (
        Kb.Styles.isMobile ? (
          'Back'
        ) : (
          <Kb.Icon type="iconfont-arrow-left" />
        )
      ) : inTeam || readOnly ? (
        'Close'
      ) : (
        'Cancel'
      )
    return (
      <Kb.Text type="BodyBigLink" onClick={onAction}>
        {label}
      </Kb.Text>
    )
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
    return (
      <Kb.Text type="BodyBigLink" onClick={navigateUp}>
        Back
      </Kb.Text>
    )
  }
  return (
    <Kb.Text type="BodyBigLink" onClick={clearModals}>
      Cancel
    </Kb.Text>
  )
}

export const newRoutes = defineRouteMap({
  chatConversation: makeChatScreen(Convo, {
    canBeNullConvoID: true,
    getOptions: p => ({
      ...headerNavigationOptions(p.route),
      presentation: undefined,
    }),
  }),
  chatEnterPaperkey: {
    screen: React.lazy(async () => import('@/chat/conversation/rekey/enter-paper-key')),
  },
  chatRoot: Chat.isSplit
    ? {
        ...makeChatScreen(
          React.lazy(async () => import('@/chat/inbox-and-conversation')),
          {
            getOptions: inboxAndConvoGetOptions,
            skipProvider: true,
          }
        ),
        initialParams: emptyChatRootRouteParams,
      }
    : {
        ...makeChatScreen(
          React.lazy(async () => import('@/chat/inbox')),
          {
            getOptions: inboxGetOptions,
            skipProvider: true,
          }
        ),
        initialParams: emptyChatRootRouteParams,
      },
})

export const newModalRoutes = defineRouteMap({
  chatAddToChannel: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/info-panel/add-to-channel')),
    {
      getOptions: ({route}) => ({
        headerRight: () => <AddToChannelHeaderRight />,
        headerTitle: () => <AddToChannelHeaderTitle teamID={route.params.teamID} />,
      }),
    }
  ),
  chatAttachmentFullscreen: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/attachment-fullscreen/screen')),
    {
      getOptions: {
        ...(C.isIOS ? {orientation: 'all', presentation: 'transparentModal'} : {}),
        headerShown: false,
        modalStyle: {flex: 1, maxHeight: 9999, width: '100%'},
        overlayStyle: {
          alignSelf: 'stretch',
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          paddingTop: 40,
        },
        safeAreaStyle: {backgroundColor: 'black'}, // true black
      },
    }
  ),
  chatAttachmentGetTitles: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/attachment-get-titles')),
    {getOptions: {modalStyle: {height: 660, maxHeight: 660}}}
  ),
  chatBlockingModal: {
    ...makeChatScreen(
      React.lazy(async () => import('@/chat/blocking/block-modal')),
      {
        getOptions: {
          headerTitle: () => (
            <Kb.Icon type="iconfont-user-block" sizeType="Big" color={Kb.Styles.globalColors.red} />
          ),
        },
      }
    ),
    initialParams: emptyChatBlockingRouteParams,
  },
  chatChooseEmoji: makeChatScreen(
    React.lazy(async () => import('@/chat/emoji-picker/container')),
    {
      getOptions: {headerShown: false},
    }
  ),
  chatConfirmNavigateExternal: makeChatScreen(
    React.lazy(async () => import('@/chat/punycode-link-warning')),
    {skipProvider: true}
  ),
  chatConfirmRemoveBot: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/bot/confirm')),
    {canBeNullConvoID: true}
  ),
  chatCreateChannel: makeChatScreen(
    React.lazy(async () => import('@/chat/create-channel')),
    {skipProvider: true}
  ),
  chatDeleteHistoryWarning: makeChatScreen(React.lazy(async () => import('@/chat/delete-history-warning'))),
  chatForwardMsgPick: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/fwd-msg')),
    {
      getOptions: {title: 'Forward to team or chat'},
    }
  ),
  chatInfoPanel: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/info-panel')),
    {getOptions: C.isMobile ? undefined : {modalStyle: {height: '80%', width: '80%'}}}
  ),
  chatInstallBot: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/bot/install')),
    {
      getOptions: {
        headerLeft: () => <BotInstallHeaderLeft />,
        headerTitle: () => <BotInstallHeaderTitle />,
        ...(C.isMobile ? undefined : {modalStyle: {height: 660, maxHeight: 660}}),
      },
      skipProvider: true,
    }
  ),
  chatInstallBotPick: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/bot/team-picker')),
    {getOptions: {title: 'Add to team or chat'}, skipProvider: true}
  ),
  chatLocationPreview: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/input-area/location-popup')),
    {getOptions: {title: 'Location'}}
  ),
  chatMessagePopup: makeChatScreen(
    React.lazy(async () => {
      const {MessagePopupModal} = await import('@/chat/conversation/messages/message-popup')
      return {default: MessagePopupModal}
    })
  ),
  chatNewChat: {
    ...chatNewChat,
    screen: ChatTeamBuilderScreen,
  },
  chatPDF: makeChatScreen(
    React.lazy(async () => import('@/chat/pdf')),
    {
      getOptions: p => ({
        headerRight: C.isMobile ? () => <PDFShareButton url={p.route.params.url} /> : undefined,
        modalStyle: {height: '80%', maxHeight: '80%', width: '80%'},
        overlayStyle: {alignSelf: 'stretch'},
        title: 'PDF',
      }),
    }
  ),
  chatSearchBots: {
    ...makeChatScreen(
      React.lazy(async () => import('@/chat/conversation/bot/search')),
      {
        canBeNullConvoID: true,
        getOptions: {title: 'Add a bot'},
      }
    ),
    initialParams: emptyChatSearchBotsRouteParams,
  },
  chatSendToChat: makeChatScreen(
    React.lazy(async () => import('@/chat/send-to-chat')),
    {
      getOptions: ({route}) => ({
        headerLeft: () => <SendToChatHeaderLeft canBack={route.params.canBack} />,
        title: FS.getSharePathArrayDescription(route.params.sendPaths || []),
      }),
      skipProvider: true,
    }
  ),
  chatShowNewTeamDialog: {
    ...makeChatScreen(React.lazy(async () => import('@/chat/new-team-dialog-container'))),
    initialParams: emptyChatShowNewTeamDialogRouteParams,
  },
  chatUnfurlMapPopup: makeChatScreen(
    React.lazy(async () => import('@/chat/conversation/messages/text/unfurl/unfurl-list/map-popup')),
    {getOptions: {title: 'Location'}}
  ),
})

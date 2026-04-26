import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Chat from '@/stores/chat'
import {makeChatScreen} from './make-chat-screen'
import * as FS from '@/constants/fs'
import type * as T from '@/constants/types'
import chatNewChat from '../team-building/page'
import {TeamBuilderScreen} from '../team-building/page'
import {headerNavigationOptions} from './conversation/header-area'
import {useModalHeaderState} from '@/stores/modal-header'
import {ModalTitle} from '@/teams/common'
import inboxGetOptions from './inbox/get-options'
import InboxAndConvoHeader from './inbox-and-conversation-header'
import {defineRouteMap, withRouteParams, type GetOptionsRet} from '@/constants/types/router'
import type {BlockModalContext} from './blocking/block-modal'
import type {ChatRootRouteParams} from './inbox-and-conversation'
import {onTeamBuildingFinished} from '@/stores/convostate'
import {showShareActionSheet} from '@/util/storeless-actions'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
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

const ChatTeamBuilderScreen = (p: Parameters<typeof TeamBuilderScreen>[0]) => (
  <TeamBuilderScreen {...p} onComplete={onTeamBuildingFinished} />
)

const PDFShareButton = ({url}: {url?: string | undefined}) => {
  return (
    <Kb.Icon type="iconfont-share" onClick={() => showShareActionSheet(url ?? '', '', 'application/pdf')} />
  )
}

const InboxAndConvoTabletHeader = () => {
  const {width} = useSafeAreaFrame()
  return (
    <Kb.Box2 direction="horizontal" style={{height: 48, marginLeft: -20, width}}>
      <InboxAndConvoHeader />
    </Kb.Box2>
  )
}

const inboxAndConvoGetOptions: GetOptionsRet = Kb.Styles.isTablet
  ? {
      headerBackgroundContainerStyle: {},
      headerLeftContainerStyle: {maxWidth: 0},
      headerRightContainerStyle: {maxWidth: 0},
      headerStyle: {},
      headerTitle: () => <InboxAndConvoTabletHeader />,
      headerTitleContainerStyle: {},
    }
  : {
      headerTitle: () => <InboxAndConvoHeader />,
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
      <Kb.Text type="BodyBigLink" {...(onAction === undefined ? {} : {onClick: onAction})}>
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
      <Kb.Text type="BodyBigLink" {...(onAction === undefined ? {} : {onClick: onAction})}>
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
  const onClick = !waiting && enabled ? onAction : undefined
  return (
    <Kb.Text
      type="BodyBigLink"
      {...(onClick === undefined ? {} : {onClick})}
      {...(enabled ? {} : {style: {opacity: 0.4}})}
    >
      Add
    </Kb.Text>
  )
}

const SendToChatHeaderLeft = ({canBack}: {canBack?: boolean | undefined}) => {
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
    }),
  }),
  chatEnterPaperkey: {
    screen: React.lazy(async () => import('./conversation/rekey/enter-paper-key')),
  },
  chatRoot: withRouteParams<ChatRootRouteParams>(
    Chat.isSplit
      ? {
          ...makeChatScreen(
            React.lazy(async () => import('./inbox-and-conversation')),
            {
              getOptions: inboxAndConvoGetOptions,
              skipProvider: true,
            }
          ),
          initialParams: emptyChatRootRouteParams,
        }
      : {
          ...makeChatScreen(
            React.lazy(async () => import('./inbox')),
            {
              getOptions: inboxGetOptions,
              skipProvider: true,
            }
          ),
          initialParams: emptyChatRootRouteParams,
        }
  ),
})

export const newModalRoutes = defineRouteMap({
  chatAddToChannel: makeChatScreen(
    React.lazy(async () => import('./conversation/info-panel/add-to-channel')),
    {
      getOptions: ({route}) => ({
        headerRight: () => <AddToChannelHeaderRight />,
        headerTitle: () => <AddToChannelHeaderTitle teamID={route.params.teamID} />,
      }),
    }
  ),
  chatAttachmentFullscreen: makeChatScreen(
    React.lazy(async () => import('./conversation/attachment-fullscreen/screen')),
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
    React.lazy(async () => import('./conversation/attachment-get-titles')),
    {getOptions: {modalStyle: {height: 660, maxHeight: 660}}}
  ),
  chatBlockingModal: {
    ...makeChatScreen(
      React.lazy(async () => import('./blocking/block-modal')),
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
    React.lazy(async () => import('./emoji-picker/container')),
    {
      getOptions: {headerShown: false},
    }
  ),
  chatConfirmNavigateExternal: makeChatScreen(
    React.lazy(async () => import('./punycode-link-warning')),
    {skipProvider: true}
  ),
  chatConfirmRemoveBot: makeChatScreen(
    React.lazy(async () => import('./conversation/bot/confirm')),
    {canBeNullConvoID: true}
  ),
  chatCreateChannel: makeChatScreen(
    React.lazy(async () => import('./create-channel')),
    {skipProvider: true}
  ),
  chatDeleteHistoryWarning: makeChatScreen(React.lazy(async () => import('./delete-history-warning'))),
  chatForwardMsgPick: makeChatScreen(
    React.lazy(async () => import('./conversation/fwd-msg')),
    {
      getOptions: {title: 'Forward to team or chat'},
    }
  ),
  chatInfoPanel: makeChatScreen(
    React.lazy(async () => import('./conversation/info-panel')),
    {getOptions: C.isMobile ? undefined : {modalStyle: {height: '80%', width: '80%'}}}
  ),
  chatInstallBot: makeChatScreen(
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
  chatInstallBotPick: makeChatScreen(
    React.lazy(async () => import('./conversation/bot/team-picker')),
    {getOptions: {title: 'Add to team or chat'}, skipProvider: true}
  ),
  chatLocationPreview: makeChatScreen(
    React.lazy(async () => import('./conversation/input-area/location-popup')),
    {getOptions: {title: 'Location'}}
  ),
  chatMessagePopup: makeChatScreen(
    React.lazy(async () => {
      const {MessagePopupModal} = await import('./conversation/messages/message-popup')
      return {default: MessagePopupModal}
    })
  ),
  chatNewChat: {
    ...chatNewChat,
    screen: ChatTeamBuilderScreen,
  },
  chatPDF: makeChatScreen(
    React.lazy(async () => import('./pdf')),
    {
      getOptions: p => ({
        ...(C.isMobile ? {headerRight: () => <PDFShareButton url={p.route.params.url} />} : {}),
        modalStyle: {height: '80%', maxHeight: '80%', width: '80%'},
        overlayStyle: {alignSelf: 'stretch'},
        title: 'PDF',
      }),
    }
  ),
  chatSearchBots: {
    ...makeChatScreen(
      React.lazy(async () => import('./conversation/bot/search')),
      {
        canBeNullConvoID: true,
        getOptions: {title: 'Add a bot'},
      }
    ),
    initialParams: emptyChatSearchBotsRouteParams,
  },
  chatSendToChat: makeChatScreen(
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
    ...makeChatScreen(React.lazy(async () => import('./new-team-dialog-container'))),
    initialParams: emptyChatShowNewTeamDialogRouteParams,
  },
  chatUnfurlMapPopup: makeChatScreen(
    React.lazy(async () => import('./conversation/messages/text/unfurl/unfurl-list/map-popup')),
    {getOptions: {title: 'Location'}}
  ),
})

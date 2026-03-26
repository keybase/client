// A mirror of the remote menubar windows.
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import {useConfigState} from '@/stores/config'
import * as T from '@/constants/types'
import * as React from 'react'
import KB2 from '@/util/electron.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import type {Props, Conversation, RemoteTlfUpdates} from './index.desktop'
import {useColorScheme} from 'react-native'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'
import {useFollowerState} from '@/stores/followers'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useNotifState} from '@/stores/notifications'
import type * as NotifConstants from '@/stores/notifications'

const {showTray} = KB2.functions

type WidgetProps = {
  desktopAppBadgeCount: number
  widgetBadge: NotifConstants.BadgeType
}

const emptyConversations: ReadonlyArray<Conversation> = []

function useWidgetTray(p: WidgetProps) {
  const {desktopAppBadgeCount, widgetBadge} = p
  const systemDarkMode = useDarkModeState(s => s.systemDarkMode)

  React.useEffect(() => {
    showTray?.(desktopAppBadgeCount, widgetBadge)
  }, [widgetBadge, desktopAppBadgeCount, systemDarkMode])
}

const toRemoteTlfUpdate = (t: T.FS.TlfUpdate, uploads: T.FS.Uploads): RemoteTlfUpdates => ({
  timestamp: t.serverTime,
  tlf: t.path,
  updates: t.history.map(u => {
    const path = T.FS.stringToPath(u.filename)
    return {path, uploading: uploads.syncingPaths.has(path) || uploads.writingToJournal.has(path)}
  }),
  writer: t.writer,
})

const convoDiff = (a: Chat.ConvoState, b: Chat.ConvoState) => {
  if (a === b) return false

  if (a.meta !== b.meta) {
    if (
      a.meta.channelname !== b.meta.channelname ||
      a.meta.snippetDecorated !== b.meta.snippetDecorated ||
      a.meta.teamType !== b.meta.teamType ||
      a.meta.timestamp !== b.meta.timestamp ||
      a.meta.tlfname !== b.meta.tlfname
    ) {
      return true
    }
  }

  if (
    a.badge !== b.badge ||
    a.unread !== b.unread ||
    !C.shallowEqual(a.participants.name, b.participants.name)
  ) {
    return true
  }

  return false
}

const toRemoteConversation = (
  conversationIDKey: T.Chat.ConversationIDKey,
  conversation: Chat.ConvoState
): Conversation | undefined => {
  if (!conversation.isMetaGood()) {
    return undefined
  }

  const {badge, unread, participants, meta} = conversation

  return {
    channelname: meta.channelname,
    conversationIDKey,
    snippetDecorated: meta.snippetDecorated,
    teamType: meta.teamType,
    timestamp: meta.timestamp,
    tlfname: meta.tlfname,
    ...(badge > 0 ? {hasBadge: true as const} : {}),
    ...(unread > 0 ? {hasUnread: true as const} : {}),
    ...(participants.name.length ? {participants: participants.name.slice(0, 3)} : {}),
  }
}

const sameConversation = (a: Conversation, b: Conversation) =>
  a.channelname === b.channelname &&
  a.conversationIDKey === b.conversationIDKey &&
  a.hasBadge === b.hasBadge &&
  a.hasUnread === b.hasUnread &&
  C.shallowEqual(a.participants ?? [], b.participants ?? []) &&
  a.snippetDecorated === b.snippetDecorated &&
  a.teamType === b.teamType &&
  a.timestamp === b.timestamp &&
  a.tlfname === b.tlfname

const sameConversationList = (a: ReadonlyArray<Conversation>, b: ReadonlyArray<Conversation>) =>
  a.length === b.length && a.every((conversation, index) => sameConversation(conversation, b[index]!))

const toNavBadges = (navBadgesMap: ReadonlyMap<string, number>) => {
  const navBadges: {[tab: string]: number} = {}
  for (const [tab, badgeCount] of navBadgesMap) {
    navBadges[tab] = badgeCount
  }
  return navBadges
}

const getWidgetConversationSnapshot = (
  widgetList: ReadonlyArray<{convID: T.Chat.ConversationIDKey}> | undefined
) => {
  if (!widgetList?.length) {
    return emptyConversations
  }

  const conversations: Array<Conversation> = []
  for (const widget of widgetList) {
    const conversation = toRemoteConversation(widget.convID, Chat.getConvoState(widget.convID))
    if (conversation) {
      conversations.push(conversation)
    }
  }
  return conversations
}

const useWidgetConversationList = (
  widgetList: ReadonlyArray<{convID: T.Chat.ConversationIDKey}> | undefined
) => {
  const snapshotRef = React.useRef(emptyConversations)

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (!widgetList?.length) {
        return () => {}
      }

      const unsubs = widgetList.map(widget => {
        Chat.getConvoState(widget.convID)
        return Chat.chatStores.get(widget.convID)?.subscribe((state, oldState) => {
          if (convoDiff(state, oldState)) {
            onStoreChange()
          }
        })
      })

      return () => {
        for (const unsub of unsubs) {
          unsub?.()
        }
      }
    },
    [widgetList]
  )

  const getSnapshot = React.useCallback(() => {
    const nextSnapshot = getWidgetConversationSnapshot(widgetList)
    if (sameConversationList(snapshotRef.current, nextSnapshot)) {
      return snapshotRef.current
    }
    snapshotRef.current = nextSnapshot
    return nextSnapshot
  }, [widgetList])

  return React.useSyncExternalStore(subscribe, getSnapshot, () => emptyConversations)
}

function useEnsureWidgetData(
  loggedIn: boolean,
  widgetList: ReadonlyArray<{convID: T.Chat.ConversationIDKey}> | undefined,
  inboxRefresh: (reason: Chat.RefreshReason) => void,
  ensureWidgetMetas: () => void
) {
  React.useEffect(() => {
    if (loggedIn && !widgetList) {
      inboxRefresh('widgetRefresh')
    }
  }, [loggedIn, widgetList, inboxRefresh])

  React.useEffect(() => {
    if (widgetList) {
      ensureWidgetMetas()
    }
  }, [widgetList, ensureWidgetMetas])
}

function useMenubarRemoteProps(): Props {
  const username = useCurrentUserState(s => s.username)
  const {httpSrv, loggedIn, outOfDate, windowShownCount} = useConfigState(
    C.useShallow(s => {
      const {httpSrv, loggedIn, outOfDate, windowShownCount} = s
      return {httpSrv, loggedIn, outOfDate, windowShownCount}
    })
  )
  const {kbfsDaemonStatus, overallSyncStatus, pathItems, sfmi, tlfUpdates, uploads} = useFSState(
    C.useShallow(s => {
      const {kbfsDaemonStatus, overallSyncStatus, pathItems, sfmi, tlfUpdates, uploads} = s
      return {kbfsDaemonStatus, overallSyncStatus, pathItems, sfmi, tlfUpdates, uploads}
    })
  )
  const navBadgesMap = useNotifState(s => s.navBadges)
  const {widgetList, inboxRefresh, ensureWidgetMetas} = Chat.useChatState(
    C.useShallow(s => ({
      ensureWidgetMetas: s.dispatch.ensureWidgetMetas,
      inboxRefresh: s.dispatch.inboxRefresh,
      widgetList: s.inboxLayout?.widgetList ?? undefined,
    }))
  )
  useEnsureWidgetData(loggedIn, widgetList, inboxRefresh, ensureWidgetMetas)
  const conversationsToSend = useWidgetConversationList(widgetList)
  const isDarkMode = useColorScheme() === 'dark'
  const {diskSpaceStatus, showingBanner} = overallSyncStatus
  const kbfsEnabled = sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled

  const remoteTlfUpdates = tlfUpdates.map(t => toRemoteTlfUpdate(t, uploads))

  // Filter some data based on visible users.
  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.
  const filePaths = [...uploads.syncingPaths].filter(
    path => FS.getPathItem(pathItems, path).type !== T.FS.PathType.Folder
  )

  const upDown = {
    endEstimate: uploads.endEstimate ?? 0,
    fileName: filePaths.length === 1 ? T.FS.getPathName(filePaths[0] || T.FS.stringToPath('')) : undefined,
    files: filePaths.length,
    totalSyncingBytes: uploads.totalSyncingBytes,
  }

  const daemonHandshakeState = useDaemonState(s => s.handshakeState)
  const followingSet = useFollowerState(s => s.following)
  const following = [...followingSet]

  return {
    ...upDown,
    conversationsToSend,
    daemonHandshakeState,
    darkMode: isDarkMode,
    diskSpaceStatus,
    following,
    httpSrvAddress: httpSrv.address,
    httpSrvToken: httpSrv.token,
    kbfsDaemonStatus,
    kbfsEnabled,
    loggedIn,
    navBadges: toNavBadges(navBadgesMap),
    outOfDate,
    remoteTlfUpdates,
    showingDiskSpaceBanner: showingBanner,
    username,
    windowShownCount: windowShownCount.get('menu') ?? 0,
  }
}

function MenubarRemoteProxy() {
  const {desktopAppBadgeCount, widgetBadge} = useNotifState(
    C.useShallow(s => {
      const {desktopAppBadgeCount, widgetBadge} = s
      return {desktopAppBadgeCount, widgetBadge}
    })
  )
  const props = useMenubarRemoteProps()

  useWidgetTray({desktopAppBadgeCount, widgetBadge})
  useSerializeProps(props, 'menubar', 'menubar')

  return null
}

export default MenubarRemoteProxy

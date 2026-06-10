// A mirror of the remote menubar windows.
import * as C from '@/constants'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {ensureWidgetMetas, useInboxMetadataState} from '@/chat/inbox/metadata'
import {useConfigState} from '@/stores/config'
import * as T from '@/constants/types'
import * as React from 'react'
import KB2 from '@/util/electron'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import type {Props, Conversation, RemoteTlfUpdates} from './index.desktop'
import {useColorScheme} from 'react-native'
import {useFsErrorActionOrThrow} from '@/fs/common/error-state'
import {useCurrentUserState} from '@/stores/current-user'
import {useFollowerState} from '@/stores/followers'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useNotifState} from '@/stores/notifications'
import type * as NotifConstants from '@/stores/notifications'
import {useFsOverallSyncStatus, useFsUploadStatus, useKbfsDaemonStatus} from '@/fs/common/status'
import {useNonFolderSyncingPaths} from '@/fs/common/use-non-folder-syncing-paths'
import {
  fuseStatusToDriverStatus,
  refreshDriverStatusDesktop as refreshDriverStatusInPlatform,
} from '@/stores/fs-platform'

const {showTray} = KB2.functions

type WidgetProps = {
  desktopAppBadgeCount: number
  widgetBadge: NotifConstants.BadgeType
}

const emptyConversations: ReadonlyArray<Conversation> = []
const emptyTlfUpdates: T.FS.UserTlfUpdates = []
type TlfUpdateState = {
  shouldClear: boolean
  tlfUpdates: T.FS.UserTlfUpdates
}

const pathFromFolderRPC = (folder: T.RPCGen.Folder): T.FS.Path => {
  const visibility = T.FS.getVisibilityFromRPCFolderType(folder.folderType)
  if (!visibility) return T.FS.stringToPath('')
  return T.FS.stringToPath(`/keybase/${visibility}/${folder.name}`)
}

const fsNotificationTypeToEditType = (fsNotificationType: T.RPCGen.FSNotificationType): T.FS.FileEditType => {
  switch (fsNotificationType) {
    case T.RPCGen.FSNotificationType.fileCreated:
      return T.FS.FileEditType.Created
    case T.RPCGen.FSNotificationType.fileModified:
      return T.FS.FileEditType.Modified
    case T.RPCGen.FSNotificationType.fileDeleted:
      return T.FS.FileEditType.Deleted
    case T.RPCGen.FSNotificationType.fileRenamed:
      return T.FS.FileEditType.Renamed
    default:
      return T.FS.FileEditType.Unknown
  }
}

const userTlfHistoryRPCToState = (
  history: ReadonlyArray<T.RPCGen.FSFolderEditHistory>
): T.FS.UserTlfUpdates =>
  history.flatMap(folder => {
    const path = pathFromFolderRPC(folder.folder)
    return (folder.history ?? []).map(({writerName, edits}) => ({
      history: edits
        ? edits.map(({filename, notificationType, serverTime}) => ({
            editType: fsNotificationTypeToEditType(notificationType),
            filename,
            serverTime,
          }))
        : [],
      path,
      serverTime: folder.serverTime,
      writer: writerName,
    }))
  })

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

const toRemoteConversation = (
  conversationIDKey: T.Chat.ConversationIDKey,
  meta: T.Chat.ConversationMeta,
  participants: T.Chat.ParticipantInfo | undefined,
  badgeState: T.RPCGen.BadgeState | undefined
): Conversation | undefined => {
  if (meta.conversationIDKey !== conversationIDKey) {
    return undefined
  }

  const badgeInfo = badgeState?.conversations?.find(
    badgeConversation => T.Chat.conversationIDToKey(badgeConversation.convID) === conversationIDKey
  )
  const badge = badgeInfo?.badgeCount ?? 0
  const unread = badgeInfo?.unreadMessages ?? 0

  return {
    channelname: meta.channelname,
    conversationIDKey,
    snippetDecorated: meta.snippetDecorated,
    teamType: meta.teamType,
    timestamp: meta.timestamp,
    tlfname: meta.tlfname,
    ...(badge > 0 ? {hasBadge: true as const} : {}),
    ...(unread > 0 ? {hasUnread: true as const} : {}),
    ...(participants?.name.length ? {participants: participants.name.slice(0, 3)} : {}),
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
  widgetList: ReadonlyArray<{convID: T.Chat.ConversationIDKey}> | undefined,
  badgeState: T.RPCGen.BadgeState | undefined
) => {
  if (!widgetList?.length) {
    return emptyConversations
  }

  const conversations: Array<Conversation> = []
  const {metas, participants} = useInboxMetadataState.getState()
  for (const widget of widgetList) {
    const meta = metas.get(widget.convID)
    if (!meta) {
      continue
    }
    const conversation = toRemoteConversation(widget.convID, meta, participants.get(widget.convID), badgeState)
    if (conversation) {
      conversations.push(conversation)
    }
  }
  return conversations
}

const useWidgetConversationList = (
  widgetList: ReadonlyArray<{convID: T.Chat.ConversationIDKey}> | undefined,
  badgeState: T.RPCGen.BadgeState | undefined
) => {
  const snapshotRef = React.useRef(emptyConversations)

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (!widgetList?.length) {
        return () => {}
      }

      return useInboxMetadataState.subscribe(() => {
        onStoreChange()
      })
    },
    [widgetList]
  )

  const getSnapshot = React.useCallback(() => {
    const nextSnapshot = getWidgetConversationSnapshot(widgetList, badgeState)
    if (sameConversationList(snapshotRef.current, nextSnapshot)) {
      return snapshotRef.current
    }
    snapshotRef.current = nextSnapshot
    return nextSnapshot
  }, [badgeState, widgetList])

  return React.useSyncExternalStore(subscribe, getSnapshot, () => emptyConversations)
}

function useEnsureWidgetData(
  loggedIn: boolean,
  inboxHasLoaded: boolean,
  widgetList: ReadonlyArray<{convID: T.Chat.ConversationIDKey}> | undefined,
  inboxRefresh: (reason: T.Chat.RefreshReason) => Promise<void>
) {
  React.useEffect(() => {
    if (loggedIn && inboxHasLoaded && !widgetList) {
      C.ignorePromise(inboxRefresh('widgetRefresh'))
    }
  }, [loggedIn, inboxHasLoaded, widgetList, inboxRefresh])

  React.useEffect(() => {
    if (widgetList) {
      ensureWidgetMetas(widgetList)
    }
  }, [widgetList])
}

const loadUserFileEditsRPC = async (
  generation: number,
  generationRef: {current: number},
  enabledRef: {current: boolean},
  setTlfUpdateState: (state: TlfUpdateState) => void,
  errorToActionOrThrow: (error: unknown) => void
) => {
  try {
    const writerEdits = await T.RPCGen.SimpleFSSimpleFSUserEditHistoryRpcPromise()
    if (generation !== generationRef.current || !enabledRef.current) {
      return
    }
    setTlfUpdateState({
      shouldClear: false,
      tlfUpdates: userTlfHistoryRPCToState(writerEdits || []),
    })
  } catch (error) {
    if (generation === generationRef.current && enabledRef.current) {
      errorToActionOrThrow(error)
    }
  }
}

function useMenubarTlfUpdates(
  loggedIn: boolean,
  userSwitching: boolean,
  kbfsDaemonRpcStatus: T.FS.KbfsDaemonRpcStatus,
  menuWindowShownCount: number
) {
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const shouldClearTlfUpdates = !loggedIn || userSwitching
  const [tlfUpdateState, setTlfUpdateState] = React.useState<TlfUpdateState>(() => ({
    shouldClear: shouldClearTlfUpdates,
    tlfUpdates: emptyTlfUpdates,
  }))
  const currentTlfUpdateState =
    tlfUpdateState.shouldClear === shouldClearTlfUpdates
      ? tlfUpdateState
      : {shouldClear: shouldClearTlfUpdates, tlfUpdates: emptyTlfUpdates}
  if (currentTlfUpdateState !== tlfUpdateState) {
    setTlfUpdateState(currentTlfUpdateState)
  }
  const generationRef = React.useRef(0)
  const enabled =
    loggedIn &&
    !userSwitching &&
    kbfsDaemonRpcStatus === T.FS.KbfsDaemonRpcStatus.Connected &&
    menuWindowShownCount > 0
  const enabledRef = React.useRef(enabled)
  React.useLayoutEffect(() => {
    enabledRef.current = enabled
  }, [enabled])
  const loadUserFileEdits = C.useThrottledCallback(() => {
    if (!enabledRef.current) {
      return
    }
    const generation = ++generationRef.current
    C.ignorePromise(
      loadUserFileEditsRPC(generation, generationRef, enabledRef, setTlfUpdateState, errorToActionOrThrow)
    )
  }, 5000)

  React.useEffect(() => {
    if (!loggedIn || userSwitching) {
      generationRef.current++
      return
    }
    if (!enabled) {
      return
    }
    loadUserFileEdits()
  }, [enabled, loadUserFileEdits, loggedIn, userSwitching])

  return currentTlfUpdateState.tlfUpdates
}

function useMenubarSfmiEnabled(
  loggedIn: boolean,
  userSwitching: boolean,
  kbfsDaemonRpcStatus: T.FS.KbfsDaemonRpcStatus,
  menuWindowShownCount: number
) {
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const disabled =
    !loggedIn ||
    userSwitching ||
    kbfsDaemonRpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected ||
    menuWindowShownCount <= 0
  const [rawEnabled, setRawEnabled] = React.useState(false)
  const enabled = disabled ? false : rawEnabled

  React.useEffect(() => {
    if (disabled) {
      return
    }

    let canceled = false
    const f = async () => {
      try {
        const status = await refreshDriverStatusInPlatform()
        if (!canceled) {
          setRawEnabled(fuseStatusToDriverStatus(status).type === T.FS.DriverStatusType.Enabled)
        }
      } catch (error) {
        if (!canceled) {
          errorToActionOrThrow(error)
        }
      }
    }
    C.ignorePromise(f())
    return () => {
      canceled = true
    }
  }, [errorToActionOrThrow, loggedIn, userSwitching, kbfsDaemonRpcStatus, menuWindowShownCount, disabled])

  return enabled
}

function useMenubarRemoteProps(): Props {
  const username = useCurrentUserState(s => s.username)
  const {badgeState, httpSrv, loggedIn, outOfDate, userSwitching, windowShownCount} = useConfigState(
    C.useShallow(s => {
      const {badgeState, httpSrv, loggedIn, outOfDate, userSwitching, windowShownCount} = s
      return {badgeState, httpSrv, loggedIn, outOfDate, userSwitching, windowShownCount}
    })
  )
  const kbfsDaemonStatus = useKbfsDaemonStatus()
  const overallSyncStatus = useFsOverallSyncStatus()
  const uploads = useFsUploadStatus()
  const navBadgesMap = useNotifState(s => s.navBadges)
  const {widgetList, inboxHasLoaded, inboxRefresh} = useInboxLayoutState(
    C.useShallow(s => ({
      inboxHasLoaded: s.hasLoaded,
      inboxRefresh: s.dispatch.refresh,
      widgetList: s.layout?.widgetList ?? undefined,
    }))
  )
  useEnsureWidgetData(loggedIn, inboxHasLoaded, widgetList, inboxRefresh)
  const conversationsToSend = useWidgetConversationList(widgetList, badgeState)
  const isDarkMode = useColorScheme() === 'dark'
  const {diskSpaceStatus, showingBanner} = overallSyncStatus
  const menuWindowShownCount = windowShownCount.get('menu') ?? 0
  const kbfsEnabled = useMenubarSfmiEnabled(
    loggedIn,
    userSwitching,
    kbfsDaemonStatus.rpcStatus,
    menuWindowShownCount
  )
  const tlfUpdates = useMenubarTlfUpdates(
    loggedIn,
    userSwitching,
    kbfsDaemonStatus.rpcStatus,
    menuWindowShownCount
  )

  const remoteTlfUpdates = tlfUpdates.map(t => toRemoteTlfUpdate(t, uploads))

  // Filter some data based on visible users.
  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.
  const filePaths = useNonFolderSyncingPaths(uploads.syncingPaths)

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

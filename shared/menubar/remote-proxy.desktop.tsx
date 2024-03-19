// A mirror of the remote menubar windows.
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import KB2 from '@/util/electron.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {intersect} from '@/util/set'
import {mapFilterByKey} from '@/util/map'
import {serialize, type ProxyProps, type RemoteTlfUpdates} from './remote-serializer.desktop'
import {useAvatarState} from '@/common-adapters/avatar-zus'
import shallowEqual from 'shallowequal'
import type * as NotifConstants from '@/constants/notifications'

const {showTray} = KB2.functions

type WidgetProps = {
  desktopAppBadgeCount: number
  widgetBadge: NotifConstants.BadgeType
}

function useWidgetBrowserWindow(p: WidgetProps) {
  const {widgetBadge, desktopAppBadgeCount} = p
  const systemDarkMode = C.useDarkModeState(s => s.systemDarkMode)
  React.useEffect(() => {
    showTray?.(desktopAppBadgeCount, widgetBadge)
  }, [widgetBadge, desktopAppBadgeCount, systemDarkMode])
}

const Widget = (p: ProxyProps & WidgetProps) => {
  const windowComponent = 'menubar'
  const windowParam = 'menubar'

  const {desktopAppBadgeCount, widgetBadge, ...toSend} = p
  useWidgetBrowserWindow({desktopAppBadgeCount, widgetBadge})
  useSerializeProps(toSend, serialize, windowComponent, windowParam)
  return null
}

const GetRowsFromTlfUpdate = (t: T.FS.TlfUpdate, uploads: T.FS.Uploads): RemoteTlfUpdates => ({
  timestamp: t.serverTime,
  tlf: t.path,
  updates: t.history.map(u => {
    const path = T.FS.stringToPath(u.filename)
    return {path, uploading: uploads.syncingPaths.has(path) || uploads.writingToJournal.has(path)}
  }),
  writer: t.writer,
})

const convoDiff = (a: C.Chat.ConvoState, b: C.Chat.ConvoState) => {
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

// TODO could make this render less
const MenubarRemoteProxy = React.memo(function MenubarRemoteProxy() {
  const following = C.useFollowerState(s => s.following)
  const followers = C.useFollowerState(s => s.followers)
  const username = C.useCurrentUserState(s => s.username)
  const httpSrv = C.useConfigState(s => s.httpSrv)
  const windowShownCount = C.useConfigState(s => s.windowShownCount)
  const outOfDate = C.useConfigState(s => s.outOfDate)
  const loggedIn = C.useConfigState(s => s.loggedIn)
  const kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const overallSyncStatus = C.useFSState(s => s.overallSyncStatus)
  const pathItems = C.useFSState(s => s.pathItems)
  const sfmi = C.useFSState(s => s.sfmi)
  const tlfUpdates = C.useFSState(s => s.tlfUpdates)
  const uploads = C.useFSState(s => s.uploads)
  const {desktopAppBadgeCount, navBadges, widgetBadge} = C.useNotifState(
    C.useShallow(s => {
      const {desktopAppBadgeCount, navBadges, widgetBadge} = s
      return {desktopAppBadgeCount, navBadges, widgetBadge}
    })
  )
  const infoMap = C.useUsersState(s => s.infoMap)
  const widgetList = C.useChatState(s => s.inboxLayout?.widgetList)
  const darkMode = Kb.Styles.isDarkMode()
  const {diskSpaceStatus, showingBanner} = overallSyncStatus
  const kbfsEnabled = sfmi.driverStatus.type === 'enabled'

  const remoteTlfUpdates = React.useMemo(
    () => tlfUpdates.map(t => GetRowsFromTlfUpdate(t, uploads)),
    [tlfUpdates, uploads]
  )

  // could handle this in a different way later but here we need to subscribe to all the convoStates
  // normally we'd have a list and these would all subscribe within the component but this proxy isn't
  // setup that way so instead we manually subscribe to all the substores and increment when a meta
  // changes inside
  const [remakeChat, setRemakeChat] = React.useState(0)
  React.useEffect(() => {
    const unsubs = widgetList?.map(v => {
      return C.chatStores.get(v.convID)?.subscribe((s, old) => {
        if (convoDiff(s, old)) {
          setRemakeChat(c => c + 1)
        }
      })
    })

    return () => {
      for (const unsub of unsubs ?? []) {
        unsub?.()
      }
    }
  }, [widgetList])

  const conversationsToSend = React.useMemo(
    () =>
      widgetList?.map(v => {
        remakeChat // implied dependency
        const {badge, unread, participants, meta} = C.getConvoState(v.convID)
        const c = meta
        return {
          channelname: c.channelname,
          conversationIDKey: v.convID,
          snippetDecorated: c.snippetDecorated,
          teamType: c.teamType,
          timestamp: c.timestamp,
          tlfname: c.tlfname,
          ...(badge > 0 ? {hasBadge: true as const} : {}),
          ...(unread > 0 ? {hasUnread: true as const} : {}),
          ...(participants.name.length ? {participants: participants.name.slice(0, 3)} : {}),
        }
      }) ?? [],
    [widgetList, remakeChat]
  )

  // filter some data based on visible users
  const _usernames = new Set<string>()
  tlfUpdates.forEach(update => _usernames.add(update.writer))
  conversationsToSend.forEach(c => {
    if (c.teamType === 'adhoc') {
      c.participants?.forEach(p => _usernames.add(p))
    } else {
      c.tlfname && _usernames.add(c.tlfname)
    }
  })

  // memoize so useMemos work below
  const usernamesRef = React.useRef(_usernames)
  if (!shallowEqual(Array.from(usernamesRef.current), Array.from(_usernames))) {
    usernamesRef.current = _usernames
  }
  const usernames = usernamesRef.current

  const avatarRefreshCounter = useAvatarState(s => s.counts)

  const avatarRefreshCounterFiltered = React.useMemo(
    () => mapFilterByKey(avatarRefreshCounter, usernames),
    [avatarRefreshCounter, usernames]
  )
  const followersFiltered = React.useMemo(() => intersect(followers, usernames), [followers, usernames])
  const followingFiltered = React.useMemo(() => intersect(following, usernames), [following, usernames])
  const infoMapFiltered = React.useMemo(() => mapFilterByKey(infoMap, usernames), [infoMap, usernames])

  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.

  // Filter out folder paths.
  const filePaths = [...uploads.syncingPaths].filter(
    path => C.FS.getPathItem(pathItems, path).type !== T.FS.PathType.Folder
  )

  const upDown = {
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    endEstimate: uploads.endEstimate ?? 0,
    filename: T.FS.getPathName(filePaths[1] || T.FS.stringToPath('')),
    files: filePaths.length,
    totalSyncingBytes: uploads.totalSyncingBytes,
  }

  const daemonHandshakeState = C.useDaemonState(s => s.handshakeState)

  const p: ProxyProps & WidgetProps = {
    ...upDown,
    avatarRefreshCounter: avatarRefreshCounterFiltered,
    conversationsToSend,
    daemonHandshakeState,
    darkMode,
    desktopAppBadgeCount,
    diskSpaceStatus,
    followers: followersFiltered,
    following: followingFiltered,
    httpSrvAddress: httpSrv.address,
    httpSrvToken: httpSrv.token,
    infoMap: infoMapFiltered,
    kbfsDaemonStatus,
    kbfsEnabled,
    loggedIn,
    navBadges,
    outOfDate,
    remoteTlfUpdates,
    showingDiskSpaceBanner: showingBanner,
    username,
    widgetBadge,
    windowShownCountNum: windowShownCount.get('menu') ?? 0,
  }

  return <Widget {...p} />
})

export default MenubarRemoteProxy

// A mirror of the remote menubar windows.
import * as C from '../constants'
import * as ConfigConstants from '../constants/config'
import * as ChatConstants from '../constants/chat2'
import * as FSTypes from '../constants/types/fs'
import * as React from 'react'
import * as Styles from '../styles'
import KB2 from '../util/electron.desktop'
import _getIcons from './icons'
import shallowEqual from 'shallowequal'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {intersect} from '../util/set'
import {mapFilterByKey} from '../util/map'
import {memoize} from '../util/memoize'
import {serialize, type ProxyProps, type RemoteTlfUpdates} from './remote-serializer.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'
import type * as NotifConstants from '../constants/notifications'

const {showTray} = KB2.functions

const getIcons = (iconType: NotifConstants.BadgeType, isBadged: boolean) => {
  return _getIcons(iconType, isBadged, C.useDarkModeState.getState().systemDarkMode)
}

type WidgetProps = {
  desktopAppBadgeCount: number
  widgetBadge: NotifConstants.BadgeType
}

function useWidgetBrowserWindow(p: WidgetProps) {
  const {widgetBadge, desktopAppBadgeCount} = p
  const systemDarkMode = C.useDarkModeState(s => s.systemDarkMode)
  React.useEffect(() => {
    const icon = getIcons(widgetBadge, desktopAppBadgeCount > 0)
    showTray?.(desktopAppBadgeCount, icon)
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

const GetRowsFromTlfUpdate = (t: FSTypes.TlfUpdate, uploads: FSTypes.Uploads): RemoteTlfUpdates => ({
  timestamp: t.serverTime,
  tlf: t.path,
  updates: t.history.map(u => {
    const path = FSTypes.stringToPath(u.filename)
    return {path, uploading: uploads.syncingPaths.has(path) || uploads.writingToJournal.has(path)}
  }),
  writer: t.writer,
})

const getCachedUsernames = memoize(
  (users: Array<string>) => new Set(users),
  ([a], [b]) => shallowEqual(a, b)
)

const convoDiff = (a: ChatConstants.ConvoState, b: ChatConstants.ConvoState) => {
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
    !shallowEqual(a.participants.name, b.participants.name)
  ) {
    return true
  }

  return false
}

// TODO could make this render less
const RemoteProxy = React.memo(function MenubarRemoteProxy() {
  const following = C.useFollowerState(s => s.following)
  const followers = C.useFollowerState(s => s.followers)
  const username = C.useCurrentUserState(s => s.username)
  const httpSrv = ConfigConstants.useConfigState(s => s.httpSrv)
  const windowShownCount = ConfigConstants.useConfigState(s => s.windowShownCount)
  const outOfDate = ConfigConstants.useConfigState(s => s.outOfDate)
  const loggedIn = ConfigConstants.useConfigState(s => s.loggedIn)
  const kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const overallSyncStatus = C.useFSState(s => s.overallSyncStatus)
  const pathItems = C.useFSState(s => s.pathItems)
  const sfmi = C.useFSState(s => s.sfmi)
  const tlfUpdates = C.useFSState(s => s.tlfUpdates)
  const uploads = C.useFSState(s => s.uploads)
  const {desktopAppBadgeCount, navBadges, widgetBadge} = C.useNotifState(s => {
    const {desktopAppBadgeCount, navBadges, widgetBadge} = s
    return {desktopAppBadgeCount, navBadges, widgetBadge}
  }, shallowEqual)
  const infoMap = C.useUsersState(s => s.infoMap)
  const widgetList = C.useChatState(s => s.inboxLayout?.widgetList)
  const darkMode = Styles.isDarkMode()
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
  const usernamesArr: Array<string> = []
  tlfUpdates.forEach(update => usernamesArr.push(update.writer))
  conversationsToSend.forEach(c => {
    if (c.teamType === 'adhoc') {
      c.participants && usernamesArr.push(...c.participants)
    } else {
      c.tlfname && usernamesArr.push(c.tlfname)
    }
  })

  // memoize so useMemos work below
  const usernames = getCachedUsernames(usernamesArr)

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
    path => C.getPathItem(pathItems, path).type !== FSTypes.PathType.Folder
  )

  const upDown = {
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    endEstimate: uploads.endEstimate ?? 0,
    filename: FSTypes.getPathName(filePaths[1] || FSTypes.stringToPath('')),
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

export default RemoteProxy

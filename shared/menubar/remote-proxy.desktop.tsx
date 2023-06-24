// A mirror of the remote menubar windows.
import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'
import * as DarkMode from '../constants/darkmode'
import * as FSConstants from '../constants/fs'
import * as FSTypes from '../constants/types/fs'
import * as Followers from '../constants/followers'
import * as React from 'react'
import * as Styles from '../styles'
import KB2 from '../util/electron.desktop'
import _getIcons from './icons'
import shallowEqual from 'shallowequal'
import type * as NotificationTypes from '../constants/types/notifications'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {intersect} from '../util/set'
import {mapFilterByKey} from '../util/map'
import {memoize} from '../util/memoize'
import {serialize, type ProxyProps, type RemoteTlfUpdates} from './remote-serializer.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'

const {showTray} = KB2.functions

const getIcons = (iconType: NotificationTypes.BadgeType, isBadged: boolean) => {
  return _getIcons(iconType, isBadged, DarkMode.useDarkModeState.getState().systemDarkMode)
}

type WidgetProps = {
  desktopAppBadgeCount: number
  widgetBadge: NotificationTypes.BadgeType
}

function useWidgetBrowserWindow(p: WidgetProps) {
  const {widgetBadge, desktopAppBadgeCount} = p
  const systemDarkMode = DarkMode.useDarkModeState(s => s.systemDarkMode)
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

// TODO could make this render less
const RemoteProxy = React.memo(function MenubarRemoteProxy() {
  const following = Followers.useFollowerState(s => s.following)
  const followers = Followers.useFollowerState(s => s.followers)
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const httpSrv = ConfigConstants.useConfigState(s => s.httpSrv)
  const windowShownCount = ConfigConstants.useConfigState(s => s.windowShownCount)
  const outOfDate = ConfigConstants.useConfigState(s => s.outOfDate)
  const loggedIn = ConfigConstants.useConfigState(s => s.loggedIn)
  const kbfsDaemonStatus = FSConstants.useState(s => s.kbfsDaemonStatus)
  const overallSyncStatus = FSConstants.useState(s => s.overallSyncStatus)
  const s = Container.useSelector(state => {
    const {notifications, fs, chat2, users} = state
    const {desktopAppBadgeCount, navBadges, widgetBadge} = notifications
    const {pathItems, tlfUpdates, uploads, sfmi} = fs
    const {inboxLayout, metaMap, badgeMap, unreadMap, participantMap} = chat2
    const widgetList = inboxLayout?.widgetList
    const {infoMap} = users

    return {
      badgeMap,
      desktopAppBadgeCount,
      infoMap,
      metaMap,
      navBadges,
      participantMap,
      pathItems,
      sfmi,
      tlfUpdates,
      unreadMap,
      uploads,
      widgetBadge,
      widgetList,
    }
  }, shallowEqual)

  const {sfmi, tlfUpdates, unreadMap, uploads, badgeMap, desktopAppBadgeCount} = s
  const {widgetList, widgetBadge, infoMap, metaMap} = s
  const {navBadges, participantMap, pathItems} = s

  const darkMode = Styles.isDarkMode()
  const {diskSpaceStatus, showingBanner} = overallSyncStatus
  const kbfsEnabled = sfmi.driverStatus.type === 'enabled'

  const remoteTlfUpdates = React.useMemo(
    () => tlfUpdates.map(t => GetRowsFromTlfUpdate(t, uploads)),
    [tlfUpdates, uploads]
  )

  const conversationsToSend = React.useMemo(
    () =>
      widgetList?.map(v => {
        const c = metaMap.get(v.convID)

        let participants = participantMap.get(v.convID)?.name ?? []
        participants = participants.slice(0, 3)

        return {
          channelname: c?.channelname,
          conversationIDKey: v.convID,
          snippetDecorated: c?.snippetDecorated,
          teamType: c?.teamType,
          timestamp: c?.timestamp,
          tlfname: c?.tlfname,
          ...(badgeMap.get(v.convID) ? {hasBadge: true as const} : {}),
          ...(unreadMap.get(v.convID) ? {hasUnread: true as const} : {}),
          ...(participants.length ? {participants} : {}),
        }
      }) ?? [],
    [widgetList, metaMap, badgeMap, unreadMap, participantMap]
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
    path => FSConstants.getPathItem(pathItems, path).type !== FSTypes.PathType.Folder
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

  const daemonHandshakeState = ConfigConstants.useDaemonState(s => s.handshakeState)

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

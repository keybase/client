// A mirror of the remote menubar windows.
import * as FSConstants from '../constants/fs'
import type * as NotificationTypes from '../constants/types/notifications'
import * as FSTypes from '../constants/types/fs'
import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import {intersect} from '../util/set'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize, type ProxyProps, type RemoteTlfUpdates} from './remote-serializer.desktop'
import {isSystemDarkMode} from '../styles/dark-mode'
import {mapFilterByKey} from '../util/map'
import {memoize} from '../util/memoize'
import shallowEqual from 'shallowequal'
import _getIcons from './icons'
import KB2 from '../util/electron.desktop'

const {showTray} = KB2.functions

const getIcons = (iconType: NotificationTypes.BadgeType, isBadged: boolean) => {
  return _getIcons(iconType, isBadged, isSystemDarkMode())
}

type WidgetProps = {
  desktopAppBadgeCount: number
  widgetBadge: NotificationTypes.BadgeType
}

function useWidgetBrowserWindow(p: WidgetProps) {
  const {widgetBadge, desktopAppBadgeCount} = p

  const systemDarkMode = Container.useSelector(state => state.config.systemDarkMode)

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
  const s = Container.useSelector(state => {
    const {notifications, config, fs, chat2, users} = state
    const {desktopAppBadgeCount, navBadges, widgetBadge} = notifications
    const {httpSrvToken, httpSrvAddress, windowShownCount, username, following} = config
    const {outOfDate, loggedIn, daemonHandshakeState, avatarRefreshCounter, followers} = config
    const {pathItems, tlfUpdates, uploads, overallSyncStatus, kbfsDaemonStatus, sfmi} = fs
    const {inboxLayout, metaMap, badgeMap, unreadMap, participantMap} = chat2
    const widgetList = inboxLayout?.widgetList
    const {infoMap} = users

    return {
      avatarRefreshCounter,
      badgeMap,
      daemonHandshakeState,
      desktopAppBadgeCount,
      followers,
      following,
      httpSrvAddress,
      httpSrvToken,
      infoMap,
      kbfsDaemonStatus,
      loggedIn,
      metaMap,
      navBadges,
      outOfDate,
      overallSyncStatus,
      participantMap,
      pathItems,
      sfmi,
      tlfUpdates,
      unreadMap,
      uploads,
      username,
      widgetBadge,
      widgetList,
      windowShownCount,
    }
  }, shallowEqual)

  const {avatarRefreshCounter, badgeMap, daemonHandshakeState, desktopAppBadgeCount, followers, following} = s
  const {httpSrvAddress, httpSrvToken, infoMap, kbfsDaemonStatus, loggedIn, metaMap} = s
  const {navBadges, outOfDate, overallSyncStatus, participantMap, pathItems} = s
  const {sfmi, tlfUpdates, unreadMap, uploads, username} = s
  const {widgetBadge, widgetList, windowShownCount} = s

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
  conversationsToSend.forEach(c => usernamesArr.push(...(c.participants ?? [])))

  // memoize so useMemos work below
  const usernames = getCachedUsernames(usernamesArr)

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
    httpSrvAddress,
    httpSrvToken,
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
    windowShownCount,
  }

  return <Widget {...p} />
})

export default RemoteProxy

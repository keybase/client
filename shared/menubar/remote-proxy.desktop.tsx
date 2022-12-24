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
  const notifications = Container.useSelector(s => s.notifications)
  const {desktopAppBadgeCount, navBadges, widgetBadge} = notifications

  const daemonHandshakeState = Container.useSelector(s => s.config.daemonHandshakeState)
  const loggedIn = Container.useSelector(s => s.config.loggedIn)
  const outOfDate = Container.useSelector(s => s.config.outOfDate)
  const username = Container.useSelector(s => s.config.username)
  const windowShownCount = Container.useSelector(s => s.config.windowShownCount)
  const httpSrvAddress = Container.useSelector(s => s.config.httpSrvAddress)
  const httpSrvToken = Container.useSelector(s => s.config.httpSrvToken)

  const _arc = Container.useSelector(s => s.config.avatarRefreshCounter)
  const _followers = Container.useSelector(s => s.config.followers)
  const _following = Container.useSelector(s => s.config.following)

  const pathItems = Container.useSelector(s => s.fs.pathItems)
  const tlfUpdates = Container.useSelector(s => s.fs.tlfUpdates)
  const uploads = Container.useSelector(s => s.fs.uploads)
  const overallSyncStatus = Container.useSelector(s => s.fs.overallSyncStatus)
  const kbfsDaemonStatus = Container.useSelector(s => s.fs.kbfsDaemonStatus)
  const sfmi = Container.useSelector(s => s.fs.sfmi)

  const widgetList = Container.useSelector(s => s.chat2.inboxLayout?.widgetList)
  const metaMap = Container.useSelector(s => s.chat2.metaMap)
  const badgeMap = Container.useSelector(s => s.chat2.badgeMap)
  const unreadMap = Container.useSelector(s => s.chat2.unreadMap)
  const participantMap = Container.useSelector(s => s.chat2.participantMap)

  const darkMode = Styles.isDarkMode()
  const {diskSpaceStatus, showingBanner} = overallSyncStatus
  const kbfsEnabled = sfmi.driverStatus.type === 'enabled'

  const _infoMap = Container.useSelector(s => s.users.infoMap)

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

  const avatarRefreshCounter = React.useMemo(() => mapFilterByKey(_arc, usernames), [_arc, usernames])
  const followers = React.useMemo(() => intersect(_followers, usernames), [_followers, usernames])
  const following = React.useMemo(() => intersect(_following, usernames), [_following, usernames])
  const infoMap = React.useMemo(() => mapFilterByKey(_infoMap, usernames), [_infoMap, usernames])

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
    ...(uploads.endEstimate ? {endEstimate: uploads.endEstimate} : {}),
    ...(filePaths.length === 1
      ? {filename: FSTypes.getPathName(filePaths[1] || FSTypes.stringToPath(''))}
      : {}),
    ...(filePaths.length ? {files: filePaths.length} : {}),
    ...(uploads.totalSyncingBytes ? {totalSyncingBytes: uploads.totalSyncingBytes} : {}),
  }

  const p: ProxyProps & WidgetProps = {
    ...upDown,
    avatarRefreshCounter,
    conversationsToSend,
    daemonHandshakeState,
    ...(darkMode ? {darkMode} : {}),
    desktopAppBadgeCount,
    diskSpaceStatus,
    followers,
    following,
    httpSrvAddress,
    httpSrvToken,
    infoMap,
    kbfsDaemonStatus,
    kbfsEnabled,
    loggedIn,
    navBadges,
    outOfDate,
    remoteTlfUpdates,
    ...(showingBanner ? {showingDiskSpaceBanner: true} : {}),
    username,
    widgetBadge,
    windowShownCount,
  }

  return <Widget {...p} />
})

export default RemoteProxy

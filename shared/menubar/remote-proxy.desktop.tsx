// A mirror of the remote menubar windows.
import * as ChatConstants from '../constants/chat2'
import type * as NotificationTypes from '../constants/types/notifications'
import * as FSTypes from '../constants/types/fs'
import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import {intersect} from '../util/set'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize, type ProxyProps, type RemoteTlfUpdates} from './remote-serializer.desktop'
import {isSystemDarkMode} from '../styles/dark-mode'
import {uploadsToUploadCountdownHOCProps} from '../fs/footer/upload-container'
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

const RemoteProxy = () => {
  const notifications = Container.useSelector(s => s.notifications)
  const {desktopAppBadgeCount, navBadges, widgetBadge} = notifications

  const config = Container.useSelector(s => s.config)
  const {daemonHandshakeState, loggedIn, outOfDate, username, windowShownCount} = config
  const {httpSrvAddress, httpSrvToken} = config
  const {avatarRefreshCounter: _arc, followers: _followers, following: _following} = config

  const fs = Container.useSelector(s => s.fs)
  const {pathItems, tlfUpdates, uploads, overallSyncStatus, kbfsDaemonStatus, sfmi} = fs

  const chat2 = Container.useSelector(s => s.chat2)
  const {inboxLayout, metaMap, badgeMap, unreadMap, participantMap} = chat2

  const darkMode = Styles.isDarkMode()
  const {diskSpaceStatus, showingBanner} = overallSyncStatus
  const kbfsEnabled = sfmi.driverStatus.type === 'enabled'

  const users = Container.useSelector(s => s.users)
  const {infoMap: _infoMap} = users

  const remoteTlfUpdates = React.useMemo(
    () => tlfUpdates.map(t => GetRowsFromTlfUpdate(t, uploads)),
    [tlfUpdates, uploads]
  )

  const conversationsToSend = React.useMemo(
    () =>
      inboxLayout?.widgetList?.map(v => ({
        conversation: metaMap.get(v.convID) || {
          ...ChatConstants.makeConversationMeta(),
          conversationIDKey: v.convID,
        },
        hasBadge: !!badgeMap.get(v.convID),
        hasUnread: !!unreadMap.get(v.convID),
        participantInfo: participantMap.get(v.convID) ?? ChatConstants.noParticipantInfo,
      })) ?? [],
    [inboxLayout, metaMap, badgeMap, unreadMap, participantMap]
  )

  // filter some data based on visible users
  const usernamesArr: Array<string> = []
  tlfUpdates.forEach(update => usernamesArr.push(update.writer))
  conversationsToSend.forEach(c => {
    if (c.conversation.teamType === 'adhoc') {
      usernamesArr.push(...c.participantInfo.all)
    }
  })

  // memoize so useMemos work below
  const usernames = getCachedUsernames(usernamesArr)

  const avatarRefreshCounter = React.useMemo(() => mapFilterByKey(_arc, usernames), [_arc, usernames])
  const followers = React.useMemo(() => intersect(_followers, usernames), [_followers, usernames])
  const following = React.useMemo(() => intersect(_following, usernames), [_following, usernames])
  const infoMap = React.useMemo(() => mapFilterByKey(_infoMap, usernames), [_infoMap, usernames])

  const p: ProxyProps & WidgetProps = {
    ...uploadsToUploadCountdownHOCProps(pathItems, uploads),
    avatarRefreshCounter,
    conversationsToSend,
    daemonHandshakeState,
    darkMode,
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
    showingDiskSpaceBanner: showingBanner,
    username,
    widgetBadge,
    windowShownCount,
  }

  return <Widget {...p} />
}
export default RemoteProxy

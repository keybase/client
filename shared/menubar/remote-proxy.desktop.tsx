// A mirror of the remote menubar windows.
import * as ChatConstants from '../constants/chat2'
import * as NotificationTypes from '../constants/types/notifications'
import * as FSTypes from '../constants/types/fs'
import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import * as SafeElectron from '../util/safe-electron.desktop'
import {intersect} from '../util/set'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize} from './remote-serializer.desktop'
import {getMainWindow} from '../desktop/remote/util.desktop'
import {resolveImage} from '../desktop/app/resolve-root.desktop'
import {isDarwin, isWindows} from '../constants/platform'
import {isSystemDarkMode} from '../styles/dark-mode'
import {uploadsToUploadCountdownHOCProps} from '../fs/footer/upload-container'
import {ProxyProps, RemoteTlfUpdates} from './remote-serializer.desktop'
import {mapFilterByKey} from '../util/map'
import {memoize} from '../util/memoize'
import shallowEqual from 'shallowequal'

const getIcons = (iconType: NotificationTypes.BadgeType, isBadged: boolean) => {
  const devMode = __DEV__ ? '-dev' : ''
  let color = 'white'
  const colorSelected = 'white'
  const badged = isBadged ? 'badged-' : ''
  let platform = ''

  if (isDarwin) {
    color = isSystemDarkMode() ? 'white' : 'black'
  } else if (isWindows) {
    color = 'black'
    platform = 'windows-'
  }

  const size = isWindows ? 16 : 22
  const icon = `icon-${platform}keybase-menubar-${badged}${iconType}-${color}-${size}${devMode}@2x.png`
  // Only used on Darwin
  const iconSelected = `icon-${platform}keybase-menubar-${iconType}-${colorSelected}-${size}${devMode}@2x.png`
  return [icon, iconSelected]
}

type WidgetProps = {
  desktopAppBadgeCount: number
  widgetBadge: NotificationTypes.BadgeType
}

function useDarkSubscription() {
  const [count, setCount] = React.useState(-1)
  React.useEffect(() => {
    if (isDarwin) {
      const subscriptionId = SafeElectron.getSystemPreferences().subscribeNotification(
        'AppleInterfaceThemeChangedNotification',
        () => {
          setCount(count + 1)
        }
      )
      return () => {
        if (subscriptionId && SafeElectron.getSystemPreferences().unsubscribeNotification) {
          SafeElectron.getSystemPreferences().unsubscribeNotification(subscriptionId || -1)
        }
      }
    } else {
      return undefined
    }
    // eslint-disable-next-line
  }, [])
  return count
}

function useUpdateBadges(p: WidgetProps, darkCount: number) {
  const {widgetBadge, desktopAppBadgeCount} = p

  React.useEffect(() => {
    const [icon, iconSelected] = getIcons(widgetBadge, desktopAppBadgeCount > 0)
    SafeElectron.getApp().emit('KBmenu', '', {
      payload: {desktopAppBadgeCount, icon, iconSelected},
      type: 'showTray',
    })
    // Windows just lets us set (or unset, with null) a single 16x16 icon
    // to be used as an overlay in the bottom right of the taskbar icon.
    if (isWindows) {
      const mw = getMainWindow()
      const overlay = desktopAppBadgeCount > 0 ? resolveImage('icons', 'icon-windows-badge.png') : null
      // @ts-ignore setOverlayIcon docs say null overlay's fine, TS disagrees
      mw && mw.setOverlayIcon(overlay, 'new activity')
    }
  }, [widgetBadge, desktopAppBadgeCount, darkCount])
}

function useWidgetBrowserWindow(p: WidgetProps) {
  const count = useDarkSubscription()
  useUpdateBadges(p, count)
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

export default () => {
  const state = Container.useSelector(s => s)
  const {desktopAppBadgeCount, navBadges, widgetBadge} = state.notifications
  const {daemonHandshakeState, loggedIn, outOfDate, username} = state.config
  const {httpSrvAddress, httpSrvToken} = state.config
  const {avatarRefreshCounter: _arc, followers: _followers, following: _following} = state.config
  const {pathItems, tlfUpdates, uploads, overallSyncStatus, kbfsDaemonStatus, sfmi} = state.fs
  const {inboxLayout, metaMap, badgeMap, unreadMap, participantMap} = state.chat2
  const {infoMap: _infoMap} = state.users
  const darkMode = Styles.isDarkMode()
  const {diskSpaceStatus, showingBanner} = overallSyncStatus
  const kbfsEnabled = sfmi.driverStatus.type === 'enabled'

  const remoteTlfUpdates = React.useMemo(() => tlfUpdates.map(t => GetRowsFromTlfUpdate(t, uploads)), [
    tlfUpdates,
    uploads,
  ])

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
  }

  return <Widget {...p} />
}

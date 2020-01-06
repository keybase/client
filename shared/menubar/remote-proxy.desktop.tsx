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
import {Props, RemoteTlfUpdates} from './remote-serializer.desktop'
import {mapFilterByKey} from '../util/map'

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

const Widget = (p: Props & WidgetProps) => {
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

export default () => {
  const state = Container.useSelector(s => s)
  const {desktopAppBadgeCount, navBadges, widgetBadge} = state.notifications
  const {daemonHandshakeState, loggedIn, outOfDate, username} = state.config
  const {avatarRefreshCounter, httpSrvAddress, httpSrvToken, followers, following} = state.config
  const {pathItems, tlfUpdates, uploads, overallSyncStatus, kbfsDaemonStatus, sfmi} = state.fs
  const {inboxLayout, metaMap, badgeMap, unreadMap, participantMap} = state.chat2
  const {infoMap} = state.users

  // only users we care about
  const usernames = new Set<string>()
  tlfUpdates.forEach(update => usernames.add(update.writer))

  const conversationsToSend =
    inboxLayout?.widgetList?.map(v => {
      const participantInfo = participantMap.get(v.convID) ?? ChatConstants.noParticipantInfo

      if (!v.isTeam) {
        participantInfo.all.forEach(u => usernames.add(u))
      }

      return {
        conversation: metaMap.get(v.convID) || {
          ...ChatConstants.makeConversationMeta(),
          conversationIDKey: v.convID,
        },
        hasBadge: !!badgeMap.get(v.convID),
        hasUnread: !!unreadMap.get(v.convID),
        participantInfo,
      }
    }) ?? []

  const darkMode = Styles.isDarkMode()
  const diskSpaceStatus = overallSyncStatus.diskSpaceStatus
  const showingDiskSpaceBanner = overallSyncStatus.showingBanner
  const kbfsEnabled = sfmi.driverStatus.type === 'enabled'

  const remoteTlfUpdates = tlfUpdates.map(t => GetRowsFromTlfUpdate(t, uploads))
  // TODO filter based on users names here?

  const p: Props & WidgetProps = {
    ...uploadsToUploadCountdownHOCProps(pathItems, uploads),
    avatarRefreshCounter: mapFilterByKey(avatarRefreshCounter, usernames),
    conversationsToSend,
    daemonHandshakeState,
    darkMode,
    desktopAppBadgeCount,
    diskSpaceStatus,
    followers: intersect(followers, usernames),
    following: intersect(following, usernames),
    httpSrvAddress,
    httpSrvToken,
    infoMap: mapFilterByKey(infoMap, usernames),
    kbfsDaemonStatus,
    kbfsEnabled,
    loggedIn,
    navBadges,
    outOfDate,
    remoteTlfUpdates,
    showingDiskSpaceBanner,
    username,
    widgetBadge,
  }

  return <Widget {...p} />
}

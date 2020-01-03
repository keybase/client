// A mirror of the remote menubar windows.
import * as ConfigTypes from '../constants/types/config'
import * as ChatConstants from '../constants/chat2'
import * as ChatTypes from '../constants/types/chat2'
import * as NotificationTypes from '../constants/types/notifications'
import * as FSTypes from '../constants/types/fs'
import * as UsersTypes from '../constants/types/users'
import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import * as SafeElectron from '../util/safe-electron.desktop'
// TODO
// import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize} from './remote-serializer.desktop'
import {getMainWindow} from '../desktop/remote/util.desktop'
import {resolveImage} from '../desktop/app/resolve-root.desktop'
import {isDarwin, isWindows} from '../constants/platform'
import {isSystemDarkMode} from '../styles/dark-mode'
import {uploadsToUploadCountdownHOCProps} from '../fs/footer/upload-container'

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

// Like RemoteWindow but the browserWindow is handled by the 3rd party menubar class and mostly lets it handle things
// function RemoteMenubarWindow(ComposedComponent: any) {
// class RemoteWindowComponent extends React.PureComponent<Props> {
// subscriptionId: number | null = null
// _updateBadges = () => {
// }

// componentDidUpdate(prevProps: Props) {
// if (
// this.props.widgetBadge !== prevProps.widgetBadge ||
// this.props.desktopAppBadgeCount !== prevProps.desktopAppBadgeCount ||
// this.props.remoteWindowNeedsProps !== prevProps.remoteWindowNeedsProps
// ) {
// this._updateBadges()
// }
// }

// componentDidMount() {
// this._updateBadges()

// if (isDarwin && SafeElectron.getSystemPreferences().subscribeNotification) {
// this.subscriptionId = SafeElectron.getSystemPreferences().subscribeNotification(
// 'AppleInterfaceThemeChangedNotification',
// () => {
// this._updateBadges()
// }
// )
// }
// }
// componentWillUnmount() {
// if (this.subscriptionId && SafeElectron.getSystemPreferences().unsubscribeNotification) {
// SafeElectron.getSystemPreferences().unsubscribeNotification(this.subscriptionId || -1)
// }
// }
// render() {
// const {
// widgetBadge,
// desktopAppBadgeCount,
// windowOpts,
// windowPositionBottomRight,
// windowTitle,
// externalRemoteWindow,
// ...props
// } = this.props
// return <ComposedComponent {...props} />
// }
// }

// return RemoteWindowComponent
// }

export type RemoteTlfUpdates = {
  timestamp: number
  tlf: FSTypes.Path
  updates: Array<{path: FSTypes.Path; uploading: boolean}>
  writer: string
}

export type Props = {
  badgeInfo: NotificationTypes.State['navBadges']
  config: {
    avatarRefreshCounter: Map<string, number>
    followers: Set<string>
    following: Set<string>
    httpSrvAddress: string
    httpSrvToken: string
  }
  conversationsToSend: Array<{
    conversation: ChatTypes.ConversationMeta
    hasBadge: boolean
    hasUnread: boolean
    participantInfo: ChatTypes.ParticipantInfo
  }>
  daemonHandshakeState: ConfigTypes.DaemonHandshakeState
  darkMode: boolean
  diskSpaceStatus: FSTypes.DiskSpaceStatus
  kbfsDaemonStatus: Readonly<{
    rpcStatus: FSTypes.KbfsDaemonRpcStatus
    onlineStatus: FSTypes.KbfsDaemonOnlineStatus
  }>
  kbfsEnabled: boolean
  loggedIn: boolean
  outOfDate: ConfigTypes.OutOfDate | undefined
  showingDiskSpaceBanner: boolean
  remoteTlfUpdates: Array<RemoteTlfUpdates>
  users: {
    infoMap: Map<string, UsersTypes.UserInfo>
  }
  username: string
  usernames: string[]
  endEstimate: number
  fileName: string | null
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
  const {navBadges, desktopAppBadgeCount, widgetBadge} = state.notifications
  const {menubarWindowID, daemonHandshakeState, loggedIn, outOfDate, username} = state.config
  const {pathItems, tlfUpdates, uploads, overallSyncStatus, kbfsDaemonStatus, sfmi} = state.fs
  const {inboxLayout, metaMap, badgeMap, unreadMap, participantMap} = state.chat2

  const conversationsToSend =
    inboxLayout?.widgetList?.map(v => ({
      conversation: metaMap.get(v.convID) || {
        ...ChatConstants.makeConversationMeta(),
        conversationIDKey: v.convID,
      },
      hasBadge: !!badgeMap.get(v.convID),
      hasUnread: !!unreadMap.get(v.convID),
      participantInfo: participantMap.get(v.convID) ?? ChatConstants.noParticipantInfo,
    })) ?? []

  const darkMode = Styles.isDarkMode()
  const diskSpaceStatus = overallSyncStatus.diskSpaceStatus
  const showingDiskSpaceBanner = overallSyncStatus.showingBanner
  const kbfsEnabled = sfmi.driverStatus.type === 'enabled'
  const userInfo = state.users.infoMap

  const usernames = tlfUpdates.map(update => update.writer)
  const remoteTlfUpdates = tlfUpdates.map(t => GetRowsFromTlfUpdate(t, uploads))

  const p = {
    ...uploadsToUploadCountdownHOCProps(pathItems, uploads),
    // TODO sycn avatar
    config: {
      avatarRefreshCounter: new Map<string, number>(),
      followers: new Set<string>(),
      following: new Set<string>(),
      httpSrvAddress: '',
      httpSrvToken: '',
    },
    badgeInfo: navBadges,
    conversationsToSend,
    daemonHandshakeState,
    darkMode,
    desktopAppBadgeCount,
    diskSpaceStatus,
    externalRemoteWindowID: menubarWindowID,
    kbfsDaemonStatus,
    kbfsEnabled,
    loggedIn,
    outOfDate,
    remoteTlfUpdates,
    showingDiskSpaceBanner,
    users: {infoMap: userInfo},
    username,
    usernames,
    widgetBadge,
  }

  return <Widget {...p} />
}

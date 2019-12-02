// A mirror of the remote menubar windows.
import * as React from 'react'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'
import {conversationsToSend} from '../chat/inbox/container/remote'
import {serialize} from './remote-serializer.desktop'
import {uploadsToUploadCountdownHOCProps} from '../fs/footer/upload-container'
import * as Constants from '../constants/config'
import {TlfUpdate} from '../constants/types/fs'
import {BadgeType} from '../constants/types/notifications'
import {isDarwin, isWindows} from '../constants/platform'
import {resolveImage} from '../desktop/app/resolve-root.desktop'
import {getMainWindow} from '../desktop/remote/util.desktop'
import {isSystemDarkMode} from '../styles/dark-mode'

const _windowOpts = {}

type Props = {
  desktopAppBadgeCount: number
  externalRemoteWindow: SafeElectron.BrowserWindowType
  remoteWindowNeedsProps: number
  widgetBadge: BadgeType
  windowComponent: string
  windowOpts?: Object
  windowParam: string
  windowPositionBottomRight?: boolean
  windowTitle: string
}

const getIcons = (iconType: BadgeType, isBadged: boolean) => {
  const devMode = __DEV__ ? '-dev' : ''
  let color = 'white'
  const colorSelected = 'white'
  let platform = ''
  const badged = isBadged ? 'badged-' : ''

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
function RemoteMenubarWindow(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props> {
    subscriptionId: number | null = null
    _updateBadges = () => {
      const [icon, iconSelected] = getIcons(this.props.widgetBadge, this.props.desktopAppBadgeCount > 0)
      SafeElectron.getApp().emit('KBmenu', '', {
        payload: {
          desktopAppBadgeCount: this.props.desktopAppBadgeCount,
          icon,
          iconSelected,
        },
        type: 'showTray',
      })
      // Windows just lets us set (or unset, with null) a single 16x16 icon
      // to be used as an overlay in the bottom right of the taskbar icon.
      if (isWindows) {
        const mw = getMainWindow()
        const overlay =
          this.props.desktopAppBadgeCount > 0 ? resolveImage('icons', 'icon-windows-badge.png') : null
        // @ts-ignore setOverlayIcon docs say null overlay's fine, TS disagrees
        mw && mw.setOverlayIcon(overlay, 'new activity')
      }
    }

    componentDidUpdate(prevProps: Props) {
      if (
        this.props.widgetBadge !== prevProps.widgetBadge ||
        this.props.desktopAppBadgeCount !== prevProps.desktopAppBadgeCount ||
        this.props.remoteWindowNeedsProps !== prevProps.remoteWindowNeedsProps
      ) {
        this._updateBadges()
      }
    }

    componentDidMount() {
      this._updateBadges()

      if (isDarwin && SafeElectron.getSystemPreferences().subscribeNotification) {
        this.subscriptionId = SafeElectron.getSystemPreferences().subscribeNotification(
          'AppleInterfaceThemeChangedNotification',
          () => {
            this._updateBadges()
          }
        )
      }
    }
    componentWillUnmount() {
      if (this.subscriptionId && SafeElectron.getSystemPreferences().unsubscribeNotification) {
        SafeElectron.getSystemPreferences().unsubscribeNotification(this.subscriptionId || -1)
      }
    }
    render() {
      const {
        widgetBadge,
        desktopAppBadgeCount,
        windowOpts,
        windowPositionBottomRight,
        windowTitle,
        externalRemoteWindow,
        ...props
      } = this.props
      return <ComposedComponent {...props} />
    }
  }

  return RemoteWindowComponent
}

const mapStateToProps = (state: Container.TypedState) => ({
  _badgeInfo: state.notifications.navBadges,
  _externalRemoteWindowID: state.config.menubarWindowID,
  _pathItems: state.fs.pathItems,
  _tlfUpdates: state.fs.tlfUpdates,
  _uploads: state.fs.uploads,
  conversationsToSend: conversationsToSend(state),
  daemonHandshakeState: state.config.daemonHandshakeState,
  darkMode: Styles.isDarkMode(),
  desktopAppBadgeCount: state.notifications.desktopAppBadgeCount,
  diskSpaceStatus: state.fs.overallSyncStatus.diskSpaceStatus,
  kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
  kbfsEnabled: state.fs.sfmi.driverStatus.type === 'enabled',
  loggedIn: state.config.loggedIn,
  outOfDate: state.config.outOfDate,
  remoteWindowNeedsProps: Constants.getRemoteWindowPropsCount(state.config, 'menubar', ''),
  showingDiskSpaceBanner: state.fs.overallSyncStatus.showingBanner,
  userInfo: state.users.infoMap,
  username: state.config.username,
  widgetBadge: state.notifications.widgetBadge,
})

let _lastUsername: string | undefined
let _lastClearCacheTrigger = 0

const getUsernamesFromTlfUpdate = (tlfUpdates: Array<TlfUpdate>): Array<string> =>
  tlfUpdates.map(update => update.writer)

// TODO better type
const RenderExternalWindowBranch: any = (ComposedComponent: React.ComponentType<any>) =>
  class RemoteWindowComponent extends React.PureComponent<{
    externalRemoteWindow?: SafeElectron.BrowserWindowType
  }> {
    render() {
      return this.props.externalRemoteWindow ? <ComposedComponent {...this.props} /> : null
    }
  }

// Actions are handled by remote-container
export default Container.namedConnect(
  mapStateToProps,
  () => ({}),
  stateProps => {
    if (_lastUsername !== stateProps.username) {
      _lastUsername = stateProps.username
      _lastClearCacheTrigger++
    }

    // To show the following status of usernaems in the mebubar widget, we need to
    // provide which users will appear in the menubar before rendering it.
    // This is done for SyncAvatarProps which use the usernames to shorten the
    // number of following/follwers that are sent to the remote window.
    const usernamesForFollowingStatus = getUsernamesFromTlfUpdate(stateProps._tlfUpdates)

    return {
      badgeKeys: stateProps._badgeInfo,
      badgeMap: stateProps._badgeInfo,
      clearCacheTrigger: _lastClearCacheTrigger,
      conversationIDs: stateProps.conversationsToSend,
      conversationMap: stateProps.conversationsToSend,
      daemonHandshakeState: stateProps.daemonHandshakeState,
      darkMode: stateProps.darkMode,
      desktopAppBadgeCount: stateProps.desktopAppBadgeCount,
      diskSpaceStatus: stateProps.diskSpaceStatus,
      externalRemoteWindow: stateProps._externalRemoteWindowID
        ? SafeElectron.getRemote().BrowserWindow.fromId(stateProps._externalRemoteWindowID)
        : null,
      fileRows: {_tlfUpdates: stateProps._tlfUpdates, _uploads: stateProps._uploads},
      kbfsDaemonStatus: stateProps.kbfsDaemonStatus,
      kbfsEnabled: stateProps.kbfsEnabled,
      loggedIn: stateProps.loggedIn,
      outOfDate: stateProps.outOfDate,
      remoteWindowNeedsProps: stateProps.remoteWindowNeedsProps,
      showingDiskSpaceBanner: stateProps.showingDiskSpaceBanner,
      userInfo: stateProps.userInfo,
      username: stateProps.username,
      usernames: usernamesForFollowingStatus,
      widgetBadge: stateProps.widgetBadge,
      windowComponent: 'menubar',
      windowOpts: _windowOpts,
      windowParam: '',
      windowTitle: '',
      ...uploadsToUploadCountdownHOCProps(stateProps._pathItems, stateProps._uploads),
    }
  },
  'MenubarRemoteProxy'
)(
  RenderExternalWindowBranch(
    RemoteMenubarWindow(SyncAvatarProps(SyncProps(serialize)(Container.NullComponent)))
  )
)

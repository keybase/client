// A mirror of the remote menubar windows.
import * as React from 'react'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import * as Container from '../util/container'
import {conversationsToSend} from '../chat/inbox/container/remote'
import {serialize} from './remote-serializer.desktop'
import {uploadsToUploadCountdownHOCProps} from '../fs/footer/upload-container'
import * as Constants from '../constants/config'
import {BadgeType} from '../constants/types/notifications'
import {isDarwin, isWindows} from '../constants/platform'
import {resolveImage} from '../desktop/app/resolve-root.desktop'

const windowOpts = {}

type Props = {
  desktopAppBadgeCount: number
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
    color = KB.isDarkMode() ? 'white' : 'black'
  } else if (isWindows) {
    color = 'black'
    platform = 'windows-'
  }

  const size = isWindows ? 16 : 22
  const icon = `icon-${platform}keybase-menubar-${badged}${iconType}-${color}-${size}${devMode}@2x.png`
  // Only used on Darwin
  const iconSelected = `icon-${platform}keybase-menubar-${badged}${iconType}-${colorSelected}-${size}${devMode}@2x.png`
  return [icon, iconSelected]
}

// Like RemoteWindow but the browserWindow is handled by the 3rd party menubar class and mostly lets it handle things
function RemoteMenubarWindow(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props> {
    subscriptionId: number | undefined
    _updateBadges = () => {
      const [icon, iconSelected] = getIcons(this.props.widgetBadge, this.props.desktopAppBadgeCount > 0)
      KB.rendererToMainMenu({
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
        const overlay =
          this.props.desktopAppBadgeCount > 0 ? resolveImage('icons', 'icon-windows-badge.png') : null
        KB.setOverlayIcon(overlay)
      }
    }

    componentDidUpdate(prevProps) {
      if (
        this.props.widgetBadge !== prevProps.widgetBadge ||
        this.props.desktopAppBadgeCount !== prevProps.desktopAppBadgeCount
      ) {
        this._updateBadges()
      }
    }

    componentDidMount() {
      this._updateBadges()
      this.subscriptionId = KB.handleDarkModeChanged(() => {
        this._updateBadges()
      })
    }
    componentWillUnmount() {
      KB.unhandleDarkModeChanged(this.subscriptionId)
    }
    render() {
      const {
        widgetBadge,
        desktopAppBadgeCount,
        windowOpts,
        windowPositionBottomRight,
        windowTitle,
        ...props
      } = this.props
      return <ComposedComponent {...props} />
    }
  }

  return RemoteWindowComponent
}

const mapStateToProps = (state: Container.TypedState) => ({
  _badgeInfo: state.notifications.navBadges,
  _edits: state.fs.edits,
  _pathItems: state.fs.pathItems,
  _tlfUpdates: state.fs.tlfUpdates,
  _uploads: state.fs.uploads,
  conversationsToSend: conversationsToSend(state),
  daemonHandshakeState: state.config.daemonHandshakeState,
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

// Actions are handled by remote-container
export default Container.namedConnect(
  mapStateToProps,
  () => ({}),
  stateProps => {
    if (_lastUsername !== stateProps.username) {
      _lastUsername = stateProps.username
      _lastClearCacheTrigger++
    }
    return {
      badgeKeys: stateProps._badgeInfo,
      badgeMap: stateProps._badgeInfo,
      clearCacheTrigger: _lastClearCacheTrigger,
      conversationIDs: stateProps.conversationsToSend,
      conversationMap: stateProps.conversationsToSend,
      daemonHandshakeState: stateProps.daemonHandshakeState,

      desktopAppBadgeCount: stateProps.desktopAppBadgeCount,
      diskSpaceStatus: stateProps.diskSpaceStatus,
      fileRows: {_tlfUpdates: stateProps._tlfUpdates, _uploads: stateProps._uploads},
      kbfsDaemonStatus: stateProps.kbfsDaemonStatus,
      kbfsEnabled: stateProps.kbfsEnabled,
      loggedIn: stateProps.loggedIn,
      outOfDate: stateProps.outOfDate,
      remoteWindowNeedsProps: stateProps.remoteWindowNeedsProps,
      showingDiskSpaceBanner: stateProps.showingDiskSpaceBanner,
      userInfo: stateProps.userInfo,
      username: stateProps.username,
      widgetBadge: stateProps.widgetBadge,
      windowComponent: 'menubar',
      windowOpts,
      windowParam: '',
      windowTitle: '',
      ...uploadsToUploadCountdownHOCProps(stateProps._edits, stateProps._pathItems, stateProps._uploads),
    }
  },
  'MenubarRemoteProxy'
)(RemoteMenubarWindow(SyncAvatarProps(SyncProps(serialize)(Container.NullComponent))))

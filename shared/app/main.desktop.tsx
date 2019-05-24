import {hot} from 'react-hot-loader/root'
import * as React from 'react'
import RouterSwitcheroo from '../router-v2/switcheroo'
import {connect} from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'
import {isWindows} from '../constants/platform'
import {resolveImage} from '../desktop/app/resolve-root.desktop'
import {getMainWindow} from '../desktop/remote/util.desktop'
type OwnProps = any

type Props = {
  widgetBadge: boolean
  desktopAppBadgeCount: number
  username: string
}

// TODO likely remove this class
class Main extends React.PureComponent<Props> {
  _updateBadges = () => {
    SafeElectron.getIpcRenderer().send('showTray', this.props.widgetBadge, this.props.desktopAppBadgeCount)
    // Windows just lets us set (or unset, with null) a single 16x16 icon
    // to be used as an overlay in the bottom right of the taskbar icon.
    if (isWindows) {
      const mw = getMainWindow()
      const overlay =
        this.props.desktopAppBadgeCount > 0 ? resolveImage('icons', 'icon-windows-badge.png') : null
      // @ts-ignore
      mw && mw.setOverlayIcon(overlay, 'new activity')
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
  }

  render() {
    return <RouterSwitcheroo />
  }
}

const mapStateToProps = state => ({
  desktopAppBadgeCount: state.notifications.get('desktopAppBadgeCount'),
  username: state.config.username,
  widgetBadge: state.notifications.get('widgetBadge') || false,
})

const mapDispatchToProps = dispatch => ({})

export default hot(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  )(Main)
)

// @flow
import {hot} from 'react-hot-loader'
// Uncomment to get more info on hot loading
// import { setConfig } from 'react-hot-loader'
// setConfig({ logLevel: 'debug' })
import React, {Component} from 'react'
import RenderRoute from '../route-tree/render-route'
import {connect, type TypedState} from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'
import {isWindows} from '../constants/platform'
import {resolveImage} from '../desktop/app/resolve-root.desktop'
import {getMainWindow} from '../desktop/remote/util.desktop'
import {navigateUp, setRouteState} from '../actions/route-tree'
import {type RouteDefNode, type RouteStateNode, type Path} from '../route-tree'

type Props = {
  widgetBadge: boolean,
  desktopAppBadgeCount: number,
  username: string,
  navigateUp: () => void,
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  setRouteState: (path: Path, partialState: {}) => void,
}

class Main extends Component<Props> {
  _updateBadges = () => {
    SafeElectron.getIpcRenderer().send('showTray', this.props.widgetBadge, this.props.desktopAppBadgeCount)
    // Windows just lets us set (or unset, with null) a single 16x16 icon
    // to be used as an overlay in the bottom right of the taskbar icon.
    if (isWindows) {
      const mw = getMainWindow()
      const overlay =
        this.props.desktopAppBadgeCount > 0 ? resolveImage('icons', 'icon-windows-badge.png') : null
      // $FlowIssue setOverlayIcon docs say null overlay's fine, flow disagrees
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
    return (
      <RenderRoute
        routeDef={this.props.routeDef}
        routeState={this.props.routeState}
        setRouteState={this.props.setRouteState}
      />
    )
  }
}

const mapStateToProps = (state: TypedState) => {
  return {
    desktopAppBadgeCount: state.notifications.get('desktopAppBadgeCount'),
    routeDef: state.routeTree.routeDef,
    routeState: state.routeTree.routeState,
    username: state.config.username,
    widgetBadge: state.notifications.get('widgetBadge') || false,
  }
}

const mapDispatchToProps = dispatch => ({
  navigateUp: () => dispatch(navigateUp()),
  setRouteState: (path, partialState) => {
    dispatch(setRouteState(path, partialState))
  },
})

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  )(Main)
)

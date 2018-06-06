// @flow
import {hot} from 'react-hot-loader'
// Uncomment to get more info on hot loading
// import { setConfig } from 'react-hot-loader'
// setConfig({ logLevel: 'debug' })
import React, {Component} from 'react'
import RenderRoute from '../route-tree/render-route'
import {connect, type TypedState} from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'
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

const mapDispatchToProps = (dispatch: Dispatch) => ({
  navigateUp: () => dispatch(navigateUp()),
  setRouteState: (path, partialState) => {
    dispatch(setRouteState(path, partialState))
  },
})

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(Main)
)

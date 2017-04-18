// @flow
import React, {Component} from 'react'
import RenderRoute from './route-tree/render-route'
import {connect} from 'react-redux'
import {ipcRenderer} from 'electron'
import {navigateUp, setRouteState} from './actions/route-tree'

import type {RouteDefNode, RouteStateNode, Path} from './route-tree'
import type {TypedState} from './constants/reducer'

type Props = {
  widgetBadge: boolean,
  desktopAppBadgeCount: number,
  provisioned: boolean,
  username: string,
  navigateUp: () => void,
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  setRouteState: (path: Path, partialState: {}) => void,
}

class Main extends Component<void, Props, void> {
  _updateBadges = () => {
    ipcRenderer.send('showTray', this.props.widgetBadge, this.props.desktopAppBadgeCount)
  }

  componentDidUpdate (prevProps) {
    if (this.props.widgetBadge !== prevProps.widgetBadge ||
      this.props.desktopAppBadgeCount !== prevProps.desktopAppBadgeCount) {
      this._updateBadges()
    }
  }

  componentDidMount () {
    this._updateBadges()
  }

  render () {
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
    provisioned: state.config.extendedConfig && !!state.config.extendedConfig.defaultDeviceID,
    routeDef: state.routeTree.routeDef,
    routeState: state.routeTree.routeState,
    username: state.config.username,
    widgetBadge: state.notifications.get('widgetBadge'),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  navigateUp: () => dispatch(navigateUp()),
  setRouteState: (path, partialState) => { dispatch(setRouteState(path, partialState)) },
})

export default connect(mapStateToProps, mapDispatchToProps)(Main)

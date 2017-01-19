// @flow
// TEMP TEMP TEMP
import React, {Component} from 'react'
import RenderRoute from './route-tree/render-route'
import {checkReachability} from './actions/gregor'
import {connect} from 'react-redux'
import {ipcRenderer} from 'electron'
import {navigateUp, setRouteState} from './actions/route-tree'

import type {RouteDefNode, RouteStateNode, Path} from './route-tree'

type Props = {
  menuBadge: boolean,
  menuBadgeCount: number,
  provisioned: boolean,
  username: string,
  navigateUp: () => void,
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  setRouteState: (path: Path, partialState: {}) => void,
  checkReachability: () => void,
}

class Main extends Component<void, Props, void> {
  componentDidUpdate (prevProps) {
    if (this.props.menuBadge !== prevProps.menuBadge ||
      this.props.menuBadgeCount !== prevProps.menuBadgeCount) {
      ipcRenderer.send('showTray', this.props.menuBadge, this.props.menuBadgeCount)
    }
  }

  componentDidMount () {
    ipcRenderer.send('showTray', this.props.menuBadge, this.props.menuBadgeCount)

    window.addEventListener('online', this.props.checkReachability)
    window.addEventListener('offline', this.props.checkReachability)
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

// $FlowIssue type this connector
export default connect(
  ({
    routeTree: {routeDef, routeState},
    config: {extendedConfig, username},
    notifications: {menuBadge, menuBadgeCount}}) => ({
      routeDef,
      routeState,
      provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
      username,
      menuBadge,
      menuBadgeCount,
    }),
  dispatch => {
    return {
      navigateUp: () => dispatch(navigateUp()),
      setRouteState: (path, partialState) => { dispatch(setRouteState(path, partialState)) },
      checkReachability: () => dispatch(checkReachability()),
    }
  }
)(Main)

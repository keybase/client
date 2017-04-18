// @flow
import React, {Component} from 'react'
import RenderRoute from './route-tree/render-route'
import {connect} from 'react-redux'
import {ipcRenderer} from 'electron'
import {navigateUp, setRouteState} from './actions/route-tree'

import type {RouteDefNode, RouteStateNode, Path} from './route-tree'
import type {TypedState} from './constants/reducer'

type Props = {
  menuBadge: boolean,
  menuBadgeCount: number,
  provisioned: boolean,
  username: string,
  navigateUp: () => void,
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  setRouteState: (path: Path, partialState: {}) => void,
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
    menuBadgeCount: state.notifications.get('menuBadgeCount'),
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

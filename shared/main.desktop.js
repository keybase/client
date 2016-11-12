// @flow
import {ipcRenderer} from 'electron'

import React, {Component} from 'react'
import {connect} from 'react-redux'
import RenderRoute from './route-tree/render-route'
import flags from './util/feature-flags'
import {isDarwin} from './constants/platform'

import {navigateUp, setRouteState} from './actions/route-tree'

import type {RouteDefNode, RouteStateNode, Path} from './route-tree'

type Props = {
  menuBadge: boolean,
  provisioned: boolean,
  username: string,
  navigateUp: () => void,
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  setRouteState: (path: Path, partialState: {}) => void,
}

class Main extends Component<void, Props, void> {
  _handleKeyDown: (e: SyntheticKeyboardEvent) => void;

  constructor (props) {
    super(props)
    this._handleKeyDown = this._handleKeyDown.bind(this)
  }

  _handleKeyDown (e: SyntheticKeyboardEvent) {
    const modKey = isDarwin ? e.metaKey : e.ctrlKey
    // TODO (MBG): add back once we have a back action
    // if (modKey && e.key === 'ArrowLeft') {
    //   e.preventDefault()
    //   this.props.navigateBack()
    //   return
    // }
    if (modKey && e.key === 'ArrowUp') {
      e.preventDefault()
      this.props.navigateUp()
      return
    }
  }

  componentDidUpdate (prevProps) {
    if (this.props.menuBadge !== prevProps.menuBadge) {
      ipcRenderer.send(this.props.menuBadge ? 'showTrayRegular' : 'showTrayBadged')
    }
  }

  componentDidMount () {
    if (flags.admin) window.addEventListener('keydown', this._handleKeyDown)
    ipcRenderer.send('showTray', this.props.menuBadge)
  }

  componentWillUnmount () {
    if (flags.admin) window.removeEventListener('keydown', this._handleKeyDown)
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
    notifications: {menuBadge}}) => ({
      routeDef,
      routeState,
      provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
      username,
      menuBadge,
    }),
  dispatch => {
    return {
      navigateUp: () => dispatch(navigateUp()),
      setRouteState: (path, partialState) => { dispatch(setRouteState(path, partialState)) },
    }
  }
)(Main)

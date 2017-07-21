// @flow
import Push from './push/push.native'
import React, {Component} from 'react'
import RenderRoute from '../route-tree/render-route'
import loadPerf from '../util/load-perf'
import hello from '../util/hello'
import {bootstrap} from '../actions/config'
import {connect} from 'react-redux-profiled'
import debounce from 'lodash/debounce'
import {getUserImageMap, loadUserImageMap} from '../util/pictures'
import {initAvatarLookup, initAvatarLoad} from '../common-adapters/index.native'
import {listenForNotifications} from '../actions/notifications'
import {persistRouteState, loadRouteState} from '../actions/platform-specific.native'
import {navigateUp, setRouteState} from '../actions/route-tree'

import type {TypedState} from '../constants/reducer'

type Props = {
  dumbFullscreen: boolean,
  folderBadge: number,
  mountPush: boolean,
  routeDef: any,
  routeState: any,
  showPushPrompt: any,
  bootstrap: () => void,
  hello: () => void,
  listenForNotifications: () => void,
  loadRouteState: () => void,
  persistRouteState: () => void,
  setRouteState: (path: any, partialState: any) => void,
  navigateUp: () => void,
}

type OwnProps = {
  platform: string,
  version: string,
}

class Main extends Component<void, any, void> {
  constructor(props: Props) {
    super(props)

    if (!global.mainLoaded) {
      global.mainLoaded = true
      initAvatarLookup(getUserImageMap)
      initAvatarLoad(loadUserImageMap)

      this.props.loadRouteState()
      this.props.bootstrap()
      this.props.listenForNotifications()
      this.props.hello()
      loadPerf()
    }
  }

  _persistRoute = debounce(() => {
    this.props.persistRouteState()
  }, 200)

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.routeState !== nextProps.routeState) {
      this._persistRoute()
    }
  }

  render() {
    if (this.props.dumbFullscreen) {
      const DumbSheet = require('../dev/dumb-sheet').default
      return <DumbSheet />
    }

    // TODO: move Push prompt into route
    if (this.props.showPushPrompt) {
      return <Push />
    }

    return (
      <RenderRoute
        routeDef={this.props.routeDef}
        routeState={this.props.routeState}
        setRouteState={this.props.setRouteState}
      />
    )
  }
}

const mapStateToProps = (state: TypedState) => ({
  dumbFullscreen: state.dev.debugConfig.dumbFullscreen,
  folderBadge: state.favorite.folderState.privateBadge + state.favorite.folderState.publicBadge,
  routeDef: state.routeTree.routeDef,
  routeState: state.routeTree.routeState,
  showPushPrompt: state.push.permissionsPrompt,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  bootstrap: () => dispatch(bootstrap()),
  hello: () => hello(0, ownProps.platform, [], ownProps.version, true), // TODO real version
  listenForNotifications: () => dispatch(listenForNotifications()),
  loadRouteState: () => dispatch(loadRouteState()),
  navigateUp: () => {
    dispatch(navigateUp())
  },
  persistRouteState: () => dispatch(persistRouteState()),
  setRouteState: (path, partialState) => {
    dispatch(setRouteState(path, partialState))
  },
})

const connector = connect(mapStateToProps, mapDispatchToProps)

export {connector, Main}

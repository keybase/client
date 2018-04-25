// @flow
import * as ConfigGen from '../actions/config-gen'
import * as NotificationsGen from '../actions/notifications-gen'
import Push from './push/push.native'
import React, {Component, Fragment} from 'react'
import RenderRoute from '../route-tree/render-route'
import loadPerf from '../util/load-perf'
import hello from '../util/hello'
import {connect, type TypedState} from '../util/container'
import {debounce} from 'lodash-es'
import {navigateUp, setRouteState} from '../actions/route-tree'
import {GatewayDest} from 'react-gateway'
import {View} from 'react-native'

type Props = {
  folderBadge: number,
  mountPush: boolean,
  routeDef: any,
  routeState: any,
  showPushPrompt: any,
  bootstrap: () => void,
  hello: () => void,
  listenForNotifications: () => void,
  persistRouteState: () => void,
  setRouteState: (path: any, partialState: any) => void,
  navigateUp: () => void,
}

type OwnProps = {
  platform: string,
  version: string,
}

class Main extends Component<any> {
  constructor(props: Props) {
    super(props)

    if (!global.mainLoaded) {
      global.mainLoaded = true

      this.props.bootstrap()
      this.props.listenForNotifications()
      this.props.hello()
      loadPerf()
    }
  }

  _persistRoute = debounce(() => {
    this.props.persistRouteState()
  }, 200)

  componentDidUpdate(prevProps: Props) {
    if (this.props.routeState !== prevProps.routeState) {
      this._persistRoute()
    }
  }

  render() {
    // TODO: move Push prompt into route
    if (this.props.showPushPrompt) {
      return <Push />
    }

    return (
      <Fragment>
        <RenderRoute
          routeDef={this.props.routeDef}
          routeState={this.props.routeState}
          setRouteState={this.props.setRouteState}
        />
        <GatewayDest name="popup-root" component={View} />
      </Fragment>
    )
  }
}

const mapStateToProps = (state: TypedState) => ({
  folderBadge: state.favorite.folderState.privateBadge + state.favorite.folderState.publicBadge,
  routeDef: state.routeTree.routeDef,
  routeState: state.routeTree.routeState,
  showPushPrompt: state.push.permissionsPrompt,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  bootstrap: () => dispatch(ConfigGen.createBootstrap({})),
  hello: () => hello(0, ownProps.platform, [], ownProps.version, true), // TODO real version
  listenForNotifications: () => dispatch(NotificationsGen.createListenForNotifications()),
  navigateUp: () => {
    dispatch(navigateUp())
  },
  persistRouteState: () => dispatch(ConfigGen.createPersistRouteState()),
  setRouteState: (path, partialState) => {
    dispatch(setRouteState(path, partialState))
  },
})

const connector = connect(mapStateToProps, mapDispatchToProps)

export {connector, Main}

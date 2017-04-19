// @flow
import DumbSheet from './dev/dumb-sheet'
import Push from './push/push.native'
import RNPN from 'react-native-push-notification'
import React, {Component} from 'react'
import RenderRoute from './route-tree/render-route'
import loadPerf from './util/load-perf'
import hello from './util/hello'
import {Box} from './common-adapters/index'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {debounce} from 'lodash'
import {getUserImageMap, loadUserImageMap, clearErrors} from './util/pictures'
import {initAvatarLookup, initAvatarLoad} from './common-adapters'
import {listenForNotifications} from './actions/notifications'
import {persistRouteState, loadRouteState} from './actions/platform-specific.native'
import {navigateUp, setRouteState} from './actions/route-tree'

type Props = {
  dumbFullscreen: boolean,
  folderBadge: number,
  menuBadgeCount: number,
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

class Main extends Component<void, any, void> {
  constructor (props: Props) {
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

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.routeState !== nextProps.routeState) {
      this._persistRoute()
    }

    if (this.props.menuBadgeCount !== nextProps.menuBadgeCount) {
      RNPN.setApplicationIconBadgeNumber(nextProps.menuBadgeCount)
    }
  }

  render () {
    if (this.props.dumbFullscreen) {
      return <DumbSheet />
    }

    // TODO: move Push prompt into route
    const {showPushPrompt, mountPush} = this.props
    return (
      <Box style={{flex: 1}}>
        {!showPushPrompt &&
          <RenderRoute
            routeDef={this.props.routeDef}
            routeState={this.props.routeState}
            setRouteState={this.props.setRouteState}
          />
        }
        {mountPush && <Push prompt={showPushPrompt} />}
      </Box>
    )
  }
}

// $FlowIssue
const connector = connect(
  ({
    config: {extendedConfig, bootStatus, loggedIn},
    dev: {debugConfig: {dumbFullscreen}},
    favorite: {privateBadge, publicBadge},
    push: {permissionsPrompt},
    routeTree: {routeDef, routeState},
    notifications: {menuBadgeCount},
  }) => ({
    dumbFullscreen,
    folderBadge: privateBadge + publicBadge,
    menuBadgeCount,
    mountPush: extendedConfig && !!extendedConfig.defaultDeviceID && loggedIn && bootStatus === 'bootStatusBootstrapped',
    routeDef,
    routeState,
    showPushPrompt: permissionsPrompt,
  }),
  (dispatch, {platform, version}) => ({
    bootstrap: () => dispatch(bootstrap()),
    hello: () => hello(0, platform, [], version, true), // TODO real version
    listenForNotifications: () => dispatch(listenForNotifications()),
    loadRouteState: () => dispatch(loadRouteState()),
    persistRouteState: () => dispatch(persistRouteState()),
    setRouteState: (path, partialState) => { dispatch(setRouteState(path, partialState)) },
    navigateUp: () => { dispatch(navigateUp()) },
  })
)

export {
  connector,
  Main,
}

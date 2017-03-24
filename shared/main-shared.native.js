// @flow
import DumbSheet from './dev/dumb-sheet'
import Push from './push/push.native'
import React, {Component} from 'react'
import RenderRoute from './route-tree/render-route'
import hello from './util/hello'
import {Box} from './common-adapters/index'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {debounce} from 'lodash'
import {getUserImageMap, loadUserImageMap} from './util/pictures'
import {initAvatarLookup, initAvatarLoad} from './common-adapters'
import {listenForNotifications} from './actions/notifications'
import {persistRouteState, loadRouteState} from './actions/platform-specific.native'
import {setRouteState, navigateUp} from './actions/route-tree'

// TODO type this later
type Props = any

class Main extends Component<void, any, void> {
  constructor (props: Props) {
    super(props)

    initAvatarLookup(getUserImageMap)
    initAvatarLoad(loadUserImageMap)
    this.props.loadRouteState()
    this.props.bootstrap()
    this.props.listenForNotifications()
    this.props.hello()
  }

  _persistRoute = debounce(() => {
    this.props.persistRouteState()
  }, 200)

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.routeState !== nextProps.routeState) {
      this._persistRoute()
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
    config: {extendedConfig, username, bootStatus, loggedIn},
    dev: {debugConfig: {dumbFullscreen}},
    favorite: {privateBadge, publicBadge},
    push: {permissionsPrompt},
    routeTree: {routeDef, routeState},
  }) => ({
    dumbFullscreen,
    folderBadge: privateBadge + publicBadge,
    mountPush: extendedConfig && !!extendedConfig.defaultDeviceID && loggedIn && bootStatus === 'bootStatusBootstrapped',
    permissionsPrompt,
    routeDef,
    routeState,
    showPushPrompt: permissionsPrompt,
    username,
  }),
  (dispatch, {platform, version}) => ({
    bootstrap: () => dispatch(bootstrap()),
    hello: () => hello(0, platform, [], version, true), // TODO real version
    listenForNotifications: () => dispatch(listenForNotifications()),
    persistRouteState: () => dispatch(persistRouteState()),
    loadRouteState: () => dispatch(loadRouteState()),
    setRouteState: (path, partialState) => { dispatch(setRouteState(path, partialState)) },
    navigateUp: () => dispatch(navigateUp()),
  })
)

export {
  connector,
  Main,
}

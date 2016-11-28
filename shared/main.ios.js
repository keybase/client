// @flow
import React, {Component} from 'react'
import hello from './util/hello'
import {Box} from './common-adapters/index'
import DumbSheet from './dev/dumb-sheet'
import {bootstrap} from './actions/config'
import {connect} from 'react-redux'
import {listenForNotifications} from './actions/notifications'
import RenderRoute from './route-tree/render-route'
import Push from './push/push.native'
import {setRouteState} from './actions/route-tree'

module.hot && module.hot.accept(() => {
  console.log('accepted update in main.ios')
})

class Main extends Component {
  constructor (props) {
    super(props)

    this.props.bootstrap()
    this.props.listenForNotifications()

    // Introduce ourselves to the service
    hello(0, 'iOS app', [], '0.0.0') // TODO real version
  }

  render () {
    if (this.props.dumbFullscreen) {
      return <DumbSheet />
    }

    // TODO: move Push prompt into route
    const enablePushPrompt = this.props.provisioned && this.props.permissionsPrompt
    return (
      <Box style={{flex: 1}}>
        {!enablePushPrompt &&
          <RenderRoute
            routeDef={this.props.routeDef}
            routeState={this.props.routeState}
            setRouteState={this.props.setRouteState}
          />
        }
        <Push prompt={enablePushPrompt} />
      </Box>
    )
  }
}

// $FlowIssue
export default connect(
  ({
    routeTree: {routeDef, routeState},
    favorite: {privateBadge, publicBadge},
    config: {extendedConfig, username},
    dev: {debugConfig: {dumbFullscreen}},
    push: {permissionsPrompt},
  }) => ({
    routeDef,
    routeState,
    provisioned: extendedConfig && !!extendedConfig.defaultDeviceID,
    username,
    dumbFullscreen,
    folderBadge: privateBadge + publicBadge,
    permissionsPrompt,
  }),
  dispatch => ({
    setRouteState: (path, partialState) => { dispatch(setRouteState(path, partialState)) },
    bootstrap: () => dispatch(bootstrap()),
    listenForNotifications: () => dispatch(listenForNotifications()),
  })
)(Main)

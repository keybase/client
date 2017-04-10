// @flow
import React, {Component} from 'react'
import {Image, NativeModules} from 'react-native'
import {connect} from 'react-redux'
import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {permissionsRequest} from '../actions/push'

import type {Props} from './push'
import * as Constants from '../constants/push'

const nativeBridge = NativeModules.KeybaseEngine

class Push extends Component<void, Props, void> {
  componentDidMount () {
    if (nativeBridge.usingSimulator === '1') {
      console.log('Skipping push config due to simulator')
      return
    }

    if (!global.pushLoaded) {
      global.pushLoaded = true
      this.props.configurePush()
    }
  }

  render () {
    if (!this.props.prompt) {
      return null
    }
    return (
      <Box style={{...globalStyles.flexBoxColumn, ...modal, flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: globalColors.white}}>
        <Box style={{margin: globalMargins.small}}>
          <Text type='Header' style={{textAlign: 'center'}}>
            Please turn on notifications!
          </Text>
          {/* The image is wider and will stretch the parent flex box, so we'll
-               position absolute, and then specify a "filler" height. */}
          <Image
            style={{position: 'absolute', left: 10, top: 30}}
            source={require('../images/illustrations/illustration-turn-on-notifications-527-x-294.png')} />
          <Box style={{height: 304}} />
          <Text type='BodySemibold' style={{textAlign: 'center'}}>It's <Text type='BodySemiboldItalic'>very</Text> important you enable notifications.</Text>
          <Text type='Body' style={{textAlign: 'center', marginTop: 20, marginBottom: 20}}>
              This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if you provision a new device, this phone will be contacted.
          </Text>
          <Button type='Primary' style={{paddingBottom: 0}} onClick={() => this.props.onRequestPermissions()} label='Got it' waiting={this.props.permissionsRequesting} />
        </Box>
      </Box>
    )
  }
}

const modal = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}

export default connect(
  (state: any) => {
    const {permissionsRequesting} = state.push
    return ({
      permissionsRequesting,
    })
  },
  (dispatch: any) => {
    return {
      onRequestPermissions: () => {
        dispatch(permissionsRequest())
      },
      configurePush: () => {
        dispatch(({payload: undefined, type: 'push:configurePush'}: Constants.ConfigurePush))
      },
    }
  }
)(Push)

// @flow
import React, {Component} from 'react'
import {NativeModules} from 'react-native'
import {connect} from 'react-redux'
import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {permissionsRequest} from '../actions/push'

import type {Props} from './push'
import * as Constants from '../constants/push'

const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine

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
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'stretch', margin: globalMargins.small}}>

          <Box style={{marginLeft: 8, marginRight: 8, marginTop: 40}}>
            <Text type='Header' style={{textAlign: 'center'}}>
              Please turn on notifications!
            </Text>
            <Box style={{marginTop: 41}} />
            <Text type='BodySemibold' style={{textAlign: 'center'}}>It's <Text type='BodySemiboldItalic'>very</Text> important you enable notifications.</Text>
            <Text type='Body' style={{textAlign: 'center', marginTop: 20}}>
                This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if you provision a new device, this phone will be contacted.
            </Text>
            <Box style={{marginTop: 24, flex: 1}}>
              <Button type='Primary' onClick={() => this.props.onRequestPermissions()} label='Got it' waiting={this.props.permissionsRequesting} />
            </Box>
          </Box>
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

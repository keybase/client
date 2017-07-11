// @flow
import React, {Component} from 'react'
import {Image, NativeModules} from 'react-native'
import {connect} from 'react-redux'
import {Box, Button, Text, NativeScrollView} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {permissionsRequest} from '../../actions/push/creators'

import * as Constants from '../../constants/push'

type Props = {
  prompt: boolean,
  permissionsRequesting: boolean,
  configurePush: () => void,
  onRequestPermissions: () => void,
}

const nativeBridge = NativeModules.KeybaseEngine

class Push extends Component<void, Props, void> {
  componentDidMount() {
    if (nativeBridge.usingSimulator === '1') {
      console.log('Skipping push config due to simulator')
      return
    }

    if (!global.pushLoaded) {
      global.pushLoaded = true
      this.props.configurePush()
    }
  }

  render() {
    if (!this.props.prompt) {
      return null
    }
    return (
      <NativeScrollView style={{width: '100%', height: '100%'}}>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            alignItems: 'center',
            backgroundColor: globalColors.white,
            justifyContent: 'center',
          }}
        >
          <Box style={{margin: globalMargins.small}}>
            <Text
              type="Header"
              style={{
                marginBottom: globalMargins.medium,
                marginTop: globalMargins.medium,
                textAlign: 'center',
              }}
            >
              Please turn on notifications!
            </Text>
            <Box style={{height: 270, width: '100%'}}>
              <Image
                resizeMode="contain"
                source={require('../../images/illustrations/illustration-turn-on-notifications-460-x-252.png')}
              />
            </Box>
            <Text type="BodySmallSemibold" style={{textAlign: 'center', color: globalColors.black}}>
              It's
              {' '}
              <Text type="BodySmallSemiboldItalic" style={{color: globalColors.black}}>very</Text>
              {' '}
              important you enable notifications.
            </Text>
            <Text
              type="BodySmall"
              style={{
                textAlign: 'center',
                marginTop: globalMargins.small,
                marginBottom: globalMargins.small,
                color: globalColors.black,
              }}
            >
              This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if you provision a new device, this phone will be contacted.
            </Text>
            <Button
              type="Primary"
              fullWidth={true}
              style={{marginBottom: 0}}
              onClick={() => this.props.onRequestPermissions()}
              label="Got it"
              waiting={this.props.permissionsRequesting}
            />
          </Box>
        </Box>
      </NativeScrollView>
    )
  }
}

export default connect(
  (state: any) => {
    const {permissionsRequesting} = state.push
    return {
      permissionsRequesting,
    }
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

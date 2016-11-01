// @flow
import React, {Component} from 'react'
import {Image} from 'react-native'
import PushNotification from 'react-native-push-notification'
import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import type {Props} from './request-permissions'

type State = {
  requesting: boolean,
}

class Push extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      requesting: false,
    }
  }

  onRequestPermission () {
    this.setState({requesting: true})
    console.log('Requesting permissions')
    // TODO(gabriel): On iOS, this will only show the OS request dialog on first
    // request, afterwards it won't come up. So we should tell them to go into
    // Settings app and change the permissions there in that case.
    PushNotification.requestPermissions().then((permissions) => {
      console.log('Requested permissions and got:', permissions)
      this.setState({requesting: false})
      this.props.onClose()
    })
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, ...modal, flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: globalColors.white}}>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'stretch', margin: globalMargins.small}}>

          <Box style={{marginLeft: 8, marginRight: 8}}>
            <Text type='Header' style={{textAlign: 'center'}}>
              Please turn on notifications!
            </Text>

            {/* The image is wider and will stretch the parent flex box, so we'll
               position absolute, and then specify a "filler" height. */}
            <Box style={{marginTop: 41}} />
            <Image
              style={{position: 'absolute', left: 10}}
              source={require('../images/illustrations/illustration-turn-on-notifications-527-x-294.png')}
              />
            <Box style={{height: 294, marginBottom:23}} />

            <Text type='BodySemibold' style={{textAlign: 'center'}}>It's <Text type='BodySemiboldItalic'>very</Text> important you enable notifications.</Text>
            <Text type='Body' style={{textAlign: 'center', marginTop: 20}}>
                This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if you provision a new device, this phone will be contacted.
            </Text>
          </Box>
          <Box style={{marginTop: 24, flex: 1}}>
            <Button type='Primary' onClick={() => this.onRequestPermission()} label='Got it' waiting={this.state.requesting} />
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

export default Push

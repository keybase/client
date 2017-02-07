// @flow
import React, {Component} from 'react'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

class IntroRender extends Component {
  render () {
    return (
      <Box style={{...stylesLoginForm, marginTop: this.props.justRevokedSelf || this.props.justDeletedSelf ? 0 : 55}}>
        {!!this.props.justRevokedSelf &&
          <Text type='BodySemiboldItalic' style={{...stylesRevoked}}>{this.props.justRevokedSelf}<Text type='BodySemiboldItalic' style={{color: globalColors.white}}>&nbsp;was revoked successfully</Text></Text>
        }
        {!!this.props.justDeletedSelf &&
          <Text type='BodySemiboldItalic' style={{...stylesRevoked}}>Your Keybase account "{this.props.justDeletedSelf}" has been deleted. Au revoir!</Text>
        }
        {!!this.props.justLoginFromRevokedDevice &&
          <Text type='BodySemiboldItalic' style={{color: globalColors.white}}>This device has been revoked, please log in again.</Text>
        }
        <Icon type='icon-keybase-logo-128' />
        <Text style={stylesHeader} type='HeaderBig'>Join Keybase</Text>
        <Text style={stylesHeaderSub} type='Body'>Folders for anyone in the world.</Text>
        <Button style={stylesButton} type='Primary' onClick={this.props.onSignup} label='Create an account' />
        <Text style={stylesLoginHeader} type='Body' onClick={this.props.onLogin}>Already on Keybase?</Text>
        <Button style={stylesButton} type='Secondary' onClick={this.props.onLogin} label='Log in' />
      </Box>
    )
  }
}

const stylesLoginForm = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
}
const stylesHeader = {
  marginTop: 27,
  color: globalColors.orange,
}
const stylesHeaderSub = {
  marginTop: 10,
}
const stylesLoginHeader = {
  marginTop: 91,
  textAlign: 'center',
}
const stylesButton = {
  marginTop: 15,
}

const stylesRevoked = {
  ...globalStyles.flexBoxRow,
  color: globalColors.white,
  textAlign: 'center',
  marginBottom: 40,
  marginTop: 20,
  paddingLeft: 15,
  paddingRight: 15,
  paddingTop: 14,
  paddingBottom: 14,
  alignSelf: 'stretch',
  backgroundColor: globalColors.green,
}

export default IntroRender

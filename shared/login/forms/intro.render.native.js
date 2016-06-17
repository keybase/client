import React, {Component} from 'react'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'

export default class Render extends Component {
  render () {
    return (
      <Box style={{...stylesLoginForm, marginTop: this.props.justRevokedSelf ? 0 : 55}}>
        {!!this.props.justRevokedSelf &&
          <Text type='BodySemiboldItalic' style={{...stylesRevoked}}>{this.props.justRevokedSelf}<Text type='BodySemiboldItalic' style={{color: globalColors.white}}>&nbsp;was revoked successfully</Text></Text>
        }
        <Icon type='logo-160' />
        <Text style={stylesHeader} type='HeaderJumbo'>Join Keybase</Text>
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

// @flow
import Container from '../../forms/container.desktop'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {Text, Input, Button, UserCard} from '../../../common-adapters'
import {globalColors} from '../../../styles'

class PassphraseRender extends Component<void, Props, void> {
  render() {
    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.white}}
        onBack={() => this.props.onBack()}
      >
        <UserCard style={stylesCard} username={this.props.username}>
          <Text type="HeaderBig" style={{color: globalColors.orange}}>{this.props.username}</Text>
          <Input
            autoFocus={true}
            style={stylesInput}
            type="password"
            hintText="Passphrase"
            onEnterKeyDown={() => this.props.onSubmit()}
            onChangeText={text => this.props.onChange(text)}
            value={this.props.passphrase}
            errorText={this.props.error}
          />
          <Button
            waiting={this.props.waitingForResponse}
            label="Continue"
            type="Primary"
            onClick={() => this.props.onSubmit()}
            enabled={this.props.passphrase && this.props.passphrase.length}
          />
          <Text style={stylesForgot} type="BodySmallSecondaryLink" onClick={this.props.onForgotPassphrase}>
            Forgot passphrase?
          </Text>
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 40,
}
const stylesInput = {
  marginTop: 40,
  marginBottom: 48,
}
const stylesForgot = {
  marginTop: 20,
}
const stylesCard = {
  alignSelf: 'stretch',
}

export default PassphraseRender

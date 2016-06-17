// @flow
import React, {Component} from 'react'
import {Text, Input, Button, UserCard} from '../../../common-adapters'
import {globalColors} from '../../../styles/style-guide'
import {specialStyles} from '../../../common-adapters/text'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'

class Render extends Component<void, Props, void> {

  render () {
    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.lightGrey}}
        onBack={() => this.props.onBack()}>
        <UserCard style={stylesCard} username={this.props.username}>
          <Text type='HeaderBig' style={{...specialStyles.username}}>{this.props.username}</Text>
          <Input
            autoFocus
            style={stylesInput}
            type='password'
            floatingLabelText='Passphrase'
            onEnterKeyDown={() => this.props.onSubmit()}
            onChange={event => this.props.onChange(event.target.value)}
            value={this.props.passphrase}
            errorText={this.props.error} />
          <Button
            fullWidth
            waiting={this.props.waitingForResponse}
            label='Continue'
            type='Primary'
            onClick={() => this.props.onSubmit()}
            enabled={this.props.passphrase && this.props.passphrase.length} />
          <Text style={stylesForgot} type='BodySmallSecondaryLink' onClick={this.props.onForgotPassphrase}>Forgot passphrase?</Text>
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  flex: 1,
  alignItems: 'center',
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

export default Render

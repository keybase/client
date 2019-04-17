// @flow
// TODO remove Container
import Container from '../../login/forms/container'
import React, {Component} from 'react'
import {Text, Input, Button, UserCard} from '../../common-adapters'
import {globalColors} from '../../styles'

import type {Props} from '.'

class Password extends Component<Props> {
  render() {
    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.white}}
        onBack={() => this.props.onBack()}
      >
        <UserCard style={stylesCard} username={this.props.username}>
          <Text type="HeaderBig" style={{color: globalColors.orange}}>
            {this.props.username}
          </Text>
          <Input
            autoFocus={true}
            style={stylesInput}
            type="password"
            hintText="Password"
            onEnterKeyDown={() => this.props.onSubmit()}
            onChangeText={text => this.props.onChange(text)}
            value={this.props.password}
            errorText={this.props.error}
          />
          <Button
            waiting={this.props.waitingForResponse}
            label="Continue"
            onClick={() => this.props.onSubmit()}
            disabled={!(this.props.password && this.props.password.length)}
          />
          <Text style={stylesForgot} type="BodySmallSecondaryLink" onClick={this.props.onForgotPassword}>
            Forgot password?
          </Text>
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  marginTop: 40,
}
const stylesInput = {
  marginBottom: 48,
  marginTop: 40,
}
const stylesForgot = {
  marginTop: 20,
}
const stylesCard = {
  alignSelf: 'stretch',
}

export default Password

// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './username-email-form.render'
import {UserCard, Input, Button} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

class UsernameEmailFormRender extends Component {
  props: Props

  render() {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer} outerStyle={stylesOuter}>
        <UserCard style={stylesCard}>
          <Input
            autoFocus={true}
            hintText="Create a username"
            value={this.props.username}
            errorText={this.props.usernameErrorText}
            onChangeText={username => this.props.usernameChange(username)}
          />
          <Input
            hintText="Email address"
            value={this.props.email}
            errorText={this.props.emailErrorText}
            onEnterKeyDown={this.props.onSubmit}
            onChangeText={email => this.props.emailChange(email)}
          />
          <Button
            waiting={this.props.waiting}
            style={{marginTop: 40, alignSelf: 'center'}}
            type="Primary"
            label="Continue"
            onClick={this.props.onSubmit}
          />
        </UserCard>
      </Container>
    )
  }
}

const stylesOuter = {
  backgroundColor: globalColors.white,
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 15,
}
const stylesCard = {
  alignItems: 'stretch',
}

export default UsernameEmailFormRender

// @flow
// TODO remove Container
import Container from '../../login/forms/container'
import * as Constants from '../../constants/provision'
import React, {Component} from 'react'
import {Input, WaitingButton, UserCard} from '../../common-adapters'
import {globalColors} from '../../styles'

import type {Props} from '.'
type State = {usernameOrEmail: string}

class UsernameOrEmail extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {usernameOrEmail: ''}
  }

  onSubmit() {
    if (this.state.usernameOrEmail) {
      this.props.onSubmit(this.state.usernameOrEmail)
    }
  }

  onChange(usernameOrEmail: string) {
    this.setState({usernameOrEmail})
  }

  render() {
    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.white}}
        onBack={() => this.props.onBack()}
      >
        <UserCard style={stylesCard} outerStyle={stylesOuterCard}>
          <Input
            autoFocus={true}
            style={stylesInput}
            hintText="Username or email"
            errorText={
              this.props.submittedUsernameOrEmail === this.state.usernameOrEmail ? this.props.error : ''
            }
            onEnterKeyDown={() => this.onSubmit()}
            onChangeText={text => this.onChange(text)}
            value={this.state.usernameOrEmail}
          />
          <WaitingButton
            label="Continue"
            type="Primary"
            style={{alignSelf: 'center'}}
            onClick={() => this.onSubmit()}
            disabled={!this.state.usernameOrEmail}
            waitingKey={Constants.waitingKey}
          />
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
}
const stylesInput = {
  marginBottom: 48,
}
const stylesOuterCard = {
  marginTop: 40,
}
const stylesCard = {
  alignItems: 'stretch',
}

export default UsernameOrEmail

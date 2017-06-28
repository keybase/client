// @flow
import Container from '../../forms/container.desktop'
import React, {Component} from 'react'
import {Input, Button, UserCard} from '../../../common-adapters'
import {globalColors} from '../../../styles'

import type {Props} from '.'
type State = {usernameOrEmail: string}

class UsernameOrEmail extends Component<void, Props, State> {
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
            onEnterKeyDown={() => this.onSubmit()}
            onChangeText={text => this.onChange(text)}
            value={this.state.usernameOrEmail}
          />
          <Button
            label="Continue"
            type="Primary"
            style={{alignSelf: 'center'}}
            onClick={() => this.onSubmit()}
            enabled={this.state.usernameOrEmail}
            waiting={this.props.waitingForResponse}
          />
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  flex: 1,
  alignItems: 'center',
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

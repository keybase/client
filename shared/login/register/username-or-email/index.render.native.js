// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {Input, Button, UserCard} from '../../../common-adapters'
import {globalColors, globalMargins} from '../../../styles'

type State = {usernameOrEmail: string}

class UsernameOrEmailRender extends Component<void, Props, State> {
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
        onBack={this.props.onBack}
      >
        <UserCard style={stylesCard}>
          <Input
            autoFocus={true}
            style={stylesInput}
            hintText="Username or email"
            floatingHintTextOverride="Username or email"
            onChangeText={text => this.onChange(text)}
            onEnterKeyDown={() => this.onSubmit()}
            value={this.state.usernameOrEmail}
          />
          <Button
            fullWidth={true}
            label="Continue"
            type="Primary"
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
}
const stylesInput = {
  flexGrow: 1,
  marginBottom: globalMargins.small,
}
const stylesCard = {
  alignItems: 'stretch',
}

export default UsernameOrEmailRender

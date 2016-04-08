// @flow
import React, {Component} from 'react'
import {Input, Button, UserCard} from '../../../common-adapters'
import {globalColors} from '../../../styles/style-guide'
import Container from '../../forms/container'
import type {Props} from './index.render'
import {View} from 'react-native'

type State = {usernameOrEmail: string}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    console.log('in username or email native constructor')
    super(props)

    this.state = {usernameOrEmail: ''}
  }

  onSubmit () {
    if (this.state.usernameOrEmail) {
      this.props.onSubmit(this.state.usernameOrEmail)
    }
  }

  onChange (usernameOrEmail: string) {
    this.setState({usernameOrEmail})
  }

  render () {
    console.log('in username or email native constructor')
    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.lightGrey}}
        onBack={() => this.props.onBack()}>
        <UserCard style={stylesCard} outerStyle={stylesOuterCard}>
          <Input
            autoFocus
            style={stylesInput}
            floatingLabelText='Username or email'
            onEnterKeyDown={() => this.onSubmit()}
            onChange={event => this.onChange(event.target.value)}
            value={this.state.usernameOrEmail}
          />
          <Button
            fullWidth
            label='Continue'
            type='Primary'
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
  alignItems: 'center'
}
const stylesInput = {
  marginBottom: 48
}
const stylesOuterCard = {
  marginTop: 40
}
const stylesCard = {
  alignItems: 'stretch'
}

export default Render

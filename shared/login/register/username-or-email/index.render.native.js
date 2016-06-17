// @flow
import React, {Component} from 'react'
import {Input, Button, UserCard} from '../../../common-adapters'
import {globalColors} from '../../../styles/style-guide'
import Container from '../../forms/container'
import type {Props} from './index.render'

type State = {usernameOrEmail: string}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
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
    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.lightGrey, padding: 20}}
        onBack={this.props.onBack}>
        <UserCard style={stylesCard} outerStyle={stylesOuterCard}>
          <Input
            autoFocus
            style={stylesInput}
            hintText='Username or email'
            floatingLabelText='Username or email'
            onChangeText={text => this.onChange(text)}
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
}
const stylesInput = {
  flex: 1,
  marginTop: 55,
  marginBottom: 55,
}
const stylesOuterCard = {
  marginTop: 40,
}
const stylesCard = {
  alignItems: 'stretch',
}

export default Render

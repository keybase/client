// @flow
import React, {Component} from 'react'
import {Text, Icon, Input, Button} from '../../../common-adapters'
import Container from '../../forms/container.desktop'
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
        style={styles.container}
        onBack={() => this.props.onBack()}>
        <Text type='Header' style={styles.header}>Enter your username or email:</Text>
        <Icon type='fa-sign-in' style={styles.icon}/>
        <Input
          autoFocus
          style={styles.input}
          floatingLabelText='Username or email'
          onEnterKeyDown={() => this.onSubmit()}
          onChange={event => this.onChange(event.target.value)}
          value={this.state.usernameOrEmail}
        />
        <Button
          label='Continue'
          type='Primary'
          onClick={() => this.onSubmit()}
          enabled={this.state.usernameOrEmail}
          waiting={this.props.waitingForResponse}
        />
      </Container>
    )
  }
}

const styles = {
  container: {
    flex: 1,
    alignItems: 'center'
  },
  header: {
    marginTop: 80
  },
  input: {
    marginBottom: 48
  },
  icon: {
    fontSize: 30,
    marginTop: 10
  }
}

export default Render

// @flow
import React, {Component} from 'react'
import {Input, Button, UserCard} from '../../../common-adapters'
import {globalColors} from '../../../styles/style-guide'
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
        outerStyle={{backgroundColor: globalColors.lightGrey}}
        onBack={() => this.props.onBack()}>
        <UserCard outerStyle={styles.card}>
          <Input
            autoFocus
            style={styles.input}
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

const styles = {
  container: {
    flex: 1,
    alignItems: 'center'
  },
  input: {
    marginBottom: 48
  },
  icon: {
    fontSize: 30,
    marginTop: 10
  },
  card: {
    marginTop: 40
  }
}

export default Render

// @flow
import React, {Component} from 'react'
import {Text, Input, Button, UserCard} from '../../../common-adapters'
import {globalColors} from '../../../styles/style-guide'
import {specialStyles} from '../../../common-adapters/text'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'

type State = {passphrase: string}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {passphrase: ''}
  }

  onSubmit () {
    if (this.state.passphrase) {
      this.props.onSubmit(this.state.passphrase)
    }
  }

  onChange (passphrase: string) {
    this.setState({passphrase})
  }

  render () {
    return (
      <Container
        style={styles.container}
        outerStyle={{backgroundColor: globalColors.lightGrey}}
        onBack={() => this.props.onBack()}>
        <UserCard username={this.props.username}>
          <Text type='HeaderBig' style={{...specialStyles.username}}>{this.props.username}</Text>
          <Input
            autoFocus
            style={styles.input}
            type='password'
            floatingLabelText='Passphrase'
            onEnterKeyDown={() => this.onSubmit()}
            onChange={event => this.onChange(event.target.value)}
            value={this.state.passphrase}
            errorText={this.props.error}/>
          <Button
            fullWidth
            waiting={this.props.waitingForResponse}
            label='Continue'
            type='Primary'
            onClick={() => this.onSubmit()}
            enabled={this.state.passphrase}/>
          <Text style={styles.forgot} type='BodySecondaryLink' onClick={this.props.onForgotPassphrase}>Forgot passphrase?</Text>
        </UserCard>
      </Container>
    )
  }
}

const styles = {
  container: {
    flex: 1,
    alignItems: 'center',
    marginTop: 40
  },
  header: {
    marginTop: 80
  },
  input: {
    marginTop: 40,
    marginBottom: 48
  },
  icon: {
    fontSize: 30,
    marginTop: 10
  },
  forgot: {
    marginTop: 20,
    alignSelf: 'flex-end'
  }
}

export default Render

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
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.lightGrey}}
        onBack={() => this.props.onBack()}>
        <UserCard style={stylesCard} username={this.props.username}>
          <Text type='HeaderBig' style={{...specialStyles.username}}>{this.props.username}</Text>
          <Input
            autoFocus
            style={stylesInput}
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
          <Text style={stylesForgot} type='BodySecondaryLink' onClick={this.props.onForgotPassphrase}>Forgot passphrase?</Text>
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  flex: 1,
  alignItems: 'center',
  marginTop: 40
}
const stylesInput = {
  marginTop: 40,
  marginBottom: 48
}
const stylesForgot = {
  marginTop: 20
}
const stylesCard = {
  alignSelf: 'stretch'
}

export default Render

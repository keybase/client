// @flow
import React, {Component} from 'react'
import {Button, UserCard, Text, FormWithCheckbox} from '../../../common-adapters'
import {specialStyles} from '../../../common-adapters/text'
import {globalColors} from '../../../styles/style-guide'
import Container from '../../forms/container'
import type {Props} from './index.render'

type State = {passphrase: string}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {passphrase: ''}
  }

  onSubmit () {
    if (this.state.usernameOrEmail) {
      this.props.onSubmit(this.state.passphrase)
    }
  }

  onChange (passphrase: string) {
    console.log('p:', passphrase)
    this.setState({passphrase})
  }

  render () {
    const {saveInKeychain, showTyping, toggleSaveInKeychain, toggleShowTyping} = this.props

    return (
      <Container
        style={stylesContainer}
        outerStyle={{backgroundColor: globalColors.lightGrey, padding: 0}}
        onBack={this.props.onBack}>
        <UserCard style={stylesCard} username={this.props.username}>
          <Text type='HeaderBig' style={{...specialStyles.username, ...usernameStyle}}>{this.props.username}</Text>
          <FormWithCheckbox
            style={stylesInput}
            inputProps={{
              autoFocus: true,
              type: 'password',
              floatingLabelText: 'Passphrase',
              onEnterKeyDown: this.onSubmit,
              onChangeText: t => this.onChange(t),
              value: this.state.passphrase,
              errorText: this.props.error
            }}
            checkboxesProps={[
              {label: 'Save in keychain', checked: !!(saveInKeychain), onCheck: toggleSaveInKeychain},
              {label: 'Show typing', checked: !!(showTyping), onCheck: toggleShowTyping}
            ]}/>

          <Button
            fullWidth
            waiting={this.props.waitingForResponse}
            label='Continue'
            type='Primary'
            onClick={() => this.onSubmit(this.state.passphrase)}
            enabled={this.state.passphrase.length}/>
          <Text style={stylesForgot} type='BodySecondaryLink' onClick={this.props.onForgotPassphrase}>Forgot passphrase?</Text>
        </UserCard>
      </Container>
    )
  }
}

const stylesContainer = {
  flex: 1,
  marginTop: 40
}
const stylesInput = {
  flex: 1,
  marginTop: 40,
  paddingBottom: 30
}
const stylesForgot = {
  marginTop: 20
}
const stylesCard = {
  alignItems: 'stretch'
}

const usernameStyle = {
  marginTop: 30,
  textAlign: 'center'
}

export default Render

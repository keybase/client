// @flow
import React, {Component} from 'react'
import {UserCard, Text, Button, FormWithCheckbox, Dropdown} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'
import type {Props} from './index.render'

type State = {
  selectedUser: ?string,
  error: ?string,
  saveInKeychain: boolean,
  showTyping: boolean,
  passphrase: string
}

export default class LoginRender extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      selectedUser: props.lastUser,
      error: props.error,
      saveInKeychain: true,
      showTyping: false,
      passphrase: ''
    }
  }

  onSubmit () {
    if (this.state.selectedUser) {
      this.props.onLogin(this.state.selectedUser, this.state.passphrase, this.state.saveInKeychain)
    }
  }

  render () {
    const inputProps = {
      floatingLabelText: 'Passphrase',
      style: {marginBottom: 0},
      onChange: event => this.setState({passphrase: event.target.value}),
      onEnterKeyDown: () => this.onSubmit(),
      type: this.state.showTyping ? 'text' : 'password',
      errorText: this.state.error
    }

    const checkboxProps = [
      {label: 'Save in Keychain', checked: this.state.saveInKeychain, onCheck: check => { this.setState({saveInKeychain: check}) }, style: {marginRight: 13}},
      {label: 'Show Typing', checked: this.state.showTyping, onCheck: check => { this.setState({showTyping: check}) }}
    ]

    return (
      <div style={styles.container}>
        <UserCard username={this.state.selectedUser} outerStyle={styles.card}>
          <Dropdown
            type='Username'
            value={this.state.selectedUser}
            onClick={selectedUser => this.setState({selectedUser})}
            onOther={() => this.props.onSomeoneElse()}
            options={this.props.users} />
          <FormWithCheckbox
            style={{alignSelf: 'stretch'}}
            inputProps={inputProps}
            checkboxesProps={checkboxProps}
          />
          <Button
            waiting={this.props.waitingForResponse}
            style={{marginTop: 0}}
            fullWidth
            type='Primary'
            label='Log in'
            onClick={() => this.onSubmit()} />
          <Text link type='BodySecondaryLink' style={{marginTop: 24}}>Forgot passphrase?</Text>
        </UserCard>
        <Text style={{marginTop: 30}} type='BodyPrimaryLink' onClick={this.props.onSignup}>Create an account</Text>
      </div>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    backgroundColor: globalColors.black10
  },
  card: {
    marginTop: 115
  }
}

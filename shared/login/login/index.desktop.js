// @flow
import React, {Component} from 'react'
import {Box, UserCard, Text, Button, FormWithCheckbox, Dropdown} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from '.'

class LoginRender extends Component<void, Props, void> {
  render() {
    const inputProps = {
      hintText: 'Passphrase',
      floatingHintTextOverride: '',
      style: {marginBottom: 0},
      onChangeText: passphrase => this.props.passphraseChange(passphrase),
      type: this.props.showTyping ? 'passwordVisible' : 'password',
      onEnterKeyDown: () => this.props.onSubmit(),
      errorText: this.props.error,
      autoFocus: true,
      value: this.props.passphrase,
    }

    const checkboxProps = [
      {
        label: 'Show typing',
        checked: this.props.showTyping,
        onCheck: check => {
          this.props.showTypingChange(check)
        },
      },
    ]

    return (
      <Box style={stylesContainer}>
        <UserCard username={this.props.selectedUser}>
          <Dropdown
            type="Username"
            value={this.props.selectedUser}
            onClick={selectedUser => this.props.selectedUserChange(selectedUser)}
            onOther={() => this.props.onSomeoneElse()}
            options={this.props.users}
          />
          <FormWithCheckbox
            style={{alignSelf: 'stretch'}}
            inputProps={inputProps}
            checkboxesProps={checkboxProps}
          />
          <Button
            waiting={this.props.waitingForResponse}
            style={{marginTop: 0}}
            type="Primary"
            label="Log in"
            onClick={() => this.props.onSubmit()}
          />
          <Text
            link={true}
            type="BodySmallSecondaryLink"
            onClick={this.props.onForgotPassphrase}
            style={{marginTop: 24}}
          >
            Forgot passphrase?
          </Text>
        </UserCard>
        <Text style={{marginTop: 30}} type="BodyPrimaryLink" onClick={this.props.onSignup}>
          Create an account
        </Text>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  backgroundColor: globalColors.white,
}

export default LoginRender

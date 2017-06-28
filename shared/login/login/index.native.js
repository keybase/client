// @flow
import React, {Component} from 'react'
import {
  Box,
  UserCard,
  Text,
  Button,
  FormWithCheckbox,
  Dropdown,
  NativeScrollView,
} from '../../common-adapters/index.native'
import {globalStyles, globalMargins, globalColors} from '../../styles'

import type {Props} from '.'

class LoginRender extends Component<void, Props, void> {
  render() {
    const inputProps = {
      hintText: 'Passphrase',
      style: {marginBottom: 0},
      onChangeText: passphrase => this.props.passphraseChange(passphrase),
      type: this.props.showTyping ? 'passwordVisible' : 'password',
      onEnterKeyDown: () => this.props.onSubmit(),
      errorText: this.props.error,
      autoFocus: true,
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
      <NativeScrollView>
        <Box style={styles.container}>
          <UserCard username={this.props.selectedUser} outerStyle={styles.card}>
            <Dropdown
              type="Username"
              value={this.props.selectedUser}
              onClick={this.props.selectedUserChange}
              onOther={this.props.onSomeoneElse}
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
              fullWidth={true}
              type="Primary"
              label="Log in"
              onClick={this.props.onSubmit}
            />
            <Text
              link={true}
              type="BodySmallSecondaryLink"
              onClick={this.props.onForgotPassphrase}
              style={{marginTop: globalMargins.medium, textAlign: 'center'}}
            >
              Forgot passphrase?
            </Text>
          </UserCard>
          <Text style={{marginTop: globalMargins.xlarge}} type="BodyBigLink" onClick={this.props.onSignup}>
            Create an account
          </Text>
          <Text
            style={{margin: globalMargins.small, marginTop: globalMargins.large, alignSelf: 'flex-end'}}
            type="BodySmallPrimaryLink"
            onClick={this.props.onFeedback}
          >
            Problems logging in?
          </Text>
        </Box>
      </NativeScrollView>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    backgroundColor: globalColors.white,
  },
  card: {
    marginTop: globalMargins.tiny,
    width: '100%',
  },
}

export default LoginRender

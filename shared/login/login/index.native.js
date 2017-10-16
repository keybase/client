// @flow
import React, {Component} from 'react'
import {
  Box,
  UserCard,
  Text,
  Button,
  FormWithCheckbox,
  NativeScrollView,
} from '../../common-adapters/index.native'
import {isDeviceSecureAndroid, isAndroidNewerThanM, isAndroid} from '../../constants/platform'
import Dropdown from './dropdown.native'
import {globalStyles, globalMargins, globalColors} from '../../styles'

import type {Props} from '.'

class LoginRender extends Component<Props> {
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
          {isAndroid &&
            !isDeviceSecureAndroid &&
            !isAndroidNewerThanM &&
            <Box style={deviceNotSecureStyle}>
              <Text type="Body" backgroundMode="Information" style={{flex: 1, textAlign: 'center'}}>
                Since you don't have a lock screen, you'll have to type your passphrase everytime.
              </Text>
            </Box>}
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
            style={{margin: globalMargins.small, marginTop: globalMargins.large, alignSelf: 'center'}}
            type="BodySmallSecondaryLink"
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
    marginTop: globalMargins.medium,
    width: '100%',
  },
}

const deviceNotSecureStyle = {
  alignSelf: 'stretch',
  backgroundColor: globalColors.yellow,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
}

export default LoginRender

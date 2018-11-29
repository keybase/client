// @flow
import * as Constants from '../../constants/login'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import Dropdown from './dropdown.native'
import React, {Component} from 'react'
import {isDeviceSecureAndroid, isAndroidNewerThanM, isAndroid} from '../../constants/platform.native'
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
      key: this.props.inputKey,
      autoFocus: true,
      // There is a weird bug with RN 0.54+ where if this is controlled it somehow causes a race which causes a crash
      // making this uncontrolled fixes this
      uncontrolled: true,
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
      <Kb.NativeScrollView>
        <Kb.Box style={styles.container}>
          {isAndroid && !isDeviceSecureAndroid && !isAndroidNewerThanM && (
            <Kb.Box style={deviceNotSecureStyle}>
              <Kb.Text type="Body" backgroundMode="Information" style={{flex: 1, textAlign: 'center'}}>
                Since you don't have a lock screen, you'll have to type your passphrase everytime.
              </Kb.Text>
            </Kb.Box>
          )}
          <Kb.UserCard username={this.props.selectedUser} outerStyle={styles.card}>
            <Dropdown
              type="Username"
              value={this.props.selectedUser}
              onClick={this.props.selectedUserChange}
              onOther={this.props.onSomeoneElse}
              options={this.props.users}
            />
            <Kb.FormWithCheckbox
              style={{alignSelf: 'stretch'}}
              inputProps={inputProps}
              checkboxesProps={checkboxProps}
            />
            <Kb.WaitingButton
              waitingKey={Constants.waitingKey}
              style={{marginTop: 0}}
              fullWidth={true}
              type="Primary"
              label="Log in"
              onClick={this.props.onSubmit}
            />
            <Kb.Text
              link={true}
              type="BodySmallSecondaryLink"
              onClick={this.props.onForgotPassphrase}
              style={{marginTop: Styles.globalMargins.medium, textAlign: 'center'}}
            >
              Forgot passphrase?
            </Kb.Text>
          </Kb.UserCard>
          <Kb.Text
            style={{marginTop: Styles.globalMargins.xlarge}}
            type="BodyBigLink"
            onClick={this.props.onSignup}
          >
            Create an account
          </Kb.Text>
          <Kb.Text
            style={{
              margin: Styles.globalMargins.small,
              marginTop: Styles.globalMargins.large,
              alignSelf: 'center',
            }}
            type="BodySmallSecondaryLink"
            onClick={this.props.onFeedback}
          >
            Problems logging in?
          </Kb.Text>
        </Kb.Box>
      </Kb.NativeScrollView>
    )
  }
}

const styles = {
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    backgroundColor: Styles.globalColors.white,
  },
  card: {
    marginTop: Styles.globalMargins.medium,
    width: '100%',
  },
}

const deviceNotSecureStyle = {
  alignSelf: 'stretch',
  backgroundColor: Styles.globalColors.yellow,
  paddingTop: Styles.globalMargins.tiny,
  paddingBottom: Styles.globalMargins.tiny,
}

export default LoginRender

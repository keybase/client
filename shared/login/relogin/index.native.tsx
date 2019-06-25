import * as Constants from '../../constants/login'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import Dropdown from './dropdown.native'
import * as React from 'react'
import {isDeviceSecureAndroid, isAndroidNewerThanM, isAndroid} from '../../constants/platform.native'
import {Props} from '.'

class LoginRender extends React.Component<Props> {
  _inputRef = React.createRef<Kb.Input>()

  _focusInput = () => {
    if (this._inputRef.current) {
      this._inputRef.current.focus()
    }
  }

  _selectedUserChange = selectedUser => {
    this.props.selectedUserChange(selectedUser)
    // For some reason, calling this immediately doesn't work, at
    // least on iOS.
    setImmediate(this._focusInput)
  }

  render() {
    const inputProps = {
      autoFocus: true,
      errorText: this.props.inputError ? this.props.error : '',
      hintText: 'Password',
      key: this.props.inputKey,
      onChangeText: password => this.props.passwordChange(password),
      onEnterKeyDown: () => this.props.onSubmit(),
      ref: this._inputRef,
      style: {marginBottom: 0},
      type: this.props.showTyping ? 'passwordVisible' : 'password',
      // There is a weird bug with RN 0.54+ where if this is controlled it somehow causes a race which causes a crash
      // making this uncontrolled fixes this
      uncontrolled: true,
    }

    const checkboxProps = [
      {
        checked: this.props.showTyping,
        label: 'Show typing',
        onCheck: check => {
          this.props.showTypingChange(check)
        },
      },
    ]

    return (
      <Kb.NativeScrollView>
        <Kb.Box style={styles.container}>
          {isAndroid && !isDeviceSecureAndroid && !isAndroidNewerThanM && (
            <Kb.Box style={styles.deviceNotSecureContainer}>
              <Kb.Text center={true} type="Body" negative={true} style={styles.deviceNotSecureText}>
                Since you don't have a lock screen, you'll have to type your password everytime.
              </Kb.Text>
            </Kb.Box>
          )}
          {this.props.bannerError && <Kb.Banner text={this.props.error} color="red" />}
          <Kb.UserCard username={this.props.selectedUser} outerStyle={styles.card}>
            <Dropdown
              type="Username"
              value={this.props.selectedUser}
              onClick={this._selectedUserChange}
              onOther={this.props.onSomeoneElse}
              options={this.props.users}
            />
            <Kb.FormWithCheckbox
              style={{alignSelf: 'stretch'}}
              inputProps={inputProps}
              checkboxesProps={checkboxProps}
            />
            <Kb.WaitingButton
              disabled={!this.props.password}
              waitingKey={Constants.waitingKey}
              style={{marginTop: 0, width: '100%'}}
              fullWidth={true}
              label="Log in"
              onClick={this.props.onSubmit}
            />
            <Kb.Text
              type="BodySmallSecondaryLink"
              center={true}
              onClick={this.props.onForgotPassword}
              style={{marginTop: Styles.globalMargins.medium}}
            >
              Forgot password?
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
              alignSelf: 'center',
              margin: Styles.globalMargins.small,
              marginTop: Styles.globalMargins.large,
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
  card: {
    marginTop: Styles.globalMargins.medium,
    width: '100%',
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    flex: 1,
  },
  deviceNotSecureContainer: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.yellow,
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  deviceNotSecureText: {
    color: Styles.globalColors.brown_75,
  },
}

export default LoginRender

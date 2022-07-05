import * as Constants from '../../constants/login'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import UserCard from '../user-card'
import {Props as InputProps} from '../../common-adapters/labeled-input'
import Dropdown from './dropdown.native'
import * as React from 'react'
import {isDeviceSecureAndroid, isAndroidNewerThanM, isAndroid} from '../../constants/platform.native'
import {Props} from '.'

type State = {
  scrollViewHeight?: number
}

class LoginRender extends React.Component<Props, State> {
  state = {scrollViewHeight: undefined}

  _selectedUserChange = selectedUser => {
    this.props.selectedUserChange(selectedUser)
  }

  render() {
    const inputProps: InputProps = {
      autoFocus: true,
      error: !!this.props.error,
      keyboardType: this.props.showTyping && Styles.isAndroid ? 'visible-password' : 'default',
      onChangeText: password => this.props.passwordChange(password),
      onEnterKeyDown: () => this.props.onSubmit(),
      placeholder: 'Password',
      secureTextEntry: !this.props.showTyping,
      type: this.props.showTyping ? 'text' : 'password',
    }

    return (
      <Kb.Box
        onLayout={evt => this.setState({scrollViewHeight: evt.nativeEvent.layout.height})}
        style={Styles.globalStyles.flexOne}
      >
        <Kb.NativeScrollView
          style={styles.scrollView}
          contentContainerStyle={{minHeight: this.state.scrollViewHeight}}
        >
          <Kb.Box style={styles.container}>
            {isAndroid && !isDeviceSecureAndroid && !isAndroidNewerThanM && (
              <Kb.Box style={styles.deviceNotSecureContainer}>
                <Kb.Text center={true} type="Body" negative={true} style={styles.deviceNotSecureText}>
                  Since you don't have a lock screen, you'll have to type your password everytime.
                </Kb.Text>
              </Kb.Box>
            )}
            {!!this.props.error && <Kb.Banner color="red">{this.props.error}</Kb.Banner>}
            <UserCard username={this.props.selectedUser} outerStyle={styles.card} style={styles.cardInner}>
              <Dropdown
                type="Username"
                value={this.props.selectedUser}
                onClick={this._selectedUserChange}
                onOther={this.props.onSomeoneElse}
                options={this.props.users}
              />
              {this.props.needPassword && (
                <Kb.Box2 direction="vertical" gap="tiny" gapEnd={true} gapStart={true} fullWidth={true}>
                  <Kb.LabeledInput {...inputProps} />
                  <Kb.Checkbox
                    checked={this.props.showTyping}
                    label="Show typing"
                    onCheck={check => this.props.showTypingChange(check)}
                    style={styles.formElements}
                  />
                </Kb.Box2>
              )}
              <Kb.WaitingButton
                disabled={this.props.needPassword && !this.props.password}
                waitingKey={Constants.waitingKey}
                style={{marginTop: this.props.needPassword ? 0 : Styles.globalMargins.small, width: '100%'}}
                fullWidth={true}
                label="Log in"
                onClick={this.props.onSubmit}
              />
              <Kb.Text
                type="BodySmallSecondaryLink"
                center={true}
                onClick={this.props.onForgotPassword}
                style={{marginBottom: Styles.globalMargins.tiny, marginTop: Styles.globalMargins.medium}}
              >
                Forgot password?
              </Kb.Text>
              <Kb.Text
                style={{
                  alignSelf: 'center',
                }}
                type="BodySmallSecondaryLink"
                onClick={this.props.onFeedback}
              >
                Problems logging in?
              </Kb.Text>
            </UserCard>
            <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne} />
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.createAccountContainer}>
              <Kb.Button
                fullWidth={true}
                label="Create an account"
                mode="Secondary"
                onClick={this.props.onSignup}
                style={{flexGrow: 0}}
              />
            </Kb.Box2>
          </Kb.Box>
        </Kb.NativeScrollView>
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      card: {
        marginTop: Styles.globalMargins.medium,
        width: '100%',
      },
      cardInner: Styles.platformStyles({
        isTablet: {paddingBottom: 0},
      }),
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.blueGrey,
        flex: 1,
      },
      createAccountContainer: Styles.platformStyles({
        common: {padding: Styles.globalMargins.medium},
        isTablet: {maxWidth: 410, padding: Styles.globalMargins.small},
      }),
      deviceNotSecureContainer: {
        alignSelf: 'stretch',
        backgroundColor: Styles.globalColors.yellow,
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
      deviceNotSecureText: {
        color: Styles.globalColors.brown_75,
      },
      formElements: {
        marginBottom: Styles.globalMargins.tiny,
      },
      scrollView: {
        backgroundColor: Styles.globalColors.blueGrey,
      },
    } as const)
)

export default LoginRender

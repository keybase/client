import * as C from '@/constants'
import * as ConfigConstants from '@/constants/config'
import * as Kb from '@/common-adapters'
import NativeScrollView from '@/common-adapters/scroll-view.native'
import * as React from 'react'
import Dropdown from './dropdown.native'
import UserCard from '../user-card'
import type {Props as InputProps} from '@/common-adapters/labeled-input'
import type {Props} from '.'

type State = {
  scrollViewHeight?: number
}

class LoginRender extends React.Component<Props, State> {
  state = {scrollViewHeight: undefined}

  _selectedUserChange = (selectedUser: string) => {
    this.props.selectedUserChange(selectedUser)
  }

  render() {
    const inputProps: InputProps = {
      autoFocus: true,
      error: !!this.props.error,
      keyboardType: this.props.showTyping && C.isAndroid ? 'visible-password' : 'default',
      onChangeText: password => this.props.passwordChange(password),
      onEnterKeyDown: () => this.props.onSubmit(),
      placeholder: 'Password',
      secureTextEntry: !this.props.showTyping,
      type: this.props.showTyping ? 'text' : 'password',
    }

    return (
      <Kb.Box
        onLayout={evt => this.setState({scrollViewHeight: evt.nativeEvent.layout.height})}
        style={Kb.Styles.globalStyles.flexOne}
      >
        <NativeScrollView
          style={styles.scrollView}
          contentContainerStyle={{minHeight: this.state.scrollViewHeight}}
        >
          <Kb.Box style={styles.container}>
            {C.isAndroid && !C.isDeviceSecureAndroid && !C.isAndroidNewerThanM && (
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
                waitingKey={ConfigConstants.loginWaitingKey}
                style={{
                  marginTop: this.props.needPassword ? 0 : Kb.Styles.globalMargins.small,
                  width: '100%',
                }}
                fullWidth={true}
                label="Log in"
                onClick={this.props.onSubmit}
              />
              <Kb.Text
                type="BodySmallSecondaryLink"
                center={true}
                onClick={this.props.onForgotPassword}
                style={{
                  marginBottom: Kb.Styles.globalMargins.tiny,
                  marginTop: Kb.Styles.globalMargins.medium,
                }}
              >
                Forgot password?
              </Kb.Text>
              <Kb.Text center={true} type="BodySmallSecondaryLink" onClick={this.props.onFeedback}>
                Problems logging in?
              </Kb.Text>
            </UserCard>
            <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} />
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.createAccountContainer}>
              <Kb.Button
                fullWidth={true}
                label="Create account"
                mode="Secondary"
                onClick={this.props.onSignup}
                style={{flexGrow: 0}}
              />
            </Kb.Box2>
          </Kb.Box>
        </NativeScrollView>
      </Kb.Box>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      card: {
        marginTop: Kb.Styles.globalMargins.medium,
        width: '100%',
      },
      cardInner: Kb.Styles.platformStyles({
        isTablet: {paddingBottom: 0},
      }),
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        flex: 1,
      },
      createAccountContainer: Kb.Styles.platformStyles({
        common: {padding: Kb.Styles.globalMargins.medium},
        isTablet: {maxWidth: 410, padding: Kb.Styles.globalMargins.small},
      }),
      deviceNotSecureContainer: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.yellow,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      deviceNotSecureText: {
        color: Kb.Styles.globalColors.brown_75,
      },
      formElements: {
        marginBottom: Kb.Styles.globalMargins.tiny,
      },
      scrollView: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
      },
    }) as const
)

export default LoginRender

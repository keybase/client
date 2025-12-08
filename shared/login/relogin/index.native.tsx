import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import NativeScrollView from '@/common-adapters/scroll-view.native'
import * as React from 'react'
import Dropdown from './dropdown.native'
import UserCard from '../user-card'
import type {Props as InputProps} from '@/common-adapters/labeled-input'
import type {Props} from '.'

const LoginRender = (props: Props) => {
  const [scrollViewHeight, setScrollViewHeight] = React.useState<number | undefined>(undefined)
  const inputProps: InputProps = {
    autoFocus: true,
    error: !!props.error,
    keyboardType: props.showTyping && C.isAndroid ? 'visible-password' : 'default',
    onChangeText: password => props.passwordChange(password),
    onEnterKeyDown: () => props.onSubmit(),
    placeholder: 'Password',
    secureTextEntry: !props.showTyping,
    type: props.showTyping ? 'text' : 'password',
  }

  return (
    <Kb.Box
      onLayout={evt => setScrollViewHeight(evt.nativeEvent.layout.height)}
      style={Kb.Styles.globalStyles.flexOne}
    >
      <NativeScrollView style={styles.scrollView} contentContainerStyle={{minHeight: scrollViewHeight}}>
        <Kb.Box style={styles.container}>
          {C.isAndroid && !C.isDeviceSecureAndroid && !C.isAndroidNewerThanM && (
            <Kb.Box style={styles.deviceNotSecureContainer}>
              <Kb.Text center={true} type="Body" negative={true} style={styles.deviceNotSecureText}>
                {"Since you don't have a lock screen, you'll have to type your password everytime."}
              </Kb.Text>
            </Kb.Box>
          )}
          {!!props.error && <Kb.Banner color="red">{props.error}</Kb.Banner>}
          <UserCard username={props.selectedUser} outerStyle={styles.card} style={styles.cardInner}>
            <Dropdown
              type="Username"
              value={props.selectedUser}
              onClick={props.selectedUserChange}
              onOther={props.onSomeoneElse}
              options={props.users}
            />
            {props.needPassword && (
              <Kb.Box2 direction="vertical" gap="tiny" gapEnd={true} gapStart={true} fullWidth={true}>
                <Kb.LabeledInput {...inputProps} />
                <Kb.Checkbox
                  checked={props.showTyping}
                  label="Show typing"
                  onCheck={check => props.showTypingChange(check)}
                  style={styles.formElements}
                />
              </Kb.Box2>
            )}
            <Kb.WaitingButton
              disabled={props.needPassword && !props.password}
              waitingKey={C.waitingKeyConfigLogin}
              style={{
                marginTop: props.needPassword ? 0 : Kb.Styles.globalMargins.small,
                width: '100%',
              }}
              fullWidth={true}
              label="Log in"
              onClick={props.onSubmit}
            />
            <Kb.Text
              type="BodySmallSecondaryLink"
              center={true}
              onClick={props.onForgotPassword}
              style={{
                marginBottom: Kb.Styles.globalMargins.tiny,
                marginTop: Kb.Styles.globalMargins.medium,
              }}
            >
              Forgot password?
            </Kb.Text>
            <Kb.Text center={true} type="BodySmallSecondaryLink" onClick={props.onFeedback}>
              Problems logging in?
            </Kb.Text>
          </UserCard>
          <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} />
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.createAccountContainer}>
            <Kb.Button
              fullWidth={true}
              label="Create account"
              mode="Secondary"
              onClick={props.onSignup}
              style={{flexGrow: 0}}
            />
          </Kb.Box2>
        </Kb.Box>
      </NativeScrollView>
    </Kb.Box>
  )
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

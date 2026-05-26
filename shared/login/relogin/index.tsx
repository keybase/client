import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import UserCard from '../user-card'
import {errorBanner, SignupScreen} from '@/signup/common'
import {isAndroidNewerThanM} from '@/constants/platform'
import Dropdown from './dropdown.native'
type Props = {
  users: Array<T.Config.ConfiguredAccount>
  onForgotPassword: () => void
  onSignup: () => void
  onSomeoneElse: () => void
  error: string
  needPassword: boolean
  password: string
  showTyping: boolean
  selectedUser: string
  selectedUserChange: (selectedUser: string) => void
  passwordChange: (password: string) => void
  showTypingChange: (typingChange: boolean) => void
  onSubmit: () => void
  onFeedback: () => void
  onLogin: (user: string, password: string) => void
}

// Desktop login

const other = 'Someone else...'

const UserRow = ({user, hasStoredSecret}: {user: string; hasStoredSecret: boolean}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={desktopStyles.userRow} gap="xtiny">
    <Kb.Text type="Header" style={user === other ? desktopStyles.other : desktopStyles.provisioned}>
      {user}
    </Kb.Text>
    {hasStoredSecret && <Kb.Text type="BodySmall"> • Signed in</Kb.Text>}
  </Kb.Box2>
)

const DesktopLogin = (props: Props) => {
  const _inputRef = React.useRef<Kb.Input3Ref>(null)

  const _onClickUserIdx = (selected: number) => {
    const user = props.users.at(selected)
    if (!user) {
      props.onSomeoneElse()
    } else {
      props.selectedUserChange(user.username)
      if (_inputRef.current) {
        _inputRef.current.focus()
      }
    }
  }

  const userRows = props.users
    .concat({hasStoredSecret: false, uid: '', username: other})
    .map(u => <UserRow user={u.username} key={u.username} hasStoredSecret={u.hasStoredSecret} />)

  const selectedIdx = props.users.findIndex(u => u.username === props.selectedUser)
  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      headerStyle={desktopStyles.header}
      onRightAction={props.onSignup}
      rightActionLabel="Create account"
      title="Log in"
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} flex={1} style={desktopStyles.contentBox}>
        <UserCard username={props.selectedUser} outerStyle={desktopStyles.container} style={desktopStyles.userContainer}>
          <Kb.Dropdown
            onChangedIdx={_onClickUserIdx}
            selected={userRows[selectedIdx]}
            items={userRows}
            overlayStyle={desktopStyles.userOverlayStyle}
            position="bottom center"
            style={desktopStyles.userDropdown}
          />
          {props.needPassword && (
            <Kb.Box2 direction="horizontal" fullWidth={true} flex={1} style={desktopStyles.inputRow}>
              <Kb.Input3
                autoFocus={true}
                placeholder="Password"
                onChangeText={props.passwordChange}
                onEnterKeyDown={props.onSubmit}
                ref={_inputRef}
                secureTextEntry={true}
                value={props.password}
              />
            </Kb.Box2>
          )}
          <Kb.Box2 direction="horizontal" fullWidth={true} justifyContent="flex-end" flex={1}>
            <Kb.Text
              type="BodySmallSecondaryLink"
              onClick={props.onForgotPassword}
              style={desktopStyles.forgotPassword}
            >
              Forgot password?
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2
            direction="vertical"
            fullWidth={true}
            fullHeight={true}
            justifyContent="flex-end"
            flex={1}
          >
            <Kb.WaitingButton
              disabled={props.needPassword && !props.password}
              fullWidth={true}
              waitingKey={C.waitingKeyConfigLogin}
              style={desktopStyles.loginSubmitButton}
              label="Log in"
              onClick={props.onSubmit}
            />
          </Kb.Box2>
        </UserCard>
      </Kb.Box2>
    </SignupScreen>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
      },
      contentBox: {
        alignSelf: 'center',
        maxWidth: 460,
        padding: Kb.Styles.globalMargins.small,
      },
      forgotPassword: {
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      header: {
        borderBottomWidth: 0,
      },
      inputRow: {
        marginBottom: 0,
        marginTop: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },
      loginSubmitButton: {
        marginTop: 0,
        maxHeight: 32,
        width: '100%',
      },
      other: {color: Kb.Styles.globalColors.black},
      provisioned: {color: Kb.Styles.globalColors.orange},
      userContainer: {
        backgroundColor: Kb.Styles.globalColors.transparent,
        flex: 1,
      },
      userDropdown: {
        backgroundColor: Kb.Styles.globalColors.white,
        width: '100%',
      },
      userOverlayStyle: {
        backgroundColor: Kb.Styles.globalColors.white,
        width: 348,
      },
      userRow: {
        alignItems: 'center',
        marginLeft: Kb.Styles.globalMargins.xsmall,
        minHeight: 40,
        width: '100%',
      },
    }) as const
)

// Native login

const NativeLoginRender = (props: Props) => {
  const [scrollViewHeight, setScrollViewHeight] = React.useState<number | undefined>(undefined)
  const inputProps = {
    autoFocus: true,
    error: !!props.error,
    keyboardType: props.showTyping && isAndroid ? 'visible-password' : 'default',
    onChangeText: (password: string) => props.passwordChange(password),
    onEnterKeyDown: () => props.onSubmit(),
    placeholder: 'Password',
    secureTextEntry: !props.showTyping,
  } as const

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      onLayout={evt => setScrollViewHeight(evt.nativeEvent.layout.height)}
      style={Kb.Styles.globalStyles.flexOne}
    >
      <Kb.ScrollView style={nativeStyles.scrollView} contentContainerStyle={{minHeight: scrollViewHeight}}>
        <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" flex={1} style={nativeStyles.container}>
          {isAndroid && !C.isDeviceSecureAndroid && !isAndroidNewerThanM && (
            <Kb.Box2 direction="vertical" fullWidth={true} style={nativeStyles.deviceNotSecureContainer}>
              <Kb.Text center={true} type="Body" negative={true} style={nativeStyles.deviceNotSecureText}>
                {"Since you don't have a lock screen, you'll have to type your password everytime."}
              </Kb.Text>
            </Kb.Box2>
          )}
          {!!props.error && <Kb.Banner color="red">{props.error}</Kb.Banner>}
          <UserCard username={props.selectedUser} outerStyle={nativeStyles.card} style={nativeStyles.cardInner}>
            <Dropdown
              type="Username"
              value={props.selectedUser}
              onClick={props.selectedUserChange}
              onOther={props.onSomeoneElse}
              options={props.users}
            />
            {props.needPassword && (
              <Kb.Box2 direction="vertical" gap="tiny" gapEnd={true} gapStart={true} fullWidth={true}>
                <Kb.Input3 {...inputProps} />
                <Kb.Checkbox
                  checked={props.showTyping}
                  label="Show typing"
                  onCheck={check => props.showTypingChange(check)}
                  style={nativeStyles.formElements}
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
          <Kb.Box2 direction="vertical" fullWidth={true} style={nativeStyles.createAccountContainer}>
            <Kb.Button
              fullWidth={true}
              label="Create account"
              mode="Secondary"
              onClick={props.onSignup}
              style={{flexGrow: 0}}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const nativeStyles = Kb.Styles.styleSheetCreate(
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
        backgroundColor: Kb.Styles.globalColors.blueGrey,
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

export default isMobile ? NativeLoginRender : DesktopLogin

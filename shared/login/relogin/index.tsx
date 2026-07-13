import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import UserCard from '../user-card'
import {produce} from 'immer'
import sortBy from 'lodash/sortBy'
import {errorBanner, SignupScreen} from '@/signup/common'
import {isAndroidNewerThanM} from '@/constants/platform'
import {useConfigState} from '@/stores/config'
import {startRecoverPassword} from '@/login/recover-password/flow'
import useRequestAutoInvite from '@/signup/use-request-auto-invite'
import {startProvision} from '@/provision/flow'
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
}

// Desktop login

const other = 'Someone else...'

const UserRow = ({user, hasStoredSecret}: {user: string; hasStoredSecret: boolean}) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    alignItems="center"
    style={desktopStyles.userRow}
    gap="xtiny"
  >
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
    <SignupScreen banners={errorBanner(props.error)} hideDesktopHeader={!isMobile}>
      <Kb.Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        flex={1}
        alignSelf="center"
        padding="small"
        style={desktopStyles.contentBox}
      >
        <UserCard
          username={props.selectedUser}
          outerStyle={desktopStyles.container}
          style={desktopStyles.userContainer}
        >
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
          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} justifyContent="flex-end" flex={1}>
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
        // UserCard's own desktop container already provides flexBoxColumn + alignItems center
        flex: 1,
        justifyContent: 'center',
      },
      contentBox: {
        maxWidth: 460,
      },
      forgotPassword: {
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      inputRow: {
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      loginSubmitButton: {
        maxHeight: 32,
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
        marginLeft: Kb.Styles.globalMargins.xsmall,
        minHeight: 40,
      },
    }) as const
)

// Native login

const NativeLoginRender = (props: Props) => {
  const {passwordChange, onSubmit} = props

  const inputProps = {
    autoFocus: true,
    error: !!props.error,
    keyboardType: props.showTyping && isAndroid ? 'visible-password' : 'default',
    onChangeText: (password: string) => passwordChange(password),
    onEnterKeyDown: () => onSubmit(),
    placeholder: 'Password',
    secureTextEntry: !props.showTyping,
  } as const

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      alignItems="center"
      flex={1}
      style={nativeStyles.container}
    >
      {isAndroid && !C.isDeviceSecureAndroid && !isAndroidNewerThanM && (
        <Kb.Box2 direction="vertical" fullWidth={true} style={nativeStyles.deviceNotSecureContainer}>
          <Kb.Text center={true} type="Body" negative={true} style={nativeStyles.deviceNotSecureText}>
            {"Since you don't have a lock screen, you'll have to type your password everytime."}
          </Kb.Text>
        </Kb.Box2>
      )}
      <Kb.ErrorBanner error={props.error} />
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
          style={props.needPassword ? undefined : nativeStyles.loginButtonGap}
          fullWidth={true}
          label="Log in"
          onClick={props.onSubmit}
        />
        <Kb.Text
          type="BodySmallSecondaryLink"
          center={true}
          onClick={props.onForgotPassword}
          style={nativeStyles.forgotPassword}
        >
          Forgot password?
        </Kb.Text>
        <Kb.Text center={true} type="BodySmallSecondaryLink" onClick={props.onFeedback}>
          Problems logging in?
        </Kb.Text>
      </UserCard>
      <Kb.Box2 direction="vertical" flex={1} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={nativeStyles.createAccountContainer}>
        <Kb.Button
          fullWidth={true}
          label="Create account"
          mode="Secondary"
          onClick={props.onSignup}
          style={nativeStyles.createAccountButton}
        />
      </Kb.Box2>
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
      createAccountButton: {flexGrow: 0},
      createAccountContainer: Kb.Styles.platformStyles({
        common: {padding: Kb.Styles.globalMargins.medium},
        isTablet: {maxWidth: 410, padding: Kb.Styles.globalMargins.small},
      }),
      deviceNotSecureContainer: {
        backgroundColor: Kb.Styles.globalColors.yellow,
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
      },
      deviceNotSecureText: {
        color: Kb.Styles.globalColors.brown_75,
      },
      forgotPassword: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginTop: Kb.Styles.globalMargins.medium,
      },
      formElements: {
        marginBottom: Kb.Styles.globalMargins.tiny,
      },
      loginButtonGap: {marginTop: Kb.Styles.globalMargins.small},
    }) as const
)

const Login = isMobile ? NativeLoginRender : DesktopLogin

const needPasswordError = 'passphrase cannot be empty'

const ReloginContainer = () => {
  const _users = useConfigState(s => s.configuredAccounts)
  const perror = useConfigState(s => s.loginError)
  const pselectedUser = useConfigState(s => s.defaultUsername)
  const onFeedback = () => {
    C.Router2.navigateAppend({name: 'signupSendFeedbackLoggedOut', params: {}})
  }
  const onLogin = useConfigState(s => s.dispatch.login)
  const requestAutoInvite = useRequestAutoInvite()
  const onSignup = () => requestAutoInvite('')
  const onSomeoneElse = () => startProvision()
  const error = perror?.desc || ''
  const loggedInMap = new Map<string, boolean>(
    _users.map(account => [account.username, account.hasStoredSecret])
  )
  const users = sortBy(_users, 'username')

  const [password, setPassword] = React.useState('')
  const [selectedUserState, setSelectedUserState] = React.useState({
    defaultUsername: pselectedUser,
    username: pselectedUser,
  })
  const [showTyping, setShowTyping] = React.useState(false)

  const setLoginError = useConfigState(s => s.dispatch.setLoginError)
  const prevPasswordRef = React.useRef(password)
  const prevErrorRef = React.useRef(error)

  React.useEffect(() => {
    if (password.length && !prevPasswordRef.current.length) {
      setLoginError()
    }
    prevPasswordRef.current = password
  }, [password, setLoginError])

  React.useEffect(() => {
    if (error.length && !prevErrorRef.current.length) {
      setPassword('')
    }
    prevErrorRef.current = error
  }, [error, setPassword])

  const [gotNeedPasswordError, setGotNeedPasswordError] = React.useState(false)

  if (selectedUserState.defaultUsername !== pselectedUser) {
    setSelectedUserState({defaultUsername: pselectedUser, username: pselectedUser})
  }

  const selectedUser =
    selectedUserState.defaultUsername === pselectedUser ? selectedUserState.username : pselectedUser
  const setSelectedUser = (username: string) =>
    setSelectedUserState(
      produce(draft => {
        draft.username = username
      })
    )

  if (!gotNeedPasswordError && error === needPasswordError) {
    setGotNeedPasswordError(true)
  }

  const onSubmit = () => {
    onLogin(selectedUser, password)
  }

  const selectedUserChange = (user: string) => {
    setLoginError()
    setPassword('')
    setSelectedUser(user)
    if (loggedInMap.get(user)) {
      onLogin(user, '')
    }
  }

  return (
    <Login
      error={error}
      needPassword={!loggedInMap.get(selectedUser) || gotNeedPasswordError}
      onFeedback={onFeedback}
      onForgotPassword={() => startRecoverPassword({username: selectedUser})}
      onSignup={onSignup}
      onSomeoneElse={onSomeoneElse}
      onSubmit={onSubmit}
      password={password}
      passwordChange={setPassword}
      selectedUser={selectedUser}
      selectedUserChange={selectedUserChange}
      showTypingChange={setShowTyping}
      showTyping={showTyping}
      users={users}
    />
  )
}

export default ReloginContainer

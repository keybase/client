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
import {startProvision} from '@/provision/flow'
import UserList from './user-list'
type Props = {
  users: Array<T.Config.ConfiguredAccount>
  onForgotPassword: () => void
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

const DesktopLogin = (props: Props) => {
  const desktopStyles = useDesktopStyles()
  const {
    error,
    needPassword,
    onForgotPassword,
    onSomeoneElse,
    onSubmit,
    password,
    passwordChange,
    selectedUser,
    selectedUserChange,
    users,
  } = props

  const _inputRef = React.useRef<Kb.Input3Ref>(null)

  return (
    <SignupScreen banners={errorBanner(error)} hideDesktopHeader={!isMobile}>
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
          username={selectedUser}
          outerStyle={desktopStyles.container}
          style={desktopStyles.userContainer}
        >
          <UserList
            users={users}
            selectedUser={selectedUser}
            onSelectUser={u => {
              selectedUserChange(u)
              _inputRef.current?.focus()
            }}
            onSomeoneElse={onSomeoneElse}
          />
          {needPassword && (
            <Kb.Box2 direction="horizontal" fullWidth={true} flex={1} style={desktopStyles.inputRow}>
              <Kb.Input3
                textType="BodySemibold"
                autoFocus={true}
                placeholder="Password"
                onChangeText={passwordChange}
                onEnterKeyDown={onSubmit}
                ref={_inputRef}
                secureTextEntry={true}
                value={password}
              />
            </Kb.Box2>
          )}
          <Kb.Box2 direction="horizontal" fullWidth={true} justifyContent="flex-end" flex={1}>
            <Kb.Text
              type="BodySmallSecondaryLink"
              onClick={onForgotPassword}
              style={desktopStyles.forgotPassword}
            >
              Forgot password?
            </Kb.Text>
          </Kb.Box2>
          {needPassword && (
            <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} justifyContent="flex-end" flex={1}>
              <Kb.WaitingButton
                disabled={!password}
                fullWidth={true}
                waitingKey={C.waitingKeyConfigLogin}
                style={desktopStyles.loginSubmitButton}
                label="Log in"
                onClick={onSubmit}
              />
            </Kb.Box2>
          )}
        </UserCard>
      </Kb.Box2>
    </SignupScreen>
  )
}

const useDesktopStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: {
        // UserCard's own desktop container already provides flexBoxColumn + alignItems center
        // height auto + minHeight override UserCard's fixed height: 430 so the card can
        // grow to fit 5.5 list rows plus the password block
        flex: 1,
        height: 'auto',
        justifyContent: 'center',
        minHeight: 430,
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
      userContainer: {
        backgroundColor: theme.transparent,
        flex: 1,
      },
    }) as const
)

// Native login

const NativeLoginRender = (props: Props) => {
  const nativeStyles = useNativeStyles()
  const {
    passwordChange,
    onSubmit,
    error,
    needPassword,
    onFeedback,
    onForgotPassword,
    onSomeoneElse,
    password,
    selectedUser,
    selectedUserChange,
    showTyping,
    showTypingChange,
    users,
  } = props

  const inputProps = {
    autoFocus: true,
    error: !!error,
    keyboardType: showTyping && isAndroid ? 'visible-password' : 'default',
    onChangeText: (password: string) => passwordChange(password),
    onEnterKeyDown: () => onSubmit(),
    placeholder: 'Password',
    secureTextEntry: !showTyping,
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
      <Kb.ErrorBanner error={error} />
      <UserCard username={selectedUser} outerStyle={nativeStyles.card} style={nativeStyles.cardInner}>
        <UserList
          users={users}
          selectedUser={selectedUser}
          onSelectUser={selectedUserChange}
          onSomeoneElse={onSomeoneElse}
        />
        {needPassword && (
          <Kb.Box2 direction="vertical" gap="tiny" gapEnd={true} gapStart={true} fullWidth={true}>
            <Kb.Input3 textType="BodySemibold" {...inputProps} />
            <Kb.Checkbox
              checked={showTyping}
              label="Show typing"
              onCheck={check => showTypingChange(check)}
              style={nativeStyles.formElements}
            />
          </Kb.Box2>
        )}
        {needPassword && (
          <Kb.WaitingButton
            disabled={!password}
            waitingKey={C.waitingKeyConfigLogin}
            fullWidth={true}
            label="Log in"
            onClick={onSubmit}
          />
        )}
        <Kb.Text
          type="BodySmallSecondaryLink"
          center={true}
          onClick={onForgotPassword}
          style={nativeStyles.forgotPassword}
        >
          Forgot password?
        </Kb.Text>
        <Kb.Text center={true} type="BodySmallSecondaryLink" onClick={onFeedback}>
          Problems logging in?
        </Kb.Text>
      </UserCard>
    </Kb.Box2>
  )
}

const useNativeStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      card: {
        flexShrink: 1,
        marginTop: Kb.Styles.globalMargins.medium,
        width: '100%',
      },
      cardInner: Kb.Styles.platformStyles({
        common: {flexShrink: 1},
        isTablet: {paddingBottom: 0},
      }),
      container: {
        backgroundColor: theme.blueGrey,
      },
      deviceNotSecureContainer: {
        backgroundColor: theme.yellow,
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
      },
      deviceNotSecureText: {
        color: theme.brown_75,
      },
      forgotPassword: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginTop: Kb.Styles.globalMargins.medium,
      },
      formElements: {
        marginBottom: Kb.Styles.globalMargins.tiny,
      },
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

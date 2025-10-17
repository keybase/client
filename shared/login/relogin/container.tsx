import * as C from '@/constants'
import * as React from 'react'
import Login from '.'
import sortBy from 'lodash/sortBy'
import type * as T from '@/constants/types'

const needPasswordError = 'passphrase cannot be empty'

type Props = {
  error: string
  loggedInMap: Map<string, boolean>
  onFeedback: () => void
  onForgotPassword: (username: string) => void
  onLogin: (user: string, password: string) => void
  onSignup: () => void
  onSomeoneElse: () => void
  selectedUser: string
  users: Array<T.Config.ConfiguredAccount>
}

const LoginWrapper = (props: Props) => {
  const {onLogin, loggedInMap, error, selectedUser: pselectedUser} = props

  const [password, setPassword] = React.useState('')
  const [selectedUser, setSelectedUser] = React.useState(pselectedUser)
  const [showTyping, setShowTyping] = React.useState(false)

  const setLoginError = C.useConfigState(s => s.dispatch.setLoginError)
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
  }, [error, setPassword])

  const [gotNeedPasswordError, setGotNeedPasswordError] = React.useState(false)

  const onSubmit = React.useCallback(() => {
    onLogin(selectedUser, password)
  }, [selectedUser, password, onLogin])

  const selectedUserChange = React.useCallback(
    (user: string) => {
      setLoginError()
      setPassword('')
      setSelectedUser(user)
      if (loggedInMap.get(user)) {
        onLogin(user, '')
      }
    },
    [setLoginError, setPassword, setSelectedUser, onLogin, loggedInMap]
  )

  React.useEffect(() => {
    setSelectedUser(pselectedUser)
  }, [pselectedUser, setSelectedUser])

  React.useEffect(() => {
    if (error === needPasswordError) {
      setGotNeedPasswordError(true)
    }
  }, [error, setGotNeedPasswordError])

  return (
    <Login
      error={error}
      needPassword={!loggedInMap.get(selectedUser) || gotNeedPasswordError}
      onFeedback={props.onFeedback}
      onForgotPassword={() => props.onForgotPassword(selectedUser)}
      onLogin={onLogin}
      onSignup={props.onSignup}
      onSomeoneElse={props.onSomeoneElse}
      onSubmit={onSubmit}
      password={password}
      passwordChange={setPassword}
      selectedUser={selectedUser}
      selectedUserChange={selectedUserChange}
      showTypingChange={setShowTyping}
      showTyping={showTyping}
      users={props.users}
    />
  )
}

const ReloginContainer = () => {
  const _users = C.useConfigState(s => s.configuredAccounts)
  const error = C.useConfigState(s => s.loginError)
  const selectedUser = C.useConfigState(s => s.defaultUsername)
  const startRecoverPassword = C.useRecoverState(s => s.dispatch.startRecoverPassword)
  const onForgotPassword = (username: string) => {
    startRecoverPassword({username})
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onFeedback = () => {
    navigateAppend('signupSendFeedbackLoggedOut')
  }
  const onLogin = C.useConfigState(s => s.dispatch.login)
  const requestAutoInvite = C.useSignupState(s => s.dispatch.requestAutoInvite)
  const onSignup = () => requestAutoInvite()
  const onSomeoneElse = C.useProvisionState(s => s.dispatch.startProvision)
  const props = {
    error: error?.desc || '',
    loggedInMap: new Map<string, boolean>(_users.map(account => [account.username, account.hasStoredSecret])),
    onFeedback,
    onForgotPassword,
    onLogin,
    onSignup,
    onSomeoneElse,
    selectedUser,
    users: sortBy(_users, 'username'),
  }
  return <LoginWrapper {...props} />
}

export default ReloginContainer

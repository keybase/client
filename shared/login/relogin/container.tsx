import * as C from '@/constants'
import * as React from 'react'
import Login from '.'
import sortBy from 'lodash/sortBy'
import {useState as useRecoverState} from '@/constants/recover-password'
import {useSignupState} from '@/constants/signup'

const needPasswordError = 'passphrase cannot be empty'

const ReloginContainer = () => {
  const _users = C.useConfigState(s => s.configuredAccounts)
  const perror = C.useConfigState(s => s.loginError)
  const pselectedUser = C.useConfigState(s => s.defaultUsername)
  const startRecoverPassword = useRecoverState(s => s.dispatch.startRecoverPassword)
  const onForgotPassword = (username: string) => {
    startRecoverPassword({username})
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onFeedback = () => {
    navigateAppend('signupSendFeedbackLoggedOut')
  }
  const onLogin = C.useConfigState(s => s.dispatch.login)
  const requestAutoInvite = useSignupState(s => s.dispatch.requestAutoInvite)
  const onSignup = () => requestAutoInvite()
  const onSomeoneElse = C.useProvisionState(s => s.dispatch.startProvision)
  const error = perror?.desc || ''
  const loggedInMap = React.useMemo(
    () => new Map<string, boolean>(_users.map(account => [account.username, account.hasStoredSecret])),
    [_users]
  )
  const users = sortBy(_users, 'username')

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
      onFeedback={onFeedback}
      onForgotPassword={() => onForgotPassword(selectedUser)}
      onLogin={onLogin}
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

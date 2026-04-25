import * as C from '@/constants'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import Login from '.'
import sortBy from 'lodash/sortBy'
import {startRecoverPassword} from '@/login/recover-password/flow'
import useRequestAutoInvite from '@/signup/use-request-auto-invite'
import {useProvisionState} from '@/stores/provision'

const needPasswordError = 'passphrase cannot be empty'

const ReloginContainer = () => {
  const _users = useConfigState(s => s.configuredAccounts)
  const perror = useConfigState(s => s.loginError)
  const pselectedUser = useConfigState(s => s.defaultUsername)
  const onForgotPassword = (username: string) => {
    startRecoverPassword({username})
  }
  const navigateAppend = C.Router2.navigateAppend
  const onFeedback = () => {
    navigateAppend({name: 'signupSendFeedbackLoggedOut', params: {}})
  }
  const onLogin = useConfigState(s => s.dispatch.login)
  const requestAutoInvite = useRequestAutoInvite()
  const onSignup = () => requestAutoInvite()
  const onSomeoneElse = useProvisionState(s => s.dispatch.startProvision)
  const error = perror?.desc || ''
  const loggedInMap = new Map<string, boolean>(_users.map(account => [account.username, account.hasStoredSecret]))
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
  }, [error, setPassword])

  const [gotNeedPasswordError, setGotNeedPasswordError] = React.useState(false)

  if (selectedUserState.defaultUsername !== pselectedUser) {
    setSelectedUserState({defaultUsername: pselectedUser, username: pselectedUser})
  }

  const selectedUser =
    selectedUserState.defaultUsername === pselectedUser ? selectedUserState.username : pselectedUser
  const setSelectedUser = (username: string) =>
    setSelectedUserState(state => ({...state, username}))

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

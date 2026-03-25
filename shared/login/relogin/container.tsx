import * as C from '@/constants'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import Login from '.'
import sortBy from 'lodash/sortBy'
import {useState as useRecoverState} from '@/stores/recover-password'
import {useSignupState} from '@/stores/signup'
import {useProvisionState} from '@/stores/provision'
import {getReloginNeedPassword, isNeedPasswordError} from '../flow'

const useReloginState = () => {
  const {configuredAccounts, defaultUsername, login, loginError, setLoginError} = useConfigState(
    C.useShallow(s => ({
      configuredAccounts: s.configuredAccounts,
      defaultUsername: s.defaultUsername,
      login: s.dispatch.login,
      loginError: s.loginError,
      setLoginError: s.dispatch.setLoginError,
    }))
  )
  const startRecoverPassword = useRecoverState(s => s.dispatch.startRecoverPassword)
  const requestAutoInvite = useSignupState(s => s.dispatch.requestAutoInvite)
  const startProvision = useProvisionState(s => s.dispatch.startProvision)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  const error = loginError?.desc || ''
  const users = sortBy(configuredAccounts, 'username')
  const loggedInMap = new Map(users.map(account => [account.username, account.hasStoredSecret]))

  const [password, setPassword] = React.useState('')
  const [selectedUser, setSelectedUser] = React.useState(defaultUsername)
  const [showTyping, setShowTyping] = React.useState(false)
  const [gotNeedPasswordError, setGotNeedPasswordError] = React.useState(false)
  const previousErrorRef = React.useRef(error)

  React.useEffect(() => {
    if (error.length && !previousErrorRef.current.length) {
      setPassword('')
    }
    previousErrorRef.current = error
  }, [error])

  React.useEffect(() => {
    setSelectedUser(defaultUsername)
  }, [defaultUsername])

  React.useEffect(() => {
    if (isNeedPasswordError(error)) {
      setGotNeedPasswordError(true)
    }
  }, [error])

  const passwordChange = (nextPassword: string) => {
    if (nextPassword.length && !password.length) {
      setLoginError()
    }
    setPassword(nextPassword)
  }

  const selectedUserChange = (username: string) => {
    setLoginError()
    setPassword('')
    setSelectedUser(username)
    if (loggedInMap.get(username)) {
      login(username, '')
    }
  }

  return {
    error,
    needPassword: getReloginNeedPassword(!!loggedInMap.get(selectedUser), gotNeedPasswordError),
    onFeedback: () => navigateAppend('signupSendFeedbackLoggedOut'),
    onForgotPassword: () => startRecoverPassword({username: selectedUser}),
    onSignup: () => requestAutoInvite(),
    onSomeoneElse: startProvision,
    onSubmit: () => login(selectedUser, password),
    password,
    passwordChange,
    selectedUser,
    selectedUserChange,
    showTyping,
    showTypingChange: setShowTyping,
    users,
  }
}

const ReloginContainer = () => {
  const props = useReloginState()
  return <Login {...props} />
}

export default ReloginContainer

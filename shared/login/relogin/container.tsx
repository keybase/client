import * as React from 'react'
import * as LoginGen from '../../actions/login-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import HiddenString from '../../util/hidden-string'
import Login from '.'
import sortBy from 'lodash/sortBy'
import * as Container from '../../util/container'
import type * as ConfigTypes from '../../constants/types/config'

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
  users: Array<ConfigTypes.ConfiguredAccount>
}

const LoginWrapper = (props: Props) => {
  const [password, setPassword] = React.useState('')
  const [selectedUser, setSelectedUser] = React.useState(props.selectedUser)
  const [showTyping, setShowTyping] = React.useState(false)

  const prevPassword = Container.usePrevious(password)
  const prevError = Container.usePrevious(props.error)

  const [gotNeedPasswordError, setGotNeedPasswordError] = React.useState(false)

  const dispatch = Container.useDispatch()

  const {onLogin, loggedInMap} = props

  const onSubmit = React.useCallback(() => {
    onLogin(selectedUser, password)
  }, [selectedUser, password, onLogin])

  const selectedUserChange = React.useCallback(
    user => {
      dispatch(LoginGen.createLoginError({}))
      setPassword('')
      setSelectedUser(user)
      if (loggedInMap.get(user)) {
        onLogin(user, '')
      }
    },
    [dispatch, setPassword, setSelectedUser, onLogin, loggedInMap]
  )

  // Effects
  React.useEffect(() => {
    if (!prevError && !!props.error) {
      setPassword('')
    }
  }, [prevError, props.error, setPassword])
  React.useEffect(() => {
    setSelectedUser(props.selectedUser)
  }, [props.selectedUser, setSelectedUser])
  React.useEffect(() => {
    if (!prevPassword && !!password) {
      dispatch(LoginGen.createLoginError({}))
    }
  }, [password, prevPassword, dispatch])
  React.useEffect(() => {
    if (props.error === needPasswordError) {
      setGotNeedPasswordError(true)
    }
  }, [props.error, setGotNeedPasswordError])

  return (
    <Login
      error={props.error}
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

export default () => {
  const _users = Container.useSelector(state => state.config.configuredAccounts)
  const error = Container.useSelector(state => state.login.error)
  const selectedUser = Container.useSelector(state => state.config.defaultUsername)
  const dispatch = Container.useDispatch()
  const onForgotPassword = (username: string) => {
    dispatch(RecoverPasswordGen.createStartRecoverPassword({username}))
  }
  const onFeedback = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'feedback'}]}))
  }
  const onLogin = (username: string, password: string) => {
    dispatch(LoginGen.createLogin({password: new HiddenString(password), username}))
  }
  const onSignup = () => {
    dispatch(SignupGen.createRequestAutoInvite())
  }
  const onSomeoneElse = () => {
    dispatch(ProvisionGen.createStartProvision())
  }
  const props = {
    error: (error && error.desc) || '',
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

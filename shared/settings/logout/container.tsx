import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/settings'
import * as ConfigConstants from '../../constants/config'
import * as C from '../../constants'
import LogOut from '.'

const LogoutContainer = () => {
  const checkPasswordIsCorrect = Constants.useState(s => s.checkPasswordIsCorrect)
  const resetCheckPassword = Constants.useState(s => s.dispatch.resetCheckPassword)
  const checkPassword = Constants.useState(s => s.dispatch.checkPassword)
  const hasRandomPW = Constants.usePasswordState(s => s.randomPW)
  const waitingForResponse = Container.useAnyWaiting(Constants.settingsWaitingKey)

  const loadHasRandomPw = Constants.usePasswordState(s => s.dispatch.loadHasRandomPw)

  const onBootstrap = loadHasRandomPw
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = React.useCallback(() => {
    resetCheckPassword()
    navigateUp()
  }, [resetCheckPassword, navigateUp])
  const onCheckPassword = checkPassword

  const requestLogout = ConfigConstants.useLogoutState(s => s.dispatch.requestLogout)

  const _onLogout = React.useCallback(() => {
    requestLogout()
    resetCheckPassword()
  }, [resetCheckPassword, requestLogout])

  const submitNewPassword = Constants.usePasswordState(s => s.dispatch.submitNewPassword)
  const setPassword = Constants.usePasswordState(s => s.dispatch.setPassword)
  const setPasswordConfirm = Constants.usePasswordState(s => s.dispatch.setPasswordConfirm)

  const onSavePassword = React.useCallback(
    (password: string) => {
      setPassword(password)
      setPasswordConfirm(password)
      submitNewPassword(true)
    },
    [submitNewPassword, setPassword, setPasswordConfirm]
  )

  const onLogout = Container.useSafeSubmit(_onLogout, false)

  return (
    <LogOut
      checkPasswordIsCorrect={checkPasswordIsCorrect}
      hasRandomPW={hasRandomPW}
      onBootstrap={onBootstrap}
      onCancel={onCancel}
      onCheckPassword={onCheckPassword}
      onLogout={onLogout}
      onSavePassword={onSavePassword}
      waitingForResponse={waitingForResponse}
    />
  )
}
export default LogoutContainer

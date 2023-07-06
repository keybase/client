import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/settings'
import * as ConfigConstants from '../../constants/config'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import HiddenString from '../../util/hidden-string'
import LogOut from '.'

const LogoutContainer = () => {
  const checkPasswordIsCorrect = Constants.useState(s => s.checkPasswordIsCorrect)
  const resetCheckPassword = Constants.useState(s => s.dispatch.resetCheckPassword)
  const checkPassword = Constants.useState(s => s.dispatch.checkPassword)
  const hasRandomPW = Constants.usePasswordState(s => s.randomPW)
  const waitingForResponse = Container.useAnyWaiting(Constants.settingsWaitingKey)

  const loadHasRandomPw = Constants.usePasswordState(s => s.dispatch.loadHasRandomPw)

  const dispatch = Container.useDispatch()
  const onBootstrap = loadHasRandomPw
  const onCancel = React.useCallback(() => {
    resetCheckPassword()
    dispatch(RouteTreeGen.createNavigateUp())
  }, [resetCheckPassword, dispatch])
  const onCheckPassword = checkPassword

  const requestLogout = ConfigConstants.useLogoutState(s => s.dispatch.requestLogout)

  const _onLogout = React.useCallback(() => {
    requestLogout()
    resetCheckPassword()
  }, [resetCheckPassword, requestLogout])
  const onSavePassword = React.useCallback(
    (password: string) => {
      dispatch(SettingsGen.createOnChangeNewPassword({password: new HiddenString(password)}))
      dispatch(SettingsGen.createOnChangeNewPasswordConfirm({password: new HiddenString(password)}))
      dispatch(SettingsGen.createOnSubmitNewPassword({thenSignOut: true}))
    },
    [dispatch]
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

import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/settings'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import HiddenString from '../../util/hidden-string'
import LogOut from '.'

const LogoutContainer = () => {
  const checkPasswordIsCorrect = Container.useSelector(state => state.settings.checkPasswordIsCorrect)
  const hasRandomPW = Container.useSelector(state => state.settings.password.randomPW)
  const waitingForResponse = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.settingsWaitingKey)
  )

  const dispatch = Container.useDispatch()
  const onBootstrap = React.useCallback(() => dispatch(SettingsGen.createLoadHasRandomPw()), [dispatch])
  const onCancel = React.useCallback(() => {
    dispatch(SettingsGen.createLoadedCheckPassword({}))
    dispatch(RouteTreeGen.createNavigateUp())
  }, [dispatch])
  const onCheckPassword = React.useCallback(
    (password: string) => {
      if (password) {
        dispatch(SettingsGen.createCheckPassword({password: new HiddenString(password)}))
      }
    },
    [dispatch]
  )
  const _onLogout = React.useCallback(() => {
    dispatch(ConfigGen.createLogout())
    dispatch(SettingsGen.createLoadedCheckPassword({}))
  }, [dispatch])
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

import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/settings'
import * as SettingsGen from '../../actions/settings-gen'
import UpdatePassword from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'

export default () => {
  const error = Constants.usePasswordState(s => s.error)
  const hasPGPKeyOnServer = Constants.usePasswordState(s => !!s.hasPGPKeyOnServer)
  const hasRandomPW = Constants.usePasswordState(s => !!s.randomPW)
  const newPasswordConfirmError = Constants.usePasswordState(s => s.newPasswordConfirmError)
  const newPasswordError = Constants.usePasswordState(s => s.newPasswordError)
  const saveLabel = Constants.usePasswordState(s => (s.randomPW ? 'Create password' : 'Save'))
  const waitingForResponse = Container.useAnyWaiting(Constants.settingsWaitingKey)

  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onChangeShowPassword = () => {
    dispatch(SettingsGen.createOnChangeShowPassword())
  }
  const onSave = (password: string) => {
    dispatch(SettingsGen.createOnChangeNewPassword({password: new HiddenString(password)}))
    dispatch(SettingsGen.createOnChangeNewPasswordConfirm({password: new HiddenString(password)}))
    dispatch(SettingsGen.createOnSubmitNewPassword({thenSignOut: false}))
  }
  const onUpdatePGPSettings = () => {
    dispatch(SettingsGen.createOnUpdatePGPSettings())
  }
  const props = {
    error,
    hasPGPKeyOnServer,
    hasRandomPW,
    newPasswordConfirmError,
    newPasswordError,
    onCancel,
    onChangeShowPassword,
    onSave,
    onUpdatePGPSettings,
    saveLabel,
    waitingForResponse,
  }
  return <UpdatePassword {...props} />
}

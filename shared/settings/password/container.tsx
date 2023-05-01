import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/settings'
import * as SettingsGen from '../../actions/settings-gen'
import UpdatePassword from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'

export default () => {
  const error = Container.useSelector(state => state.settings.password.error)
  const hasPGPKeyOnServer = Container.useSelector(state => !!state.settings.password.hasPGPKeyOnServer)
  const hasRandomPW = Container.useSelector(state => !!state.settings.password.randomPW)
  const newPasswordConfirmError = Container.useSelector(state =>
    state.settings.password.newPasswordConfirmError
      ? state.settings.password.newPasswordConfirmError.stringValue()
      : undefined
  )
  const newPasswordError = Container.useSelector(state =>
    state.settings.password.newPasswordError
      ? state.settings.password.newPasswordError.stringValue()
      : undefined
  )
  const saveLabel = Container.useSelector(state =>
    state.settings.password.randomPW ? 'Create password' : 'Save'
  )
  const waitingForResponse = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.settingsWaitingKey)
  )

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

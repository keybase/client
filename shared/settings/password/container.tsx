import * as C from '../../constants'
import * as Constants from '../../constants/settings'
import UpdatePassword from '.'
import * as Container from '../../util/container'

export default () => {
  const error = C.useSettingsPasswordState(s => s.error)
  const hasPGPKeyOnServer = C.useSettingsPasswordState(s => !!s.hasPGPKeyOnServer)
  const hasRandomPW = C.useSettingsPasswordState(s => !!s.randomPW)
  const newPasswordConfirmError = C.useSettingsPasswordState(s => s.newPasswordConfirmError)
  const newPasswordError = C.useSettingsPasswordState(s => s.newPasswordError)
  const saveLabel = C.useSettingsPasswordState(s => (s.randomPW ? 'Create password' : 'Save'))
  const waitingForResponse = Container.useAnyWaiting(Constants.settingsWaitingKey)

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }

  const setPassword = C.useSettingsPasswordState(s => s.dispatch.setPassword)
  const setPasswordConfirm = C.useSettingsPasswordState(s => s.dispatch.setPasswordConfirm)
  const submitNewPassword = C.useSettingsPasswordState(s => s.dispatch.submitNewPassword)

  const onSave = (password: string) => {
    setPassword(password)
    setPasswordConfirm(password)
    submitNewPassword(false)
  }

  const loadPgpSettings = C.useSettingsPasswordState(s => s.dispatch.loadPgpSettings)
  const onUpdatePGPSettings = loadPgpSettings
  const props = {
    error,
    hasPGPKeyOnServer,
    hasRandomPW,
    newPasswordConfirmError,
    newPasswordError,
    onCancel,
    onSave,
    onUpdatePGPSettings,
    saveLabel,
    waitingForResponse,
  }
  return <UpdatePassword {...props} />
}

import * as C from '../../constants'
import * as Constants from '../../constants/settings'
import UpdatePassword from '.'
import * as Container from '../../util/container'

export default () => {
  const error = Constants.usePasswordState(s => s.error)
  const hasPGPKeyOnServer = Constants.usePasswordState(s => !!s.hasPGPKeyOnServer)
  const hasRandomPW = Constants.usePasswordState(s => !!s.randomPW)
  const newPasswordConfirmError = Constants.usePasswordState(s => s.newPasswordConfirmError)
  const newPasswordError = Constants.usePasswordState(s => s.newPasswordError)
  const saveLabel = Constants.usePasswordState(s => (s.randomPW ? 'Create password' : 'Save'))
  const waitingForResponse = Container.useAnyWaiting(Constants.settingsWaitingKey)

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }

  const setPassword = Constants.usePasswordState(s => s.dispatch.setPassword)
  const setPasswordConfirm = Constants.usePasswordState(s => s.dispatch.setPasswordConfirm)
  const submitNewPassword = Constants.usePasswordState(s => s.dispatch.submitNewPassword)

  const onSave = (password: string) => {
    setPassword(password)
    setPasswordConfirm(password)
    submitNewPassword(false)
  }

  const loadPgpSettings = Constants.usePasswordState(s => s.dispatch.loadPgpSettings)
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

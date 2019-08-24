import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/settings'
import * as SettingsGen from '../../actions/settings-gen'
import UpdatePassword from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'

type OwnProps = {}

export default Container.connect(
  state => ({
    error: state.settings.password.error,
    hasPGPKeyOnServer: !!state.settings.password.hasPGPKeyOnServer,
    hasRandomPW: !!state.settings.password.randomPW,
    newPasswordConfirmError: state.settings.password.newPasswordConfirmError
      ? state.settings.password.newPasswordConfirmError.stringValue()
      : undefined,
    newPasswordError: state.settings.password.newPasswordError
      ? state.settings.password.newPasswordError.stringValue()
      : undefined,
    saveLabel: state.settings.password.randomPW ? 'Create password' : 'Save',
    waitingForResponse: Container.anyWaiting(state, Constants.settingsWaitingKey),
  }),
  dispatch => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onChangeShowPassword: () => dispatch(SettingsGen.createOnChangeShowPassword()),
    onSave: (password: string, passwordConfirm: string) => {
      dispatch(SettingsGen.createOnChangeNewPassword({password: new HiddenString(password)}))
      dispatch(SettingsGen.createOnChangeNewPasswordConfirm({password: new HiddenString(passwordConfirm)}))
      dispatch(SettingsGen.createOnSubmitNewPassword({thenSignOut: false}))
    },
    onUpdatePGPSettings: () => dispatch(SettingsGen.createOnUpdatePGPSettings()),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(UpdatePassword)

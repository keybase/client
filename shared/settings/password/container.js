// @flow
import * as SettingsGen from '../../actions/settings-gen'
import * as Kb from '../../common-adapters'
import UpdatePassword from '.'
import {compose, lifecycle, connect, type RouteProps} from '../../util/container'
import HiddenString from '../../util/hidden-string'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.settings.password.error,
  hasPGPKeyOnServer: !!state.settings.password.hasPGPKeyOnServer,
  newPasswordConfirmError: state.settings.password.newPasswordConfirmError
    ? state.settings.password.newPasswordConfirmError.stringValue()
    : null,
  newPasswordError: state.settings.password.newPasswordError
    ? state.settings.password.newPasswordError.stringValue()
    : null,
  saveLabel: state.settings.password.randomPW ? 'Create password' : 'Save',
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
  onChangeShowPassword: () => dispatch(SettingsGen.createOnChangeShowPassword()),
  onSave: (password: string, passwordConfirm: string) => {
    dispatch(SettingsGen.createOnChangeNewPassword({password: new HiddenString(password)}))
    dispatch(SettingsGen.createOnChangeNewPasswordConfirm({password: new HiddenString(passwordConfirm)}))
    dispatch(SettingsGen.createOnSubmitNewPassword({thenSignOut: false}))
  },
  onUpdatePGPSettings: () => dispatch(SettingsGen.createOnUpdatePGPSettings()),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props.onUpdatePGPSettings()
    },
  })
)(Kb.HeaderOrPopup(UpdatePassword))

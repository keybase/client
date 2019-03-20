// @flow
import * as SettingsGen from '../../actions/settings-gen'
import * as Kb from '../../common-adapters'
import UpdatePassphrase from '.'
import {compose, lifecycle, connect, type RouteProps} from '../../util/container'
import HiddenString from '../../util/hidden-string'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.settings.passphrase.error,
  hasPGPKeyOnServer: !!state.settings.passphrase.hasPGPKeyOnServer,
  newPassphraseConfirmError: state.settings.passphrase.newPassphraseConfirmError
    ? state.settings.passphrase.newPassphraseConfirmError.stringValue()
    : null,
  newPassphraseError: state.settings.passphrase.newPassphraseError
    ? state.settings.passphrase.newPassphraseError.stringValue()
    : null,
  saveLabel: state.settings.passphrase.randomPW ? 'Create passphrase' : 'Save',
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
  onChangeShowPassphrase: () => dispatch(SettingsGen.createOnChangeShowPassphrase()),
  onSave: (passphrase: string, passphraseConfirm: string) => {
    dispatch(SettingsGen.createOnChangeNewPassphrase({passphrase: new HiddenString(passphrase)}))
    dispatch(
      SettingsGen.createOnChangeNewPassphraseConfirm({passphrase: new HiddenString(passphraseConfirm)})
    )
    dispatch(SettingsGen.createOnSubmitNewPassphrase({thenSignOut: false}))
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
)(Kb.HeaderOrPopup(UpdatePassphrase))

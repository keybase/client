// @flow
import * as SettingsGen from '../../actions/settings-gen'
import UpdatePassphrase from '.'
import {compose, lifecycle, connect, type TypedState} from '../../util/container'
import HiddenString from '../../util/hidden-string'

const mapStateToProps = (state: TypedState) => ({
  error: state.settings.passphrase.error,
  hasPGPKeyOnServer: !!state.settings.passphrase.hasPGPKeyOnServer,
  newPassphraseConfirmError: state.settings.passphrase.newPassphraseConfirmError
    ? state.settings.passphrase.newPassphraseConfirmError.stringValue()
    : null,
  newPassphraseError: state.settings.passphrase.newPassphraseError
    ? state.settings.passphrase.newPassphraseError.stringValue()
    : null,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onChangeShowPassphrase: () => dispatch(SettingsGen.createOnChangeShowPassphrase()),
  onSave: (passphrase: string, passphraseConfirm: string) => {
    dispatch(SettingsGen.createOnChangeNewPassphrase({passphrase: new HiddenString(passphrase)}))
    dispatch(
      SettingsGen.createOnChangeNewPassphraseConfirm({passphrase: new HiddenString(passphraseConfirm)})
    )
    dispatch(SettingsGen.createOnSubmitNewPassphrase())
  },
  onUpdatePGPSettings: () => dispatch(SettingsGen.createOnUpdatePGPSettings()),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props.onUpdatePGPSettings()
    },
  })
)(UpdatePassphrase)

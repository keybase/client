// @flow
import * as SettingsGen from '../../actions/settings-gen'
import UpdatePassphrase from '.'
import {compose, lifecycle, connect, type TypedState} from '../../util/container'

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

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onChangeShowPassphrase: () => dispatch(SettingsGen.createOnChangeShowPassphrase()),
  onSave: (passphrase, passphraseConfirm) => {
    dispatch(SettingsGen.createOnChangeNewPassphrase({passphrase}))
    dispatch(SettingsGen.createOnChangeNewPassphraseConfirm({passphrase: passphraseConfirm}))
    dispatch(SettingsGen.createOnSubmitNewPassphrase())
  },
  onUpdatePGPSettings: () => dispatch(SettingsGen.createOnUpdatePGPSettings()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props.onUpdatePGPSettings()
    },
  })
)(UpdatePassphrase)

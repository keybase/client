// @flow
import UpdatePassphrase from '.'
import * as Creators from '../../actions/settings'
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
  onChangeShowPassphrase: () => dispatch(Creators.onChangeShowPassphrase()),
  onSave: (passphrase, passphraseConfirm) => {
    dispatch(Creators.onChangeNewPassphrase(passphrase))
    dispatch(Creators.onChangeNewPassphraseConfirm(passphraseConfirm))
    dispatch(Creators.onSubmitNewPassphrase())
  },
  onUpdatePGPSettings: () => dispatch(Creators.onUpdatePGPSettings()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props.onUpdatePGPSettings()
    },
  })
)(UpdatePassphrase)

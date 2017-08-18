// @flow
import UpdatePassphrase from '.'
import {
  onChangeNewPassphrase,
  onChangeNewPassphraseConfirm,
  onChangeShowPassphrase,
  onSubmitNewPassphrase,
  onUpdatePGPSettings,
} from '../../actions/settings'
import {connect} from 'react-redux'
import {compose, lifecycle} from 'recompose'

import type {TypedState} from '../../constants/reducer'

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
  onChangeShowPassphrase: () => dispatch(onChangeShowPassphrase()),
  onSave: (passphrase, passphraseConfirm) => {
    dispatch(onChangeNewPassphrase(passphrase))
    dispatch(onChangeNewPassphraseConfirm(passphraseConfirm))
    dispatch(onSubmitNewPassphrase())
  },
  onUpdatePGPSettings: () => dispatch(onUpdatePGPSettings()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props.onUpdatePGPSettings()
    },
  })
)(UpdatePassphrase)

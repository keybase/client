// @flow
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import UpdatePassphrase from './index'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/route-tree'
import {onChangeNewPassphrase, onChangeNewPassphraseConfirm, onChangeShowPassphrase, onSubmitNewPassphrase, onUpdatePGPSettings} from '../../actions/settings'

import type {Props} from './index'
import type {TypedState} from '../../constants/reducer'

class PassphraseContainer extends Component<void, Props, void> {
  componentWillMount () {
    this.props.onUpdatePGPSettings()
  }

  render () {
    return <UpdatePassphrase {...this.props} />
  }
}

export default connect(
  (state: TypedState, ownProps: {}) => ({
    newPassphrase: state.settings.passphrase.newPassphrase.stringValue(),
    newPassphraseConfirm: state.settings.passphrase.newPassphraseConfirm.stringValue(),
    showTyping: state.settings.passphrase.showTyping,
    error: state.settings.passphrase.error,
    newPassphraseError: state.settings.passphrase.newPassphraseError ? state.settings.passphrase.newPassphraseError.stringValue() : null,
    newPassphraseConfirmError: state.settings.passphrase.newPassphraseConfirmError ? state.settings.passphrase.newPassphraseConfirmError.stringValue() : null,
    hasPGPKeyOnServer: state.settings.passphrase.hasPGPKeyOnServer,
    canSave: state.settings.passphrase.canSave,
    waitingForResponse: state.settings.waitingForResponse,
  }),
  (dispatch: any, ownProps: {}) => ({
    onChangeNewPassphrase: (passphrase: string) => dispatch(onChangeNewPassphrase(new HiddenString(passphrase))),
    onChangeNewPassphraseConfirm: (passphrase: string) => dispatch(onChangeNewPassphraseConfirm(new HiddenString(passphrase))),
    onUpdatePGPSettings: () => dispatch(onUpdatePGPSettings()),
    onChangeShowPassphrase: () => dispatch(onChangeShowPassphrase()),
    onBack: () => dispatch(navigateUp()),
    onSave: () => dispatch(onSubmitNewPassphrase()),
  })
)(PassphraseContainer)

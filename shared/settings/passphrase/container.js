// @flow
import React, {Component} from 'react'
import UpdatePassphrase from './index'
import {navigateUp} from '../../actions/route-tree'
import {
  onChangeNewPassphrase,
  onChangeNewPassphraseConfirm,
  onChangeShowPassphrase,
  onSubmitNewPassphrase,
  onUpdatePGPSettings,
} from '../../actions/settings'

import type {Props} from './index'
import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'
import {TypedConnector} from '../../util/typed-connect'

class UpdatePassphraseContainer extends Component<void, Props, void> {
  componentWillMount() {
    this.props.onUpdatePGPSettings()
  }

  render() {
    return <UpdatePassphrase {...this.props} />
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => {
  return {
    error: state.settings.passphrase.error,
    newPassphraseError: state.settings.passphrase.newPassphraseError
      ? state.settings.passphrase.newPassphraseError.stringValue()
      : null,
    newPassphraseConfirmError: state.settings.passphrase.newPassphraseConfirmError
      ? state.settings.passphrase.newPassphraseConfirmError.stringValue()
      : null,
    hasPGPKeyOnServer: !!state.settings.passphrase.hasPGPKeyOnServer,
    waitingForResponse: state.settings.waitingForResponse,
    onUpdatePGPSettings: () => {
      dispatch(onUpdatePGPSettings())
    },
    onChangeShowPassphrase: () => {
      dispatch(onChangeShowPassphrase())
    },
    onBack: () => {
      dispatch(navigateUp())
    },
    onSave: (passphrase, passphraseConfirm) => {
      dispatch(onChangeNewPassphrase(passphrase))
      dispatch(onChangeNewPassphraseConfirm(passphraseConfirm))
      dispatch(onSubmitNewPassphrase())
    },
  }
})(UpdatePassphraseContainer)

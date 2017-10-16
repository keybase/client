// @flow
import React, {Component} from 'react'
import {globalMargins} from '../../styles'
import {Button, Checkbox, Input, StandardScreen, Text} from '../../common-adapters'
import HiddenString from '../../util/hidden-string'

type Props = {
  error?: ?Error,
  newPassphraseError: ?string,
  newPassphraseConfirmError: ?string,
  hasPGPKeyOnServer: boolean,
  onBack: () => void,
  onSave: (passphrase: HiddenString, passphraseConfirm: HiddenString) => void,
  waitingForResponse: boolean,
  onUpdatePGPSettings: () => void,
}

type State = {
  passphrase: HiddenString,
  passphraseConfirm: HiddenString,
  showTyping: boolean,
  canSave: boolean,
}

class UpdatePassphrase extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      passphrase: new HiddenString(''),
      passphraseConfirm: new HiddenString(''),
      showTyping: false,
      canSave: false,
    }
  }

  _handlePassphraseChange(passphrase: string) {
    const nextPassphrase = new HiddenString(passphrase)
    this.setState({
      passphrase: nextPassphrase,
      canSave: this._canSave(nextPassphrase, this.state.passphraseConfirm),
    })
  }

  _handlePassphraseConfirmChange(passphraseConfirm: string) {
    const nextPassphraseConfirm = new HiddenString(passphraseConfirm)
    this.setState({
      passphraseConfirm: nextPassphraseConfirm,
      canSave: this._canSave(this.state.passphrase, nextPassphraseConfirm),
    })
  }

  _canSave(passphrase: HiddenString, passphraseConfirm: HiddenString): boolean {
    const downloadedPGPState = this.props.hasPGPKeyOnServer !== null
    return (
      downloadedPGPState &&
      passphrase.stringValue() === passphraseConfirm.stringValue() &&
      this.state.passphrase.stringValue().length >= 6
    )
  }

  render() {
    const inputType = this.state.showTyping ? 'passwordVisible' : 'password'
    const notification = this.props.error
      ? {message: this.props.error.message, type: 'error'}
      : this.props.hasPGPKeyOnServer
          ? {
              message: "Note: changing your passphrase will delete your PGP key from Keybase, and you'll need to generate or upload one again.",
              type: 'error',
            }
          : null
    return (
      <StandardScreen onBack={this.props.onBack} notification={notification} style={{alignItems: 'center'}}>
        <Input
          hintText="New passphrase"
          value={this.state.passphrase.stringValue()}
          type={inputType}
          errorText={this.props.newPassphraseError}
          onChangeText={passphrase => this._handlePassphraseChange(passphrase)}
          style={styleInput}
        />
        {!this.props.newPassphraseError &&
          <Text type="BodySmall" style={stylePasswordNote}>
            (Minimum 6 characters)
          </Text>}
        <Input
          hintText="Confirm new passphrase"
          value={this.state.passphraseConfirm.stringValue()}
          type={inputType}
          errorText={this.props.newPassphraseConfirmError}
          onChangeText={passphrase => this._handlePassphraseConfirmChange(passphrase)}
          style={styleInput}
        />
        <Checkbox
          label="Show typing"
          onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
          checked={this.state.showTyping}
          style={{marginBottom: globalMargins.medium}}
        />
        <Button
          type="Primary"
          label="Save"
          disabled={!this.state.canSave}
          onClick={() => this.props.onSave(this.state.passphrase, this.state.passphraseConfirm)}
          waiting={this.props.waitingForResponse}
        />
      </StandardScreen>
    )
  }
}

const styleInput = {
  marginBottom: globalMargins.small,
}

const stylePasswordNote = {
  height: 0, // don't offset next input by label height
  position: 'relative',
  top: -globalMargins.small,
}

export default UpdatePassphrase

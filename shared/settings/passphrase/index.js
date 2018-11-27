// @flow
import React, {Component} from 'react'
import {globalMargins} from '../../styles'
import {Button, Checkbox, Input, StandardScreen, Text} from '../../common-adapters'

type Props = {
  error?: ?Error,
  newPassphraseError: ?string,
  newPassphraseConfirmError: ?string,
  hasPGPKeyOnServer: boolean,
  onBack: () => void,
  onSave: (passphrase: string, passphraseConfirm: string) => void,
  waitingForResponse: boolean,
  onUpdatePGPSettings: () => void,
}

type State = {
  passphrase: string,
  passphraseConfirm: string,
  showTyping: boolean,
  canSave: boolean,
}

class UpdatePassphrase extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      passphrase: '',
      passphraseConfirm: '',
      showTyping: false,
      canSave: false,
    }
  }

  _handlePassphraseChange(passphrase: string) {
    this.setState({
      canSave: this._canSave(passphrase, this.state.passphraseConfirm),
      passphrase,
    })
  }

  _handlePassphraseConfirmChange(passphraseConfirm: string) {
    this.setState({
      canSave: this._canSave(this.state.passphrase, passphraseConfirm),
      passphraseConfirm,
    })
  }

  _canSave(passphrase: string, passphraseConfirm: string): boolean {
    const downloadedPGPState = this.props.hasPGPKeyOnServer !== null
    return downloadedPGPState && passphrase === passphraseConfirm && this.state.passphrase.length >= 8
  }

  render() {
    const inputType = this.state.showTyping ? 'passwordVisible' : 'password'
    const notification = this.props.error
      ? {message: this.props.error.message, type: 'error'}
      : this.props.hasPGPKeyOnServer
      ? {
          message:
            "Note: changing your passphrase will delete your PGP key from Keybase, and you'll need to generate or upload one again.",
          type: 'error',
        }
      : null
    return (
      <StandardScreen onBack={this.props.onBack} notification={notification} style={{alignItems: 'center'}}>
        <Input
          hintText="New passphrase"
          type={inputType}
          errorText={this.props.newPassphraseError}
          value={this.state.passphrase}
          onChangeText={passphrase => this._handlePassphraseChange(passphrase)}
          uncontrolled={false}
          style={styleInput}
        />
        {!this.props.newPassphraseError && (
          <Text type="BodySmall" style={stylePasswordNote}>
            (Minimum 8 characters)
          </Text>
        )}
        <Input
          hintText="Confirm new passphrase"
          type={inputType}
          value={this.state.passphraseConfirm}
          errorText={this.props.newPassphraseConfirmError}
          onChangeText={passphrase => this._handlePassphraseConfirmChange(passphrase)}
          uncontrolled={false}
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

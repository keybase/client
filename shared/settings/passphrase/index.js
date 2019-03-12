// @flow
import React, {Component} from 'react'
import {globalMargins} from '../../styles'
import {Button, Checkbox, Input, StandardScreen, Text} from '../../common-adapters'

type Props = {
  error?: ?Error,
  heading: string,
  newPassphraseError: ?string,
  newPassphraseConfirmError: ?string,
  hasPGPKeyOnServer: boolean,
  onBack: () => void,
  onSave: (passphrase: string, passphraseConfirm: string) => void,
  showTyping?: boolean,
  waitingForResponse: boolean,
  onUpdatePGPSettings: () => void,
}

type State = {
  passphrase: string,
  passphraseConfirm: string,
  showTyping: boolean,
  errorSaving: string,
}

class UpdatePassphrase extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      errorSaving: '',
      passphrase: '',
      passphraseConfirm: '',
      showTyping: !!props.showTyping,
    }
  }

  _handlePassphraseChange(passphrase: string) {
    this.setState({
      errorSaving: this._errorSaving(passphrase, this.state.passphraseConfirm),
      passphrase,
    })
  }

  _handlePassphraseConfirmChange(passphraseConfirm: string) {
    this.setState({
      errorSaving: this._errorSaving(this.state.passphrase, passphraseConfirm),
      passphraseConfirm,
    })
  }

  _errorSaving(passphrase: string, passphraseConfirm: string): string {
    if (this.state.passphrase.length < 8) {
      return 'Your new passphrase must have at least 8 characters.'
    }
    if (passphrase !== passphraseConfirm) {
      return 'Passphrases must match.'
    }
    if (this.props.hasPGPKeyOnServer === null) {
      return 'There was a problem downloading your PGP key status.'
    }
    return ''
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
        {!!this.props.heading && <Text type="BodySmall">{this.props.heading}</Text>}
        <Input
          hintText="New passphrase"
          type={inputType}
          errorText={this.state.errorSaving || this.props.newPassphraseError}
          value={this.state.passphrase}
          onChangeText={passphrase => this._handlePassphraseChange(passphrase)}
          uncontrolled={false}
          style={styleInput}
        />
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
          checked={this.state.showTyping || !!this.props.showTyping}
          style={{marginBottom: globalMargins.medium}}
        />
        <Button
          type="Primary"
          label="Save"
          disabled={!!this.state.errorSaving}
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

export default UpdatePassphrase

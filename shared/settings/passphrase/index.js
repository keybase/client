// @flow
import React, {Component} from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  error?: ?Error,
  newPassphraseError?: ?string,
  newPassphraseConfirmError?: ?string,
  hasPGPKeyOnServer?: boolean,
  onBack?: () => void,
  onSave: (passphrase: string, passphraseConfirm: string) => void,
  showTyping?: boolean,
  waitingForResponse?: boolean,
  onUpdatePGPSettings?: () => void,
}

type State = {
  passphrase: string,
  passphraseConfirm: string,
  showTyping: boolean,
  errorSaving: string,
}

export class UpdatePassphrase extends Component<Props, State> {
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
    return (
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Input
          hintText="New passphrase"
          type={inputType}
          errorText={this.state.errorSaving || this.props.newPassphraseError}
          value={this.state.passphrase}
          onChangeText={passphrase => this._handlePassphraseChange(passphrase)}
          uncontrolled={false}
          style={styleInput}
        />
        <Kb.Input
          hintText="Confirm new passphrase"
          type={inputType}
          value={this.state.passphraseConfirm}
          errorText={this.props.newPassphraseConfirmError}
          onChangeText={passphrase => this._handlePassphraseConfirmChange(passphrase)}
          uncontrolled={false}
          style={styleInput}
        />
        <Kb.Checkbox
          label="Show typing"
          onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
          checked={this.state.showTyping || !!this.props.showTyping}
          style={{marginBottom: Styles.globalMargins.medium}}
        />
        <Kb.Button
          type="Primary"
          label="Save"
          disabled={!!this.state.errorSaving}
          onClick={() => this.props.onSave(this.state.passphrase, this.state.passphraseConfirm)}
          waiting={this.props.waitingForResponse}
        />
      </Kb.Box2>
    )
  }
}

const styleInput = {
  marginBottom: Styles.globalMargins.small,
}

const UpdatePassphraseWrapper = (props: Props) => {
  const notification = props.error
    ? {message: props.error.message, type: 'error'}
    : props.hasPGPKeyOnServer
    ? {
        message:
          "Note: changing your passphrase will delete your PGP key from Keybase, and you'll need to generate or upload one again.",
        type: 'error',
      }
    : null
  return (
    <Kb.StandardScreen onBack={props.onBack} notification={notification} style={{alignItems: 'center'}}>
      <UpdatePassphrase {...props} />
    </Kb.StandardScreen>
  )
}

export default UpdatePassphraseWrapper

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
  saveLabel: string,
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
    if (passphrase && passphraseConfirm && passphrase !== passphraseConfirm) {
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
      <Kb.ScrollView contentContainerStyle={styles.container}>
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Input
            hintText="New passphrase"
            type={inputType}
            errorText={this.props.newPassphraseError}
            value={this.state.passphrase}
            onChangeText={passphrase => this._handlePassphraseChange(passphrase)}
            uncontrolled={false}
            style={styleInput}
          />
          <Kb.Input
            hintText="Confirm new passphrase"
            type={inputType}
            value={this.state.passphraseConfirm}
            errorText={this.state.errorSaving || this.props.newPassphraseConfirmError}
            onChangeText={passphrase => this._handlePassphraseConfirmChange(passphrase)}
            uncontrolled={false}
            style={styleInput}
          />
          <Kb.Checkbox
            label="Show typing"
            onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
            checked={this.state.showTyping || !!this.props.showTyping}
          />
          <Kb.Text style={{marginBottom: Styles.globalMargins.medium}} type="BodySmall">
            (Passphrase must be at least 8 characters.)
          </Kb.Text>
          <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonbar}>
            <Kb.Button
              fullWidth={true}
              type="Primary"
              label={this.props.saveLabel || 'Save'}
              disabled={!!this.state.errorSaving || this.state.passphrase.length < 8}
              onClick={() => this.props.onSave(this.state.passphrase, this.state.passphraseConfirm)}
              waiting={this.props.waitingForResponse}
            />
          </Kb.ButtonBar>
        </Kb.Box2>
      </Kb.ScrollView>
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
    <Kb.StandardScreen notification={notification} style={{alignItems: 'center', margin: 0}}>
      <UpdatePassphrase {...props} />
    </Kb.StandardScreen>
  )
}
const styles = Styles.styleSheetCreate({
  buttonbar: {
    padding: Styles.globalMargins.small,
  },
  container: Styles.platformStyles({
    isElectron: {
      width: 560,
    },
  }),
})

export default UpdatePassphraseWrapper

// @flow
import React, {Component} from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  error?: ?Error,
  newPasswordError?: ?string,
  newPasswordConfirmError?: ?string,
  hasPGPKeyOnServer?: boolean,
  onBack?: () => void,
  onSave: (password: string, passwordConfirm: string) => void,
  saveLabel?: string,
  showTyping?: boolean,
  waitingForResponse?: boolean,
  onUpdatePGPSettings?: () => void,
}

type State = {
  password: string,
  passwordConfirm: string,
  showTyping: boolean,
  errorSaving: string,
}

export class UpdatePassword extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      errorSaving: '',
      password: '',
      passwordConfirm: '',
      showTyping: !!props.showTyping,
    }
  }

  _handlePasswordChange(password: string) {
    this.setState({
      errorSaving: this._errorSaving(password, this.state.passwordConfirm),
      password,
    })
  }

  _handlePasswordConfirmChange(passwordConfirm: string) {
    this.setState({
      errorSaving: this._errorSaving(this.state.password, passwordConfirm),
      passwordConfirm,
    })
  }

  _errorSaving(password: string, passwordConfirm: string): string {
    if (password && passwordConfirm && password !== passwordConfirm) {
      return 'Passwords must match.'
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
            hintText="New password"
            type={inputType}
            errorText={this.props.newPasswordError}
            value={this.state.password}
            onChangeText={password => this._handlePasswordChange(password)}
            uncontrolled={false}
            style={styleInput}
          />
          <Kb.Input
            hintText="Confirm new password"
            type={inputType}
            value={this.state.passwordConfirm}
            errorText={this.state.errorSaving || this.props.newPasswordConfirmError}
            onChangeText={password => this._handlePasswordConfirmChange(password)}
            uncontrolled={false}
            style={styleInput}
          />
          <Kb.Checkbox
            label="Show typing"
            onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
            checked={this.state.showTyping || !!this.props.showTyping}
          />
          <Kb.Text style={{marginBottom: Styles.globalMargins.medium}} type="BodySmall">
            (Password must be at least 8 characters.)
          </Kb.Text>
          <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonbar}>
            <Kb.Button
              fullWidth={true}
              type="Primary"
              label={this.props.saveLabel || 'Save'}
              disabled={!!this.state.errorSaving || this.state.password.length < 8}
              onClick={() => this.props.onSave(this.state.password, this.state.passwordConfirm)}
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

const UpdatePasswordWrapper = (props: Props) => {
  const notification = props.error
    ? {message: props.error.message, type: 'error'}
    : props.hasPGPKeyOnServer
    ? {
        message:
          "Note: changing your password will delete your PGP key from Keybase, and you'll need to generate or upload one again.",
        type: 'error',
      }
    : null
  return (
    <Kb.StandardScreen notification={notification} style={{alignItems: 'center', margin: 0}}>
      <UpdatePassword {...props} />
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

export default UpdatePasswordWrapper

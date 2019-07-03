import React, {Component} from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  error?: Error | null
  hasPGPKeyOnServer?: boolean
  hasRandomPW: boolean
  newPasswordError?: string | null
  newPasswordConfirmError?: string | null
  onBack?: () => void
  onSave: (password: string, passwordConfirm: string) => void
  saveLabel?: string
  showTyping?: boolean
  waitingForResponse?: boolean
  onUpdatePGPSettings?: () => void
}

type State = {
  password: string
  passwordConfirm: string
  showTyping: boolean
  errorSaving: string
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
        <Kb.Box2 centerChildren={true} direction="vertical">
          <Kb.Text style={styles.headerText} type="Header">
            {this.props.hasRandomPW ? 'Set a password' : 'Change password'}
          </Kb.Text>
          <Kb.Text type="Body" style={styles.bodyText} center={true}>
            A password allows you to sign out and sign back in, and use the keybase.io website.
          </Kb.Text>
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
            hintText="Confirm"
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
          <Kb.Text style={styles.passwordFormat} type="BodySmall">
            (Password must be at least 8 characters.)
          </Kb.Text>
          <Kb.ButtonBar align="center" direction="row" fullWidth={true}>
            <Kb.Button
              fullWidth={true}
              label={this.props.saveLabel || 'Save'}
              disabled={
                !!this.state.errorSaving ||
                this.state.password.length < 8 ||
                this.state.password !== this.state.passwordConfirm
              }
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
    ? ({message: props.error.message, type: 'error'} as const)
    : props.hasPGPKeyOnServer
    ? ({
        message:
          "Changing your password will delete your PGP key from Keybase, and you'll need to generate or upload one again.",
        type: 'error',
      } as const)
    : null
  return (
    <Kb.StandardScreen notification={notification} style={{alignItems: 'center', margin: 0}}>
      <UpdatePassword {...props} />
    </Kb.StandardScreen>
  )
}
const styles = Styles.styleSheetCreate({
  bodyText: {
    paddingBottom: Styles.globalMargins.tiny,
  },
  container: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.medium,
    },
    isElectron: {
      width: 560,
    },
    isMobile: {
      width: '100%',
    },
  }),
  headerText: {
    paddingBottom: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  passwordFormat: {
    margin: Styles.globalMargins.small,
    textAlign: 'center',
  },
})

export default UpdatePasswordWrapper

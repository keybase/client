import React, {Component} from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  error?: Error | null
  hasPGPKeyOnServer?: boolean
  hasRandomPW: boolean
  newPasswordError?: string
  newPasswordConfirmError?: string
  onCancel?: () => void
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

class UpdatePassword extends Component<Props, State> {
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

  componentDidMount() {
    this.props.onUpdatePGPSettings && this.props.onUpdatePGPSettings()
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
    return ''
  }

  render() {
    const inputType = this.state.showTyping ? 'text' : 'password'
    const keyboardType = this.state.showTyping && Styles.isAndroid ? 'visible-password' : 'default'
    const notification = this.props.error
      ? this.props.error.message
      : this.props.hasPGPKeyOnServer
      ? "Changing your password will delete your PGP key from Keybase, and you'll need to generate or upload one again."
      : null

    const hintType = this.state.errorSaving
      ? 'BodySmallError'
      : this.state.password.length >= 8 && this.state.passwordConfirm.length >= 8
      ? 'BodySmallSuccess'
      : 'BodySmall'
    const hintText = this.state.errorSaving ? (
      this.state.errorSaving
    ) : this.state.password.length >= 8 && this.state.passwordConfirm.length >= 8 ? (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.passwordFormat}>
        <Kb.Icon type="iconfont-check" color={Styles.globalColors.green} sizeType="Small" />
        <Kb.Text type="BodySmallSuccess">Passwords match.</Kb.Text>
      </Kb.Box2>
    ) : (
      'Password must be at least 8 characters.'
    )

    return (
      <Kb.Modal
        banners={[
          notification && (
            <Kb.Banner color="yellow">
              <Kb.BannerParagraph bannerColor="yellow" content={notification} />
            </Kb.Banner>
          ),
          !!this.props.newPasswordError && (
            <Kb.Banner color="red">
              <Kb.BannerParagraph bannerColor="red" content={this.props.newPasswordError} />
            </Kb.Banner>
          ),
          this.props.hasPGPKeyOnServer === null && (
            <Kb.Banner color="red">
              <Kb.BannerParagraph
                bannerColor="red"
                content="There was a problem downloading your PGP key status."
              />
            </Kb.Banner>
          ),
          !!this.props.newPasswordConfirmError && (
            <Kb.Banner color="red">
              <Kb.BannerParagraph bannerColor="red" content={this.props.newPasswordConfirmError} />
            </Kb.Banner>
          ),
        ]}
        footer={{
          content: (
            <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
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
          ),
        }}
        header={{
          leftButton: Styles.isMobile ? (
            <Kb.Text type="BodyBigLink" onClick={this.props.onCancel}>
              Cancel
            </Kb.Text>
          ) : null,
          title: this.props.hasRandomPW ? 'Set a password' : 'Change password',
        }}
        onClose={this.props.onCancel}
      >
        <Kb.Box2 centerChildren={true} direction="vertical" fullHeight={true} style={styles.container}>
          <Kb.Text type="Body" style={styles.bodyText} center={true}>
            A password is required for you to sign out and sign back in, and use the keybase.io website.
          </Kb.Text>
          <Kb.RoundedBox side="top">
            <Kb.PlainInput
              placeholder="New password"
              type={inputType}
              keyboardType={keyboardType}
              value={this.state.password}
              onChangeText={password => this._handlePasswordChange(password)}
            />
          </Kb.RoundedBox>
          <Kb.RoundedBox side="bottom">
            <Kb.PlainInput
              placeholder="Confirm password"
              type={inputType}
              keyboardType={keyboardType}
              value={this.state.passwordConfirm}
              onChangeText={password => this._handlePasswordConfirmChange(password)}
              onEnterKeyDown={() => {
                if (
                  !this.state.errorSaving &&
                  this.state.password.length >= 8 &&
                  this.state.password === this.state.passwordConfirm
                ) {
                  this.props.onSave(this.state.password, this.state.passwordConfirm)
                }
              }}
            />
          </Kb.RoundedBox>
          {typeof hintText === 'string' ? (
            <Kb.Text style={styles.passwordFormat} type={hintType}>
              {hintText}
            </Kb.Text>
          ) : (
            hintText
          )}
          <Kb.Checkbox
            boxBackgroundColor={Styles.globalColors.white}
            label="Show typing"
            onCheck={() => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
            checked={this.state.showTyping || !!this.props.showTyping}
            style={styles.checkbox}
          />
        </Kb.Box2>
      </Kb.Modal>
    )
  }
}

const styles = Styles.styleSheetCreate({
  bodyText: {
    paddingBottom: Styles.globalMargins.small,
  },
  buttonBar: {
    minHeight: undefined,
  },
  checkbox: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
    width: '100%',
  },
  container: {
    backgroundColor: Styles.globalColors.blueGrey,
    flexGrow: 1,
    padding: Styles.globalMargins.small,
  },
  headerText: {
    paddingBottom: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  passwordFormat: {
    alignSelf: 'flex-start',
    marginTop: Styles.globalMargins.xtiny,
  },
})

export default UpdatePassword

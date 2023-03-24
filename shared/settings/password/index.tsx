import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  error?: Error | null
  hasPGPKeyOnServer?: boolean
  hasRandomPW: boolean
  newPasswordError?: string
  newPasswordConfirmError?: string
  onCancel?: () => void
  onSave: (password: string) => void // will only be called if password.length > 8 & passwords match
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

class UpdatePassword extends React.Component<Props, State> {
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
    this.setState(s => ({
      errorSaving: this._errorSaving(password, s.passwordConfirm),
      password,
    }))
  }

  _handlePasswordConfirmChange(passwordConfirm: string) {
    this.setState(s => ({
      errorSaving: this._errorSaving(s.password, passwordConfirm),
      passwordConfirm,
    }))
  }

  _errorSaving(password: string, passwordConfirm: string): string {
    if (password && passwordConfirm && password !== passwordConfirm) {
      return 'Passwords must match.'
    }
    return ''
  }

  private canSubmit = () =>
    !this.state.errorSaving &&
    this.state.password.length >= 8 &&
    this.state.password === this.state.passwordConfirm

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
        backgroundStyle={styles.passwordBackground}
        banners={
          <>
            {notification ? (
              <Kb.Banner color="yellow">
                <Kb.BannerParagraph bannerColor="yellow" content={notification} />
              </Kb.Banner>
            ) : null}
            {this.props.newPasswordError ? (
              <Kb.Banner color="red">
                <Kb.BannerParagraph bannerColor="red" content={this.props.newPasswordError} />
              </Kb.Banner>
            ) : null}
            {this.props.hasPGPKeyOnServer === null ? (
              <Kb.Banner color="red">
                <Kb.BannerParagraph
                  bannerColor="red"
                  content="There was a problem downloading your PGP key status."
                />
              </Kb.Banner>
            ) : null}
            {this.props.newPasswordConfirmError ? (
              <Kb.Banner color="red">
                <Kb.BannerParagraph bannerColor="red" content={this.props.newPasswordConfirmError} />
              </Kb.Banner>
            ) : null}
          </>
        }
        footer={{
          content: (
            <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
              <Kb.Button
                fullWidth={true}
                label={this.props.saveLabel || 'Save'}
                disabled={!this.canSubmit()}
                onClick={() => this.props.onSave(this.state.password)}
                waiting={this.props.waitingForResponse}
              />
            </Kb.ButtonBar>
          ),
        }}
        header={{
          leftButton:
            Styles.isMobile && this.props.onCancel ? (
              <Kb.Text type="BodyBigLink" onClick={this.props.onCancel}>
                Cancel
              </Kb.Text>
            ) : null,
          title: this.props.hasRandomPW ? 'Set a password' : 'Change password',
        }}
        onClose={this.props.onCancel}
      >
        <Kb.Box2
          centerChildren={!Styles.isTablet}
          direction="vertical"
          fullHeight={true}
          style={styles.container}
        >
          <Kb.Text type="Body" style={styles.bodyText} center={true}>
            A password is required for you to sign out and sign back in.
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
                if (this.canSubmit()) {
                  this.props.onSave(this.state.password)
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
      passwordBackground: Styles.platformStyles({
        isTablet: {
          backgroundColor: Styles.globalColors.blueGrey,
        },
      }),
      passwordFormat: {
        alignSelf: 'flex-start',
        marginTop: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default UpdatePassword

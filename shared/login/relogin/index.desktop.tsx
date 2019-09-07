import * as React from 'react'
import * as Constants from '../../constants/login'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {errorBanner, SignupScreen} from '../../signup/common'
import {Props} from '.'

type State = {
  open: boolean
}

const ItemBox = Styles.styled(Kb.Box)({
  ...Styles.globalStyles.flexBoxCenter,
  minHeight: 40,
  width: '100%',
})

const other = 'Someone else...'

const UserRow = ({user}) => (
  <ItemBox>
    <Kb.Text type="Header" style={user === other ? styles.other : styles.provisioned}>
      {user}
    </Kb.Text>
  </ItemBox>
)

class Login extends React.Component<Props, State> {
  _inputRef = React.createRef<Kb.Input>()

  state = {
    open: false,
  }

  _toggleOpen = () => {
    this.setState(prevState => ({open: !prevState.open}))
  }

  _onClickUser = (selected: React.ReactElement) => {
    if (selected.props.user === other) {
      this._toggleOpen()
      this.props.onSomeoneElse()
    } else {
      this._toggleOpen()
      this.props.selectedUserChange(selected.props.user)
      if (this._inputRef.current) {
        this._inputRef.current.focus()
      }
    }
  }

  render() {
    const inputProps = {
      autoFocus: true,
      errorText: this.props.inputError,
      floatingHintTextOverride: '',
      hideLabel: true,
      hintText: 'Password',
      inputStyle: styles.passwordInput,
      key: this.props.inputKey,
      onChangeText: password => this.props.passwordChange(password),
      onEnterKeyDown: () => this.props.onSubmit(),
      ref: this._inputRef,
      style: styles.passwordInputContainer,
      type: this.props.showTyping ? 'passwordVisible' : 'password',
      uncontrolled: true,
    } as const

    const userRows = this.props.users
      .concat({hasStoredSecret: false, username: other})
      .map(u => <UserRow user={u.username} key={u.username} />)

    const selectedIdx = this.props.users.findIndex(u => u.username === this.props.selectedUser)

    const temp = (
      <Kb.Text style={{marginTop: 30}} type="BodyPrimaryLink" onClick={this.props.onSignup}>
        Create an account
      </Kb.Text>
    )
    return (
      <SignupScreen banners={errorBanner(this.props.bannerError)} headerStyle={styles.header} title="Log in">
        <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.contentBox}>
          <Kb.UserCard
            username={this.props.selectedUser}
            outerStyle={styles.container}
            style={styles.userContainer}
          >
            <Kb.Dropdown
              onChanged={this._onClickUser}
              selected={userRows[selectedIdx]}
              items={userRows}
              position="bottom center"
              style={styles.userDropdown}
            />
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputRow}>
              <Kb.Input {...inputProps} />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.forgotPasswordContainer}>
              <Kb.Text
                type="BodySmallSecondaryLink"
                onClick={this.props.onForgotPassword}
                style={styles.forgotPassword}
              >
                Forgot password?
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2
              direction="vertical"
              fullWidth={true}
              fullHeight={true}
              style={styles.loginSubmitContainer}
            >
              <Kb.WaitingButton
                disabled={!this.props.password}
                fullWidth={true}
                waitingKey={Constants.waitingKey}
                style={styles.loginSubmitButton}
                label="Log in"
                onClick={this.props.onSubmit}
              />
            </Kb.Box2>
          </Kb.UserCard>
        </Kb.Box2>
      </SignupScreen>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  contentBox: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 460,
    padding: Styles.globalMargins.small,
  },
  forgotPassword: {
    marginTop: Styles.globalMargins.tiny,
  },
  forgotPasswordContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  header: {
    borderBottomWidth: 0,
  },
  inputRow: {
    flex: 1,
  },
  loginSubmitButton: {
    marginTop: 0,
    maxHeight: 32,
    width: '100%',
  },
  loginSubmitContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  other: {color: Styles.globalColors.black},
  passwordInput: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    paddingBottom: Styles.globalMargins.medium,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.medium,
    textAlign: 'left',
    width: '100%',
  },
  passwordInputContainer: {
    marginBottom: 0,
    marginTop: Styles.globalMargins.tiny,
    width: '100%',
  },
  provisioned: {color: Styles.globalColors.orange},
  userContainer: {
    backgroundColor: Styles.globalColors.transparent,
  },
  userDropdown: {
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
}))

export default Login

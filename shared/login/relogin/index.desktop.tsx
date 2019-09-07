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
      hintText: 'Password',
      key: this.props.inputKey,
      onChangeText: password => this.props.passwordChange(password),
      onEnterKeyDown: () => this.props.onSubmit(),
      ref: this._inputRef,
      type: this.props.showTyping ? 'passwordVisible' : 'password',
      uncontrolled: true,
    } as const

    const checkboxProps = [
      {
        checked: this.props.showTyping,
        label: 'Show typing',
        onCheck: check => {
          this.props.showTypingChange(check)
        },
      } as const,
    ]

    const userRows = this.props.users
      .concat({hasStoredSecret: false, username: other})
      .map(u => <UserRow user={u.username} key={u.username} />)

    const selectedIdx = this.props.users.findIndex(u => u.username === this.props.selectedUser)

    return (
      <SignupScreen banners={errorBanner(this.props.bannerError)} title="Log in">
        <Kb.Box2
          direction="vertical"
          fullHeight={true}
          fullWidth={true}
          style={styles.contentBox}
          gap="medium"
        >
          <Kb.Box style={styles.userContainer}>
            <Kb.UserCard username={this.props.selectedUser}>
              <Kb.Dropdown
                onChanged={this._onClickUser}
                selected={userRows[selectedIdx]}
                items={userRows}
                position="bottom center"
              />
              <Kb.FormWithCheckbox
                style={{alignSelf: 'stretch'}}
                inputProps={inputProps}
                checkboxesProps={checkboxProps}
              />
              <Kb.WaitingButton
                disabled={!this.props.password}
                fullWidth={true}
                waitingKey={Constants.waitingKey}
                style={{marginTop: 0, width: '100%'}}
                label="Log in"
                onClick={() => this.props.onSubmit()}
              />
              <Kb.Text
                type="BodySmallSecondaryLink"
                onClick={this.props.onForgotPassword}
                style={{marginTop: 24}}
              >
                Forgot password?
              </Kb.Text>
            </Kb.UserCard>
            <Kb.Text style={{marginTop: 30}} type="BodyPrimaryLink" onClick={this.props.onSignup}>
              Create an account
            </Kb.Text>
          </Kb.Box>
        </Kb.Box2>
      </SignupScreen>
    )
  }
}

const styles = Styles.styleSheetCreate({
  contentBox: Styles.platformStyles({
    common: {alignSelf: 'center', flexGrow: 1},
    isElectron: {
      maxWidth: 460,
      padding: Styles.globalMargins.small,
    },
  }),
  other: {color: Styles.globalColors.black},
  provisioned: {color: Styles.globalColors.orange},
  userContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.transparent,
    flex: 1,
    justifyContent: 'center',
  },
})

export default Login

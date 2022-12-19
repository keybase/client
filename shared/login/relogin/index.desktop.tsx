import * as React from 'react'
import * as Constants from '../../constants/login'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import UserCard from '../user-card'
import {errorBanner, SignupScreen} from '../../signup/common'
import type {Props} from '.'

type State = {
  open: boolean
}

const other = 'Someone else...'

const UserRow = ({user, hasStoredSecret}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.userRow} gap="xtiny">
    <Kb.Text type="Header" style={user === other ? styles.other : styles.provisioned}>
      {user}
    </Kb.Text>
    {hasStoredSecret && <Kb.Text type="BodySmall"> • Signed in</Kb.Text>}
  </Kb.Box2>
)

class Login extends React.Component<Props, State> {
  _inputRef = React.createRef<Kb.PlainInput>()

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
    const userRows = this.props.users
      .concat({hasStoredSecret: false, username: other})
      .map(u => <UserRow user={u.username} key={u.username} hasStoredSecret={u.hasStoredSecret} />)

    const selectedIdx = this.props.users.findIndex(u => u.username === this.props.selectedUser)
    return (
      <SignupScreen
        banners={errorBanner(this.props.error)}
        headerStyle={styles.header}
        onRightAction={this.props.onSignup}
        rightActionLabel="Create an account"
        title="Log in"
      >
        <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.contentBox}>
          <UserCard
            username={this.props.selectedUser}
            outerStyle={styles.container}
            style={styles.userContainer}
          >
            <Kb.Dropdown
              onChanged={this._onClickUser}
              selected={userRows[selectedIdx]}
              items={userRows}
              overlayStyle={styles.userOverlayStyle}
              position="bottom center"
              style={styles.userDropdown}
            />
            {this.props.needPassword && (
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputRow}>
                <Kb.LabeledInput
                  autoFocus={true}
                  placeholder="Password"
                  onChangeText={this.props.passwordChange}
                  onEnterKeyDown={this.props.onSubmit}
                  ref={this._inputRef}
                  type="password"
                  value={this.props.password}
                />
              </Kb.Box2>
            )}
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
                disabled={this.props.needPassword && !this.props.password}
                fullWidth={true}
                waitingKey={Constants.waitingKey}
                style={styles.loginSubmitButton}
                label="Log in"
                onClick={this.props.onSubmit}
              />
            </Kb.Box2>
          </UserCard>
        </Kb.Box2>
      </SignupScreen>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
        marginBottom: 0,
        marginTop: Styles.globalMargins.tiny,
        width: '100%',
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
      provisioned: {color: Styles.globalColors.orange},
      userContainer: {
        backgroundColor: Styles.globalColors.transparent,
        flex: 1,
      },
      userDropdown: {
        backgroundColor: Styles.globalColors.white,
        width: '100%',
      },
      userOverlayStyle: {
        backgroundColor: Styles.globalColors.white,
        width: 348,
      },
      userRow: {
        alignItems: 'center',
        marginLeft: Styles.globalMargins.xsmall,
        minHeight: 40,
        width: '100%',
      },
    } as const)
)

export default Login

import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import UpdatePassword from '../../settings/password'

export type Props = {
  checkPasswordIsCorrect: boolean | null
  hasRandomPW: boolean | null
  onBootstrap: () => void
  onCancel: () => void
  onCheckPassword: (password: string) => void
  onLogout: () => void
  onSavePassword: (password: string, passwordConfirm: string) => void
  waitingForResponse: boolean
}

type State = {
  password: string
  showTyping: boolean
}

class LogOut extends React.Component<Props, State> {
  state = {
    password: '',
    showTyping: false,
  }

  componentDidMount() {
    this.props.onBootstrap()
  }

  render() {
    const inputType = this.state.showTyping ? 'passwordVisible' : 'password'
    const keyboardType = this.state.showTyping && Styles.isAndroid ? 'visible-password' : 'default'
    return (
      <Kb.Box2 direction="vertical">
        {this.props.hasRandomPW == null ? (
          <Kb.ProgressIndicator />
        ) : this.props.hasRandomPW ? (
          <UpdatePassword
            hasRandomPW={this.props.hasRandomPW}
            onCancel={this.props.onCancel}
            onSave={this.props.onSavePassword}
            saveLabel="Sign out"
            waitingForResponse={this.props.waitingForResponse}
          />
        ) : (
          <Kb.Modal
            banners={[
              this.props.checkPasswordIsCorrect === false && <Kb.Banner color="red" text="Wrong password. Please try again." />,
              this.props.checkPasswordIsCorrect === true && <Kb.Banner color="green" text="Your password is correct." />
            ]}
            footer={{
              content: !this.props.checkPasswordIsCorrect ? (
                <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
                  <Kb.Button onClick={this.props.onLogout} label="Just sign out" fullWidth={true} type="Dim" />
                  <Kb.WaitingButton
                    fullWidth={true}
                    waitingKey={Constants.checkPasswordWaitingKey}
                    disabled={!!this.props.checkPasswordIsCorrect}
                    label="Test password"
                    onClick={() => {
                      this.props.onCheckPassword(this.state.password)
                    }}
                  />
                </Kb.ButtonBar>
              ) : (
                <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
                  <Kb.Button
                    label="Safely sign out"
                    fullWidth={true}
                    onClick={this.props.onLogout}
                    type="Success"
                  />
                </Kb.ButtonBar>
              )
            }}
            header={{
              leftButton: Styles.isMobile ? (
                <Kb.Text type="BodyBigLink" onClick={this.props.onCancel}>
                  Cancel
                </Kb.Text>
              ) : null,
              title: 'Do you know your password?',
            }}
            onClose={this.props.onCancel}
          >
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
              <Kb.Text style={styles.bodyText} type="Body">
                You will need it to sign back in.
              </Kb.Text>
                <Kb.PlainInput
                  keyboardType={keyboardType}
                  onChangeText={password => this.setState({password})}
                  placeholder="Your password"
                  style={styles.input}
                  type={inputType}
                  value={this.state.password}
                />
                <Kb.Checkbox
                  boxBackgroundColor={Styles.globalColors.white}
                  label="Show typing"
                  onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
                  checked={this.state.showTyping}
                />
            </Kb.Box2>
          </Kb.Modal>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  bodyText: {
    paddingBottom: Styles.globalMargins.tiny,
    textAlign: 'center',
  },
  buttonBar: {
    minHeight: undefined,
  },
  container: {
    backgroundColor: Styles.globalColors.blueGrey,
    flexGrow: 1,
    padding: Styles.globalMargins.small,
  },
  input: {
    borderColor: Styles.globalColors.greyDark,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
  },
})

export default LogOut

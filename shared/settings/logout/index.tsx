import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import {UpdatePassword} from '../../settings/password'

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

type TestProps = {
  checkPasswordIsCorrect: boolean | null
  onCancel: () => void
  onCheckPassword: (password: string) => void
  onLogout: () => void
}

type State = {
  password: string
  showTyping: boolean
}

class OfferToCheckPassword extends React.Component<TestProps, State> {
  state = {
    password: '',
    showTyping: false,
  }

  render() {
    const inputType = this.state.showTyping ? 'passwordVisible' : 'password'
    return (
      <>
        <Kb.Box2 direction="vertical" centerChildren={true} style={styles.offer}>
          {!this.props.checkPasswordIsCorrect && (
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.Input
                errorText={
                  this.props.checkPasswordIsCorrect === false ? 'Wrong password. Please try again.' : ''
                }
                hintText="Your password"
                type={inputType}
                value={this.state.password}
                onChangeText={password => this.setState({password})}
                uncontrolled={false}
                style={styles.input}
              />
              <Kb.Checkbox
                label="Show typing"
                onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
                checked={this.state.showTyping}
              />
            </Kb.Box2>
          )}
        </Kb.Box2>
        {!this.props.checkPasswordIsCorrect ? (
          <Kb.Box2 direction="vertical">
            <Kb.ButtonBar align="center" direction="row" fullWidth={true}>
              {!Styles.isMobile && (
                <Kb.Button onClick={this.props.onCancel} label="Cancel" fullWidth={true} type="Dim" />
              )}
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
            <Kb.Box2 direction="horizontal" gap="xtiny" style={{marginBottom: Styles.globalMargins.medium}}>
              <Kb.Icon type="iconfont-leave" sizeType="Small" color={Styles.globalColors.black_50} />
              <Kb.Text type="BodySmallSecondaryLink" onClick={this.props.onLogout}>
                Just sign out
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        ) : (
          <Kb.ButtonBar align="center" direction="row" fullWidth={true}>
            <Kb.Button
              label="Safely sign out"
              fullWidth={true}
              onClick={this.props.onLogout}
              type="Success"
            />
          </Kb.ButtonBar>
        )}
      </>
    )
  }
}

class LogOut extends React.Component<Props> {
  componentDidMount() {
    this.props.onBootstrap()
  }

  render() {
    return (
      <Kb.Box2 direction="vertical">
        {this.props.hasRandomPW == null ? (
          <Kb.ProgressIndicator />
        ) : this.props.hasRandomPW ? (
          <UpdatePassword
            hasRandomPW={this.props.hasRandomPW}
            onSave={this.props.onSavePassword}
            saveLabel="Sign out"
            waitingForResponse={this.props.waitingForResponse}
          />
        ) : (
          <Kb.ScrollView contentContainerStyle={styles.container}>
            <Kb.Box2 centerChildren={true} direction="vertical">
              {this.props.checkPasswordIsCorrect ? (
                <Kb.Box2 direction="vertical" gap="xtiny" centerChildren={true} style={styles.headerText}>
                  <Kb.Icon type="iconfont-check" sizeType="Small" color={Styles.globalColors.green} />
                  <Kb.Text style={{color: Styles.globalColors.greenDark}} type="Header">
                    Your password is correct.
                  </Kb.Text>
                </Kb.Box2>
              ) : (
                <Kb.Text style={styles.headerText} type="Header">
                  Do you know your password?
                </Kb.Text>
              )}
              <Kb.Text style={styles.bodyText} type="Body">
                You will need it to sign back in.
              </Kb.Text>
              <OfferToCheckPassword
                checkPasswordIsCorrect={this.props.checkPasswordIsCorrect}
                onCancel={this.props.onCancel}
                onCheckPassword={this.props.onCheckPassword}
                onLogout={this.props.onLogout}
              />
            </Kb.Box2>
          </Kb.ScrollView>
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
  input: {
    marginBottom: Styles.globalMargins.small,
  },
  // Avoid moving the buttons down when an errorText is added
  offer: {minHeight: 200},
})

export default LogOut

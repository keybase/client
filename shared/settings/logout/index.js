// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import {UpdatePassword} from '../../settings/password'

export type Props = {|
  checkPasswordIsCorrect: ?boolean,
  hasRandomPW: ?boolean,
  onCancel: () => void,
  onCheckPassword: (password: string) => void,
  onLogout: () => void,
  onSavePassword: (password: string, passwordConfirm: string) => void,
  waitingForResponse: boolean,
|}

type TestProps = {|
  checkPasswordIsCorrect: ?boolean,
  onCheckPassword: (password: string) => void,
  onLogout: () => void,
|}

type State = {|
  password: string,
  showTyping: boolean,
|}

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
          <Kb.Input
            errorText={
              this.props.checkPasswordIsCorrect === false
                ? 'Your password was incorrect, please try again.'
                : ''
            }
            hintText="Enter your password"
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
          {this.props.checkPasswordIsCorrect && (
            <Kb.Box2 direction="horizontal" gap="xtiny">
              <Kb.Icon type="iconfont-check" color={Styles.globalColors.green} />
              <Kb.Text style={{color: Styles.globalColors.green}} type="BodySmall">
                Your password is correct.
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
        <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonbar}>
          <Kb.Button
            fullWidth={true}
            label={this.props.checkPasswordIsCorrect ? 'Safely sign out' : 'Just sign out'}
            onClick={this.props.onLogout}
            type={this.props.checkPasswordIsCorrect ? 'PrimaryGreen' : 'Danger'}
          />

          {!this.props.checkPasswordIsCorrect && (
            <Kb.WaitingButton
              fullWidth={true}
              waitingKey={Constants.checkPasswordWaitingKey}
              type={this.props.checkPasswordIsCorrect ? 'PrimaryGreen' : 'Primary'}
              disabled={!!this.props.checkPasswordIsCorrect}
              label="Test password"
              onClick={() => {
                this.props.onCheckPassword(this.state.password)
              }}
            />
          )}
        </Kb.ButtonBar>
      </>
    )
  }
}

export default (props: Props) => (
  <Kb.ScrollView contentContainerStyle={styles.container}>
    {props.hasRandomPW ? (
      <Kb.Box2 centerChildren={true} direction="vertical">
        <Kb.Text type="Body">
          You don't have a password set -- you should set one before signing out, so that you can sign in
          again later.
        </Kb.Text>
        <UpdatePassword
          onSave={props.onSavePassword}
          saveLabel="Create password and sign out"
          waitingForResponse={props.waitingForResponse}
        />
      </Kb.Box2>
    ) : (
      <Kb.Box2 centerChildren={true} direction="vertical">
        <Kb.Text style={styles.bodyText} type="Body">
          Would you like to make sure that you know your password before signing out?
        </Kb.Text>
        <Kb.Text style={styles.bodyText} type="Body">
          You'll need it to sign back in.
        </Kb.Text>
        <OfferToCheckPassword
          checkPasswordIsCorrect={props.checkPasswordIsCorrect}
          onCheckPassword={props.onCheckPassword}
          onLogout={props.onLogout}
        />
      </Kb.Box2>
    )}
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  bodyText: {
    paddingBottom: Styles.globalMargins.tiny,
    textAlign: 'center',
  },
  buttonbar: {
    padding: Styles.globalMargins.small,
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
  }),
  input: {
    marginBottom: Styles.globalMargins.small,
  },
  // Avoid moving the buttons down when an errorText is added
  offer: Styles.platformStyles({isElectron: {minHeight: 200}}),
})

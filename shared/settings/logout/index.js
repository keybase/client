// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import {UpdatePassphrase} from '../../settings/passphrase'

export type Props = {|
  checkPassphraseIsCorrect: ?boolean,
  hasRandomPW: ?boolean,
  onCancel: () => void,
  onCheckPassphrase: (passphrase: string) => void,
  onLogout: () => void,
  onSavePassphrase: (passphrase: string, passphraseConfirm: string) => void,
  waitingForResponse: boolean,
|}

type TestProps = {|
  checkPassphraseIsCorrect: ?boolean,
  onCheckPassphrase: (passphrase: string) => void,
  onLogout: () => void,
|}

type State = {|
  passphrase: string,
  showTyping: boolean,
|}

class OfferToCheckPassphrase extends React.Component<TestProps, State> {
  state: State
  state = {
    passphrase: '',
    showTyping: false,
  }

  render() {
    const inputType = this.state.showTyping ? 'passwordVisible' : 'password'
    return (
      <>
        <Kb.Box2 direction="vertical" centerChildren={true} style={styles.offer}>
          <Kb.Input
            errorText={
              this.props.checkPassphraseIsCorrect === false
                ? 'Your passphrase was incorrect, please try again.'
                : ''
            }
            hintText="Enter your passphrase"
            type={inputType}
            value={this.state.passphrase}
            onChangeText={passphrase => this.setState({passphrase})}
            uncontrolled={false}
            style={styles.input}
          />
          <Kb.Checkbox
            label="Show typing"
            onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
            checked={this.state.showTyping}
          />
          {this.props.checkPassphraseIsCorrect && (
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
            label={this.props.checkPassphraseIsCorrect ? 'Safely sign out' : 'Just sign out'}
            onClick={() => this.props.onLogout()}
            type={this.props.checkPassphraseIsCorrect ? 'PrimaryGreen' : 'Danger'}
          />

          {!this.props.checkPassphraseIsCorrect && (
            <Kb.WaitingButton
              fullWidth={true}
              waitingKey={Constants.checkPassphraseWaitingKey}
              type={this.props.checkPassphraseIsCorrect ? 'PrimaryGreen' : 'Primary'}
              disabled={!!this.props.checkPassphraseIsCorrect}
              label="Test password"
              onClick={() => {
                this.props.onCheckPassphrase(this.state.passphrase)
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
          You don't have a passphrase set -- you should set one before logging out, so that you can log in
          again later.
        </Kb.Text>
        <UpdatePassphrase
          onSave={props.onSavePassphrase}
          saveLabel="Create passphrase and sign out"
          waitingForResponse={props.waitingForResponse}
        />
      </Kb.Box2>
    ) : (
      <Kb.Box2 centerChildren={true} direction="vertical">
        <Kb.Text style={styles.bodyText} type="Body">
          Would you like to make sure that you know your passphrase before signing out?
        </Kb.Text>
        <Kb.Text style={styles.bodyText} type="Body">
          You'll need it to log back in.
        </Kb.Text>
        <OfferToCheckPassphrase
          checkPassphraseIsCorrect={props.checkPassphraseIsCorrect}
          onCheckPassphrase={props.onCheckPassphrase}
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

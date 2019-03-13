// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import {UpdatePassphrase} from '../../settings/passphrase'

export type Props = {|
  hasRandomPW: ?boolean,
  heading: string,
  onCancel: () => void,
  onLogout: () => void,
  onTestPassphrase: (passphrase: string) => void,
  onSavePassphrase: (passphrase: string, passphraseConfirm: string) => void,
  testPassphraseIsCorrect: ?boolean,
  waitingForResponse: boolean,
|}

type TestProps = {|
  heading: string,
  onLogout: () => void,
  onTestPassphrase: (passphrase: string) => void,
  testPassphraseIsCorrect: ?boolean,
|}

type State = {|
  passphrase: string,
  showTyping: boolean,
|}

class OfferToTestPassphrase extends React.Component<TestProps, State> {
  state: State
  state = {
    passphrase: '',
    showTyping: false,
  }

  render() {
    const inputType = this.state.showTyping ? 'passwordVisible' : 'password'
    return (
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Input
          errorText={
            this.props.testPassphraseIsCorrect === false
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
          style={{marginBottom: Styles.globalMargins.medium}}
        />

        <Kb.WaitingButton
          waitingKey={Constants.testPassphraseWaitingKey}
          type="Primary"
          disabled={!!this.props.testPassphraseIsCorrect}
          label={this.props.testPassphraseIsCorrect ? 'Passphrase is correct!' : 'Test my passphrase'}
          onClick={() => {
            this.props.onTestPassphrase(this.state.passphrase)
          }}
        />

        <Kb.Box2 style={{paddingTop: Styles.globalMargins.medium}} direction="vertical">
          <Kb.Button
            label={this.props.testPassphraseIsCorrect ? 'Log out' : 'No thanks, just log me out now.'}
            onClick={() => this.props.onLogout()}
            small={true}
            type={this.props.testPassphraseIsCorrect ? 'PrimaryGreen' : 'Danger'}
          />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

export default (props: Props) => (
  <Kb.ScrollView contentContainerStyle={{padding: Styles.globalMargins.large}}>
    <Kb.Text type="Body">{props.heading}</Kb.Text>
    {props.hasRandomPW ? (
      <UpdatePassphrase
        heading={props.heading}
        onSave={props.onSavePassphrase}
        saveLabel="Save and log out"
        waitingForResponse={props.waitingForResponse}
      />
    ) : (
      <OfferToTestPassphrase
        heading={props.heading}
        onLogout={props.onLogout}
        onTestPassphrase={props.onTestPassphrase}
        testPassphraseIsCorrect={props.testPassphraseIsCorrect}
      />
    )}
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  input: {
    marginBottom: Styles.globalMargins.small,
  },
})

// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import NeedToSetPassphrase from '../../settings/passphrase'

export type Props = {|
  hasRandomPW: boolean,
  heading: string,
  testPassphraseIsCorrect: ?boolean,
|}

type TestProps = {|
  heading: string,
  onTestPassphrase: (passphrase: string) => void,
  testPassphraseIsCorrect: ?boolean,
|}

type State = {|
  passphrase: string,
  showTyping: boolean,
  testPassphraseIsCorrect: ?boolean,
|}

class OfferToTestPassphrase extends React.Component<TestProps, State> {
  state: State
  state = {passphrase: '', showTyping: false, testPassphraseIsCorrect: this.props.testPassphraseIsCorrect}

  componentDidUpdate(prevProps: TestProps, prevState: State) {
    console.warn(this.props.testPassphraseIsCorrect)
    console.warn(prevState.testPassphraseIsCorrect)
    if (this.props.testPassphraseIsCorrect !== prevProps.testPassphraseIsCorrect) {
      console.warn('setting state')
      this.setState({testPassphraseIsCorrect: this.props.testPassphraseIsCorrect})
    }
  }

  _updatePassphrase(passphrase: string) {
    this.setState({
      passphrase,
      testPassphraseIsCorrect: null,
    })
  }

  render() {
    const inputType = this.state.showTyping ? 'passwordVisible' : 'password'
    console.warn('in offer with', this.props, this.state)

    return (
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Input
          errorText={
            this.state.testPassphraseIsCorrect === false
              ? 'Your passphrase was incorrect, please try again.'
              : ''
          }
          hintText="Enter your passphrase"
          type={inputType}
          value={this.state.passphrase}
          onChangeText={passphrase => this._updatePassphrase(passphrase)}
          uncontrolled={false}
          style={styles.input}
        />
        <Kb.Checkbox
          label="Show typing"
          onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
          checked={this.state.showTyping}
          style={{marginBottom: Styles.globalMargins.medium}}
        />

        <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={false}>
          <Kb.WaitingButton
            waitingKey={Constants.testPassphraseWaitingKey}
            type="Primary"
            disabled={!!this.state.testPassphraseIsCorrect}
            label={this.state.testPassphraseIsCorrect ? 'Your passphrase was correct!' : 'Test my passphrase'}
            onClick={() => this.props.onTestPassphrase(this.state.passphrase)}
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
      <NeedToSetPassphrase heading={props.heading} />
    ) : (
      <OfferToTestPassphrase
        heading={props.heading}
        onTestPassphrase={props.onTestPassphrase}
        testPassphraseIsCorrect={props.testPassphraseIsCorrect}
        waiting={props.waiting}
      />
    )}

    <Kb.Box2 style={{paddingTop: Styles.globalMargins.medium}} direction="vertical">
      <Kb.Button
        label={props.testPassphraseIsCorrect ? 'Log out' : 'No thanks, just log me out now.'}
        onClick={() => props.onLogout()}
        small={true}
        type={props.testPassphraseIsCorrect ? 'PrimaryGreen' : 'Danger'}
      />
    </Kb.Box2>
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  input: {
    marginBottom: Styles.globalMargins.small,
  },
})

// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import {UpdatePassphrase} from '../../settings/passphrase'

export type Props = {|
  checkPassphraseIsCorrect: ?boolean,
  hasRandomPW: ?boolean,
  heading: string,
  onCancel: () => void,
  onCheckPassphrase: (passphrase: string) => void,
  onLogout: () => void,
  onSavePassphrase: (passphrase: string, passphraseConfirm: string) => void,
  waitingForResponse: boolean,
|}

type TestProps = {|
  checkPassphraseIsCorrect: ?boolean,
  heading: string,
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
      <Kb.Box2 direction="vertical" centerChildren={true}>
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
          style={styles.checkbox}
        />

        <Kb.WaitingButton
          waitingKey={Constants.checkPassphraseWaitingKey}
          type="Primary"
          disabled={!!this.props.checkPassphraseIsCorrect}
          label={this.props.checkPassphraseIsCorrect ? 'Passphrase is correct!' : 'Test my passphrase'}
          onClick={() => {
            this.props.onCheckPassphrase(this.state.passphrase)
          }}
        />

        <Kb.Box2 style={styles.logoutbox} direction="vertical">
          <Kb.Button
            label={this.props.checkPassphraseIsCorrect ? 'Log out' : 'No thanks, just log me out now.'}
            onClick={() => this.props.onLogout()}
            small={true}
            type={this.props.checkPassphraseIsCorrect ? 'PrimaryGreen' : 'Danger'}
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
        waitingForResponse={props.waitingForResponse}
      />
    ) : (
      <OfferToCheckPassphrase
        checkPassphraseIsCorrect={props.checkPassphraseIsCorrect}
        heading={props.heading}
        onCheckPassphrase={props.onCheckPassphrase}
        onLogout={props.onLogout}
      />
    )}
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  checkbox: {marginBottom: Styles.globalMargins.medium},
  input: {
    marginBottom: Styles.globalMargins.small,
  },
  logoutbox: {paddingTop: Styles.globalMargins.medium},
})

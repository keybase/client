// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import NeedToSetPassphrase from '../../settings/passphrase'

export type Props = {|
  hasRandomPW: boolean,
  heading: string,
|}

type TestProps = {|
  heading: string,
  onTestPassphrase: () => void,
|}

type State = {|
  passphrase: string,
|}

class OfferToTestPassphrase extends React.Component<TestProps, State> {
  state: State
  state = {passphrase: ''}

  render() {
    const inputType = this.state.showTyping ? 'passwordVisible' : 'password'
    console.warn('in offer with', this.props)

    return (
      <Kb.Box2 direction="vertical">
        <Kb.Input
          hintText="Enter your passphrase"
          type={inputType}
          value={this.state.passphrase}
          onChangeText={passphrase => this.setState({passphrase})}
          uncontrolled={false}
        />
        <Kb.Checkbox
          label="Show typing"
          onCheck={showTyping => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
          checked={this.state.showTyping}
          style={{marginBottom: Styles.globalMargins.medium}}
        />
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
      <OfferToTestPassphrase heading={props.heading} onTestPassphrase={props.onTestPassphrase} />
    )}

    <Kb.Box2 direction="vertical">
      <Kb.Text type="Header">Foo</Kb.Text>
      <Kb.Button
        label="No thanks, just log me out now."
        onClick={() => props.onLogOut()}
        small={true}
        type="Danger"
      />
    </Kb.Box2>
  </Kb.ScrollView>
)

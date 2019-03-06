// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type InputProps = {||}

type InputState = {|
  username: string,
|}

class EnterUsernameInput extends React.Component<InputProps, InputState> {
  state = {username: ''}

  _onChangeUsername = username => this.setState({username})

  render() {
    return (
      <Kb.Box2 direction="horizontal" style={styles.inputBox} fullWidth={true}>
        <Kb.PlainInput
          flexable={true}
          textType="BodySemibold"
          value={this.state.username}
          onChangeText={this._onChangeUsername}
        />
      </Kb.Box2>
    )
  }
}

type Props = {||}

const _EnterUsername = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <Kb.Box2 direction="vertical">
      <Kb.Text type="BodySemibold">mastodon.mastodon</Kb.Text>
    </Kb.Box2>
    <Kb.Box2 fullWidth={true} direction="horizontal" alignItems="center" style={styles.inputContainer}>
      <EnterUsernameInput />
    </Kb.Box2>
  </Kb.Box2>
)
const EnterUsername = Kb.HeaderOrPopup(_EnterUsername)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({isElectron: {height: 485, width: 560}}),
  inputBox: {
    borderColor: Styles.globalColors.blue,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
  },
  inputContainer: {
    ...Styles.padding(0, Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.medium),
    flex: 1,
  },
})

export default EnterUsername

// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import {Box2, Avatar, Input, WaitingButton, HeaderHocHeader} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'

type Props = {
  error: string,
  onBack: () => void,
  onSubmit: (pass1: string, pass1: string) => void,
}
type State = {
  pass1: string,
  pass2: string,
}

class UsernameAndEmail extends React.Component<Props, State> {
  state = {pass1: '', pass2: ''}

  _onSubmit = () => {
    this.props.onSubmit(this.state.pass1, this.state.pass2)
  }
  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <HeaderHocHeader onBack={this.props.onBack} headerStyle={styles.header} />
        <Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true} gap="small">
          <Avatar username="" size={128} />
          <Input
            autoFocus={true}
            hintText="Create a passphrase"
            value={this.state.pass1}
            type="password"
            errorText={this.props.error}
            onChangeText={pass1 => this.setState({pass1})}
          />
          <Input
            hintText="Confirm passphrase"
            value={this.state.pass2}
            type="password"
            onEnterKeyDown={this._onSubmit}
            onChangeText={pass2 => this.setState({pass2})}
          />
          <WaitingButton
            waitingKey={Constants.waitingKey}
            type="Primary"
            label="Continue"
            disabled={!this.state.pass1 || !this.state.pass2}
            onClick={this._onSubmit}
          />
        </Box2>
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  header: {position: 'absolute'},
})

export default UsernameAndEmail

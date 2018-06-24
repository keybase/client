// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import {Box2, Avatar, Input, WaitingButton, HeaderHocHeader} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'

type Props = {
  emailError: string,
  onBack: () => void,
  onSubmit: (username: string, email: string) => void,
  usernameError: string,
}
type State = {
  username: string,
  email: string,
}

class UsernameAndEmail extends React.Component<Props, State> {
  state = {email: '', username: ''}

  _onSubmit = () => {
    this.props.onSubmit(this.state.username, this.state.email)
  }
  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <HeaderHocHeader onBack={this.props.onBack} headerStyle={styles.header} />
        <Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true} gap="small">
          <Avatar username="" size={128} />
          <Input
            autoFocus={true}
            hintText="Create a username"
            value={this.state.username}
            errorText={this.props.usernameError}
            onChangeText={username => this.setState({username})}
          />
          <Input
            hintText="Email address"
            value={this.state.email}
            errorText={this.props.emailError}
            onEnterKeyDown={this._onSubmit}
            onChangeText={email => this.setState({email})}
          />
          <WaitingButton
            waitingKey={Constants.waitingKey}
            type="Primary"
            label="Continue"
            disabled={!this.state.email || !this.state.username}
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

// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import {Text, Icon, Box2, Input, WaitingButton, HeaderHocHeader} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'

type Props = {
  emailErrorText: string,
  onBack: () => void,
  onSubmit: (name: string, email: string) => void,
  nameErrorText: string,
}
type State = {
  name: string,
  email: string,
}

class RequestInvite extends React.Component<Props, State> {
  state = {email: '', name: ''}

  _onSubmit = () => {
    this.props.onSubmit(this.state.email, this.state.name)
  }
  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <HeaderHocHeader onBack={this.props.onBack} headerStyle={styles.header} />
        <Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true} gap="small">
          <Text type="Header"> Request an invite code </Text>
          <Icon type="icon-invite-code-48" />
          <Input
            hintText="Your email address"
            value={this.state.email}
            errorText={this.props.emailErrorText}
            onEnterKeyDown={this._onSubmit}
            onChangeText={email => this.setState({email})}
            autoFocus={true}
          />
          <Input
            hintText="Your name"
            value={this.state.name}
            errorText={this.props.nameErrorText}
            onChangeText={name => this.setState({name})}
          />
          <WaitingButton
            waitingKey={Constants.waitingKey}
            type="Primary"
            label="Request"
            disabled={!this.state.email || !this.state.name}
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

export default RequestInvite

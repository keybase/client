// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import {Icon, Text, Input, WaitingButton} from '../../../common-adapters'
import Wrapper from '../wrapper'

type Props = {|
  onBack: () => void,
  onSubmit: (code: string) => void,
  onRequestInvite: () => void,
  error: string,
|}
type State = {|
  inviteCode: string,
|}

class InviteCode extends React.Component<Props, State> {
  state = {inviteCode: ''}

  _onSubmit = () => {
    this.props.onSubmit(this.state.inviteCode)
  }
  render() {
    return (
      <Wrapper onBack={this.props.onBack}>
        <Text type="Header">Type in your invite code:</Text>
        <Icon type="icon-invite-code-48" />
        <Input
          autoFocus={true}
          value={this.state.inviteCode}
          errorText={this.props.error}
          onEnterKeyDown={this._onSubmit}
          onChangeText={inviteCode => this.setState({inviteCode})}
        />
        <WaitingButton
          waitingKey={Constants.waitingKey}
          type="Primary"
          label="Continue"
          disabled={!this.state.inviteCode}
          onClick={this._onSubmit}
        />
        <Text type="BodySmall">Not invited?</Text>
        <Text type="BodySmallSecondaryLink" onClick={this.props.onRequestInvite}>
          Request an invite
        </Text>
      </Wrapper>
    )
  }
}

export default InviteCode

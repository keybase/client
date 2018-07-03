// @flow
import * as React from 'react'
import {Icon, Text} from '../../../common-adapters'
import {Wrapper, Input, ContinueButton} from '../common'

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
        <ContinueButton disabled={!this.state.inviteCode} onClick={this._onSubmit} />
        <Text type="BodySmall">Not invited?</Text>
        <Text type="BodySmallSecondaryLink" onClick={this.props.onRequestInvite}>
          Request an invite
        </Text>
      </Wrapper>
    )
  }
}

export default InviteCode

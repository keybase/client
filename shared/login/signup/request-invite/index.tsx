import * as React from 'react'
import {Text} from '../../../common-adapters'
import {Wrapper, Input, ContinueButton} from '../common'

type Props = {
  emailError: string
  onBack: () => void
  onSubmit: (name: string, email: string) => void
  nameError: string
}

type State = {
  name: string
  email: string
}

class RequestInvite extends React.Component<Props, State> {
  state = {email: '', name: ''}

  _onSubmit = () => {
    this.props.onSubmit(this.state.email, this.state.name)
  }
  render() {
    return (
      <Wrapper onBack={this.props.onBack}>
        <Text type="Header"> Request an invite code </Text>
        <Input
          hintText="Your email address"
          value={this.state.email}
          errorText={this.props.emailError}
          onEnterKeyDown={this._onSubmit}
          onChangeText={email => this.setState({email})}
          autoFocus={true}
        />
        <Input
          hintText="Your name"
          value={this.state.name}
          errorText={this.props.nameError}
          onChangeText={name => this.setState({name})}
        />
        <ContinueButton
          label="Request"
          disabled={!this.state.email || !this.state.name}
          onClick={this._onSubmit}
        />
      </Wrapper>
    )
  }
}

export default RequestInvite

// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import {Avatar, Input, WaitingButton} from '../../../common-adapters'
import {isMobile} from '../../../styles'
import Wrapper from '../wrapper'

type Props = {|
  email: string,
  emailError: string,
  onBack: () => void,
  onSubmit: (username: string, email: string) => void,
  username: string,
  usernameError: string,
|}
type State = {|
  username: string,
  email: string,
|}

class UsernameAndEmail extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {email: this.props.email, username: this.props.username}
  }

  _onSubmit = () => {
    this.props.onSubmit(this.state.username, this.state.email)
  }
  render() {
    return (
      <Wrapper onBack={this.props.onBack}>
        <Avatar username="" size={isMobile ? 96 : 128} />
        <Input
          autoFocus={true}
          hintText="Create a username"
          value={this.state.username}
          errorText={this.props.username === this.state.username ? this.props.usernameError : ''}
          onChangeText={username => this.setState({username})}
        />
        <Input
          hintText="Email address"
          value={this.state.email}
          errorText={this.props.email === this.state.email ? this.props.emailError : ''}
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
      </Wrapper>
    )
  }
}

export default UsernameAndEmail

// @flow
import * as React from 'react'
import {BlankAvatar, Wrapper, Input, ContinueButton} from '../common'

type Props = {|
  passphrase: string,
  error: string,
  onBack: () => void,
  onSubmit: (pass1: string, pass1: string) => void,
|}
type State = {|
  pass1: string,
  pass2: string,
|}

class Passphrase extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {pass1: this.props.passphrase, pass2: this.props.passphrase}
  }
  _onSubmit = () => {
    this.props.onSubmit(this.state.pass1, this.state.pass2)
  }
  render() {
    return (
      <Wrapper onBack={this.props.onBack}>
        <BlankAvatar />
        <Input
          autoFocus={true}
          hintText="Create a passphrase"
          value={this.state.pass1}
          type="password"
          errorText={this.props.passphrase === this.state.pass1 ? this.props.error : ''}
          onChangeText={pass1 => this.setState({pass1})}
          uncontrolled={true}
        />
        <Input
          hintText="Confirm passphrase"
          value={this.state.pass2}
          type="password"
          onEnterKeyDown={this._onSubmit}
          onChangeText={pass2 => this.setState({pass2})}
          uncontrolled={true}
        />
        <ContinueButton disabled={!this.state.pass1 || !this.state.pass2} onClick={this._onSubmit} />
      </Wrapper>
    )
  }
}

export default Passphrase

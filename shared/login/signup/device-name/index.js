// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import {Text, Icon, Input, WaitingButton} from '../../../common-adapters'
import Wrapper from '../wrapper'

type Props = {|
  error: string,
  onBack: () => void,
  onSubmit: (devicename: string) => void,
  devicename: string,
|}
type State = {|
  devicename: string,
|}

class Devicename extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {devicename: this.props.devicename}
  }
  _onSubmit = () => {
    this.props.onSubmit(this.state.devicename)
  }
  render() {
    const error = (this.props.devicename === this.state.devicename && this.props.error) || ''

    return (
      <Wrapper onBack={this.props.onBack}>
        <Text type="Header">A public name for this device:</Text>
        <Icon type="icon-computer-64" />
        <Input
          autoFocus={true}
          errorText={error}
          value={this.state.devicename}
          hintText="Device name"
          onEnterKeyDown={this._onSubmit}
          onChangeText={devicename => this.setState({devicename})}
        />
        <WaitingButton
          waitingKey={Constants.waitingKey}
          type="Primary"
          label="Continue"
          disabled={!this.state.devicename}
          onClick={this._onSubmit}
        />
      </Wrapper>
    )
  }
}

export default Devicename

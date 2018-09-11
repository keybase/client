// @flow
import * as React from 'react'
import {Text, Icon} from '../../../common-adapters'
import {Wrapper, Input, ContinueButton} from '../common'

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
  state = {devicename: this.props.devicename}

  _onSubmit = () => {
    this.props.onSubmit(this.state.devicename)
  }
  render() {
    const error = (this.props.devicename === this.state.devicename && this.props.error) || ''

    return (
      <Wrapper onBack={this.props.onBack}>
        <Text type="Header">Set a public name...</Text>
        <Icon type="icon-computer-64" />
        <Input
          autoFocus={true}
          errorText={error}
          value={this.state.devicename}
          hintText="Device name"
          onEnterKeyDown={this._onSubmit}
          onChangeText={devicename => this.setState({devicename})}
        />
        <ContinueButton disabled={!this.state.devicename} onClick={this._onSubmit} />
      </Wrapper>
    )
  }
}

export default Devicename

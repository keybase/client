// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import * as SignupGen from '../../../actions/signup-gen'
import * as Creators from '../../../actions/signup'
import Render from '../../register/set-public-name'
import {connect, type TypedState} from '../../../util/container'

class DeviceName extends React.Component<any, {deviceName: ?string}> {
  constructor(props) {
    super(props)
    this.state = {deviceName: props.deviceName}
  }

  _onChange = (deviceName: string) => {
    this.setState({deviceName})
    if (this.props.deviceNameError) {
      this.props.clearDeviceNameError()
    }
  }

  render() {
    return (
      <Render
        deviceName={this.state.deviceName}
        deviceNameError={this.props.deviceNameError}
        clearDeviceNameError={this.props.clearDeviceNameError}
        onChange={this._onChange}
        onSubmit={() => this.props.submitDeviceName(this.state.deviceName || '')}
        submitEnabled={!this.props.waiting}
        onBack={this.props.restartSignup}
        waiting={this.props.waiting}
      />
    )
  }
}

// TODO waitingbutton w/ key
const mapStateToProps = (state: TypedState) => ({
  deviceName: state.signup.deviceName,
  deviceNameError: state.signup.deviceNameError,
  waiting: !!state.waiting.get(Constants.waitingKey),
})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  clearDeviceNameError: () => dispatch(SignupGen.createClearDeviceNameError()),
  restartSignup: () => dispatch(SignupGen.createRestartSignup()),
  submitDeviceName: (name: string) => dispatch(Creators.submitDeviceName(name)),
})

export default connect(mapStateToProps, mapDispatchToProps)(DeviceName)

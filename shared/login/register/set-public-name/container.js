// @flow
import * as LoginGen from '../../../actions/login-gen'
import * as SignupGen from '../../../actions/signup-gen'
import React, {Component} from 'react'
import SetPublicName, {type State} from '.'
import {connect, type TypedState} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'

const trimDeviceName = (s: ?string): string => {
  if (!s) return ''
  return s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

const trimDeviceNames = (names: ?Array<string>): Array<string> => {
  if (!names) return []
  return names.map(n => {
    return trimDeviceName(n)
  })
}

type ContainerProps = {
  onSubmit: (deviceName: ?string) => void,
  onBack: () => void,
  clearDeviceNameError: () => void,
  waiting: boolean,
  deviceNameError: ?string,
  existingDevices: ?Array<string>,
  existingDevicesTrimmed: ?Array<string>,
}

// TODO remove this class
class _SetPublicName extends Component<ContainerProps, State> {
  state: State

  constructor(props: ContainerProps) {
    super(props)

    this.state = {
      deviceName: null,
    }
  }

  _onChange = (deviceName: string) => {
    this.setState({
      deviceName,
    })
    if (this.props.deviceNameError) {
      this.props.clearDeviceNameError()
    }
  }

  render() {
    const deviceName = this.state.deviceName || ''
    const deviceNameTrimmed: string = trimDeviceName(this.state.deviceName)
    const nameTaken = !!(
      this.props.existingDevicesTrimmed && this.props.existingDevicesTrimmed.indexOf(deviceNameTrimmed) !== -1
    )
    const submitEnabled = !!(deviceNameTrimmed.length >= 3 && deviceName.length <= 64 && !nameTaken)
    const nameTakenError = nameTaken
      ? `The device name: '${deviceName}' is already taken. You can't reuse device names, even revoked ones, for security reasons. Otherwise, someone who stole one of your devices could cause a lot of confusion.`
      : null

    return (
      <SetPublicName
        clearDeviceNameError={this.props.clearDeviceNameError}
        deviceName={this.state.deviceName}
        onChange={this._onChange}
        onSubmit={() => this.props.onSubmit(this.state.deviceName)}
        onBack={this.props.onBack}
        deviceNameError={nameTakenError || this.props.deviceNameError}
        existingDevices={this.props.existingDevices}
        submitEnabled={submitEnabled}
        waiting={this.props.waiting}
      />
    )
  }
}

type OwnProps = RouteProps<
  {
    existingDevices?: ?Array<string>,
  },
  {}
>

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => ({
  deviceNameError: state.signup.deviceNameError,
  existingDevices: routeProps.get('existingDevices'),
  existingDevicesTrimmed: trimDeviceNames(routeProps.get('existingDevices')),
  waiting: state.engine.get('rpcWaitingStates').get('loginRpc'),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  clearDeviceNameError: () => dispatch(SignupGen.createClearDeviceNameError()),
  onBack: () => dispatch(LoginGen.createOnBack()),
  onSubmit: (deviceName: string) => {
    // map 'smart apostrophes' to ASCII (typewriter apostrophe)
    dispatch(
      LoginGen.createSubmitDeviceName({deviceName: deviceName.replace(/[\u2018\u2019\u0060\u00B4]/g, "'")})
    )
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(_SetPublicName)

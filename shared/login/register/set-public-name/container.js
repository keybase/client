// @flow
import React, {Component} from 'react'
import SetPublicName from '.'
import {connect} from 'react-redux'
import * as Creators from '../../../actions/login/creators'

import type {TypedState} from '../../../constants/reducer'
import type {Props, State} from '.'

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

// TODO remove this class
class _SetPublicName extends Component<void, Props, State> {
  props: Props
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      deviceName: null,
    }
  }

  render() {
    const deviceName = this.state.deviceName || ''
    const deviceNameTrimmed: string = trimDeviceName(this.state.deviceName)
    const nameTaken = !!(this.props.existingDevicesTrimmed &&
      this.props.existingDevicesTrimmed.indexOf(deviceNameTrimmed) !== -1)
    const submitEnabled = !!(deviceNameTrimmed.length >= 3 && deviceName.length <= 64 && !nameTaken)
    const nameTakenError = nameTaken
      ? `The device name: '${deviceName}' is already taken. You can't reuse device names, even revoked ones, for security reasons. Otherwise, someone who stole one of your devices could cause a lot of confusion.`
      : null

    return (
      <SetPublicName
        deviceName={this.state.deviceName}
        onChange={deviceName => this.setState({deviceName})}
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

type OwnProps = {
  routeProps: {
    deviceNameError?: ?string,
    existingDevices?: ?Array<string>,
  },
}

const mapStateToProps = (state: TypedState, {routeProps: {existingDevices, deviceNameError}}: OwnProps) => ({
  deviceNameError,
  existingDevices,
  existingDevicesTrimmed: trimDeviceNames(existingDevices),
  waiting: state.engine.get('rpcWaitingStates').get('loginRpc'),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: deviceName => dispatch(Creators.submitDeviceName(deviceName)),
})
// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps)(_SetPublicName)

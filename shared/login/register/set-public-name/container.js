// @flow
import React, {Component} from 'react'
import SetPublicName from '.'
import {connect} from 'react-redux-profiled'
import * as Creators from '../../../actions/login/creators'
import {clearDeviceNameError} from '../../../actions/signup'

import type {Dispatch} from 'redux'
import type {TypedState} from '../../../constants/reducer'
import type {State} from '.'

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
class _SetPublicName extends Component<void, ContainerProps, State> {
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
    const nameTaken = !!(this.props.existingDevicesTrimmed &&
      this.props.existingDevicesTrimmed.indexOf(deviceNameTrimmed) !== -1)
    const submitEnabled = !!(deviceNameTrimmed.length >= 3 && deviceName.length <= 64 && !nameTaken)
    const nameTakenError = nameTaken
      ? `The device name: '${deviceName}' is already taken. You can't reuse device names, even revoked ones, for security reasons. Otherwise, someone who stole one of your devices could cause a lot of confusion.`
      : null

    return (
      <SetPublicName
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

type OwnProps = {
  routeProps: {
    existingDevices?: ?Array<string>,
  },
}

const mapStateToProps = (state: TypedState, {routeProps: {existingDevices}}: OwnProps) => ({
  deviceNameError: state.signup.deviceNameError,
  existingDevices,
  existingDevicesTrimmed: trimDeviceNames(existingDevices),
  waiting: state.engine.get('rpcWaitingStates').get('loginRpc'),
})

const mapDispatchToProps = (dispatch: Dispatch<*>) => ({
  clearDeviceNameError: () => dispatch(clearDeviceNameError()),
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: deviceName => dispatch(Creators.submitDeviceName(deviceName)),
})

export default connect(mapStateToProps, mapDispatchToProps)(_SetPublicName)

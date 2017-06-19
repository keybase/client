// @flow
import React, {Component} from 'react'
import SetPublicName from '.'
import {connect} from 'react-redux'
import * as Creators from '../../../actions/login/creators'

import type {TypedState} from '../../../constants/reducer'
import type {Props, State} from '.'

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
    const nameTaken = !!(this.props.existingDevices &&
      this.state.deviceName &&
      this.props.existingDevices.indexOf(this.state.deviceName) !== -1)
    const submitEnabled = !!(this.state.deviceName && this.state.deviceName.length && !nameTaken)
    const nameTakenError = nameTaken
      ? `The device name: '${this.state.deviceName || ''}' is already taken. You can't reuse device names, even revoked ones, for security reasons. Otherwise, someone who stole one of your devices could cause a lot of confusion.`
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
  existingDevices,
  deviceNameError,
  waiting: state.engine.get('rpcWaitingStates').get('loginRpc'),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: deviceName => dispatch(Creators.submitDeviceName(deviceName)),
})
// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps)(_SetPublicName)

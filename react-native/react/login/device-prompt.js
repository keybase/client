'use strict'
/* @flow */

import React, { Component } from '../base-react'
import { submitDeviceName } from '../actions/login'
import DevicePromptRender from './device-prompt-render'

export default class DevicePrompt extends Component {
  render () {
    return <DevicePromptRender deviceNameError={this.props.deviceNameError} onSubmit={(deviceName) => { this.props.onSubmit(deviceName) }} />
  }

  // TODO(mm): add types
  static parseRoute (store, currentPath, nextPath) {
    const {response, deviceName} = store.getState().login

    return {
      componentAtTop: {
        title: 'Device Name',
        leftButtonTitle: 'Cancel',
        mapStateToProps: state => state.login,
        props: {
          onSubmit: name => store.dispatch(submitDeviceName(name, response)),
          deviceName
        }
      }
    }
  }
}

DevicePrompt.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  deviceName: React.PropTypes.string,
  deviceNameError: React.PropTypes.string
}

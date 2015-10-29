'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { submitDeviceName } from '../actions/login'
import DevicePromptRender from './device-prompt-render'

export default class DevicePrompt extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return <DevicePromptRender onSubmit={(deviceName) => { this.props.onSubmit(deviceName) }} />
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

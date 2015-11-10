'use strict'
/* @flow */

import React, {Component} from '../../../base-react'
import {setDeviceName} from '../../../actions/login2'
import Render from './index.render'

export default class SetPublicName extends Component {
  nameTaken (deviceName) {
    return this.props.existingDevices && this.props.existingDevices.indexOf(deviceName) !== -1
  }

  submitEnabled (deviceName) {
    return deviceName && deviceName.length && !this.nameTaken(deviceName)
  }

  render () {
    return (
      <Render
        onSubmit={ deviceName => this.props.dispatch(setDeviceName(deviceName)) }
        nameTaken={ deviceName => this.nameTaken(deviceName) }
        submitEnabled={ deviceName => this.submitEnabled(deviceName) }
        {...this.props}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: '',
        component: SetPublicName,
        leftButtonTitle: '',
        mapStateToProps: state => {
          const { deviceName } = state.login2
          return {
            deviceName
          }
        }
      }
    }
  }
}

SetPublicName.propTypes = {
  deviceName: React.PropTypes.string,
  existingDevices: React.PropTypes.array,
  onSubmit: React.PropTypes.func.isRequired,
  dispatch: React.PropTypes.func.isRequired
 }

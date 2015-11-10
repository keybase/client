'use strict'

import React, {Component} from '../../../base-react'
import Render from './index.render'

import {removeDevice} from '../../../actions/devices'
import {navigateUp} from '../../../actions/router'

export default class RemoveDevice extends Component {
  render () {
    return (
      <Render
        deviceName={this.props.device.name}
        onCancel={() => this.props.dispatch(navigateUp())}
        onSubmit={() => this.props.dispatch(removeDevice(this.props.device.deviceID))}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => {
          const {dispatch} = state
          return {dispatch}
        },
        props: {
          device: currentPath.get('device')
        }
      }
    }
  }
}

RemoveDevice.propTypes = {
  device: React.PropTypes.object.isRequired,
  dispatch: React.PropTypes.func.isRequired
}

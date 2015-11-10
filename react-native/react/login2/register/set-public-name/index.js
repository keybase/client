'use strict'
/* @flow */

import React, {Component} from '../../../base-react'
import Render from './index.render'

export default class SetPublicName extends Component {
  constructor (props) {
    super(props)

    this.state = {
      deviceName: null
    }
  }

  render () {
    const nameTaken = !!(this.props.existingDevices && this.props.existingDevices.indexOf(this.state.deviceName) !== -1)
    const submitEnabled = !!(this.state.deviceName && this.state.deviceName.length && !nameTaken)

    return (
      <Render
        deviceName={this.state.deviceName}
        onChangeDeviceName={deviceName => this.setState({deviceName})}
        onSubmit={ () => this.props.onSubmit(this.state.deviceName) }
        nameTaken={nameTaken}
        submitEnabled={submitEnabled}
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

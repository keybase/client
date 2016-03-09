import React, {Component} from 'react'
import {connect} from 'react-redux'
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
    const nameTakenError = nameTaken ? `The device name: ${this.state.deviceName} is already taken` : null

    return (
      <Render
        deviceName={this.state.deviceName}
        onChangeDeviceName={deviceName => this.setState({deviceName})}
        onSubmit={() => this.props.onSubmit(this.state.deviceName)}
        deviceNameError={nameTakenError}
        submitEnabled={submitEnabled}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: '',
        component: SetPublicName,
        leftButtonTitle: ''
      }
    }
  }
}

SetPublicName.propTypes = {
  deviceName: React.PropTypes.string,
  existingDevices: React.PropTypes.array,
  onSubmit: React.PropTypes.func.isRequired
}

export default connect(
  (state, ownProps) => ownProps.mapStateToProps(state)
)(SetPublicName)


// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import {DeviceRole, codePageDeviceRoleExistingPhone,
  codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer,
  codePageDeviceRoleNewComputer} from '../../constants/login'

type Props = {
  myDeviceRole: DeviceRole,
  onSubmit: (type: DeviceRole) => void,
  onBack: () => void
}

class ExistingDevice extends Component<void, Props, void> {
  render () {
    let otherDeviceComputer = null
    let otherDevicePhone = null

    switch (this.props.myDeviceRole) {
      case codePageDeviceRoleExistingPhone: // fallthrough
      case codePageDeviceRoleExistingComputer:
        otherDeviceComputer = codePageDeviceRoleNewComputer
        otherDevicePhone = codePageDeviceRoleNewPhone
        break
      case codePageDeviceRoleNewPhone: // fallthrough
      case codePageDeviceRoleNewComputer:
      default:
        otherDeviceComputer = codePageDeviceRoleExistingComputer
        otherDevicePhone = codePageDeviceRoleExistingPhone
        break
    }

    return (
      <Render
        onSubmitComputer={() => this.props.onSubmit(otherDeviceComputer)}
        onSubmitPhone={() => this.props.onSubmit(otherDevicePhone)}
        onBack={this.props.onBack}
      />
    )
  }
}

export default connect(
  state => ({})
)(ExistingDevice)

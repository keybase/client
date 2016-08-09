// @flow
import React, {Component} from 'react'
import Render from './render'
import type {DeviceRole} from '../../constants/login'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
  codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../constants/login'
import {connect} from 'react-redux'

type Props = {
  myDeviceRole: DeviceRole,
  onSubmit: (type: DeviceRole) => void,
  onBack: () => void
}

class ExistingDevice extends Component<void, Props, void> {
  render () {
    const otherRoleIsNew = this.props.myDeviceRole === codePageDeviceRoleExistingPhone ||
      this.props.myDeviceRole === codePageDeviceRoleExistingComputer

    const otherDeviceComputer = otherRoleIsNew ? codePageDeviceRoleNewComputer : codePageDeviceRoleExistingComputer
    const otherDevicePhone = otherRoleIsNew ? codePageDeviceRoleNewPhone : codePageDeviceRoleExistingPhone

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

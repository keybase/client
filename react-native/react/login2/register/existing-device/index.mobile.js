'use strict'
/* @flow */

import React, {Component, StyleSheet, Text, TouchableHighlight, View} from '../../../base-react'
import {connect} from '../../../base-redux'

import commonStyles from '../../../styles/common'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login2'

class ExistingDevice extends Component {
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
        otherDeviceComputer = codePageDeviceRoleExistingComputer
        otherDevicePhone = codePageDeviceRoleExistingPhone
        break
    }

    return (
      <View style={[styles.container, {marginTop: 200, padding: 20, alignItems: 'stretch'}]}>
        <Text style={commonStyles.h1}>What type of device would you like to connect this device with?</Text>
        <View style={{flex: 1, flexDirection: 'row', marginTop: 40, justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 40, paddingRight: 40}}>
          <TouchableHighlight onPress={() => this.props.onSubmit(otherDeviceComputer)}>
            <View style={{flexDirection: 'column', alignItems: 'center'}}>
              <Text>[Desktop icon]</Text>
              <Text>Desktop Device &gt;</Text>
            </View>
          </TouchableHighlight>
          <TouchableHighlight onPress={() => this.props.onSubmit(otherDevicePhone)}>
            <View style={{flexDirection: 'column', alignItems: 'center'}}>
              <Text>[Mobile icon]</Text>
              <Text>Mobile Device &gt;</Text>
            </View>
          </TouchableHighlight>
        </View>
      </View>
    )
  }
}

ExistingDevice.propTypes = {
  myDeviceRole: React.PropTypes.oneOf([
    codePageDeviceRoleExistingPhone,
    codePageDeviceRoleNewPhone,
    codePageDeviceRoleExistingComputer,
    codePageDeviceRoleNewComputer
  ]),
  onSubmit: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start'
  }
})

export default connect(
  state => state,
  null,
  (stateProps, dispatchProps, ownProps) => {
    return {
      ...ownProps,
      ...ownProps.mapStateToProps(stateProps),
      ...dispatchProps
    }
  }
)(ExistingDevice)

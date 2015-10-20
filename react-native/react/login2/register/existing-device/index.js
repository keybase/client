'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TouchableHighlight, View } from 'react-native'

import commonStyles from '../../../styles/common'
import { navigateUp, routeAppend } from '../../../actions/router'
import { setCodePageOtherDeviceRole } from '../../../actions/login2'
import CodePage from '../code-page'
import { codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer } from '../../../constants/login2'

export default class ExistingDevice extends Component {
  showCodePage (otherDeviceRole) {
    this.props.dispatch(setCodePageOtherDeviceRole(otherDeviceRole))
    this.props.dispatch(routeAppend('codePage'))
  }

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
          <TouchableHighlight onPress={() => this.showCodePage(otherDeviceComputer)}>
            <View style={{flexDirection: 'column', alignItems: 'center'}}>
              <Text>[Desktop icon]</Text>
              <Text>Desktop Device &gt;</Text>
            </View>
          </TouchableHighlight>
          <TouchableHighlight onPress={() => this.showCodePage(otherDevicePhone)}>
            <View style={{flexDirection: 'column', alignItems: 'center'}}>
              <Text>[Mobile icon]</Text>
              <Text>Mobile Device &gt;</Text>
            </View>
          </TouchableHighlight>
        </View>
        <Text onPress={() => this.props.dispatch(navigateUp())} style={{alignSelf: 'flex-end'}}>Back</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => state.login2.codePage
      },
      subRoutes: {
        codePage: CodePage
      }
    }
  }
}

ExistingDevice.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  myDeviceRole: React.PropTypes.oneOf([
    codePageDeviceRoleExistingPhone,
    codePageDeviceRoleNewPhone,
    codePageDeviceRoleExistingComputer,
    codePageDeviceRoleNewComputer
  ])
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start'
  }
})

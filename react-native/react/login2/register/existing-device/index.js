'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TouchableHighlight, View } from 'react-native'

import commonStyles from '../../../styles/common'
// import { navigateUp, routeAppend } from '../../../actions/router'
// import { setCodePageOtherDeviceRole } from '../../../actions/login2'
import { codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer } from '../../../constants/login2'
// import CodePage from '../code-page'

export default class ExistingDevice extends Component {
  /*
  showCodePage (otherDeviceRole) {
    this.props.setCodePageOtherDeviceRole(otherDeviceRole)
    this.props.gotoCodePage()
  }
  */

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
        {{ /* <Text onPress={() => this.props.navigateUp()} style={{alignSelf: 'flex-end'}}>Back</Text> */ }}
      </View>
    )
  }

  /*
  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => {
          const { myDeviceRole } = state.login2.codePage
          return {
            myDeviceRole
          }
        },
        props: {
          navigateUp: () => store.dispatch(navigateUp()),
          gotoCodePage: () => store.dispatch(routeAppend('codePage')),
          setCodePageOtherDeviceRole: otherRole => store.dispatch(setCodePageOtherDeviceRole(otherRole))
        }
      },
      subRoutes: {
        codePage: CodePage
      }
    }
  }
  */
}

ExistingDevice.propTypes = {
  myDeviceRole: React.PropTypes.oneOf([
    codePageDeviceRoleExistingPhone,
    codePageDeviceRoleNewPhone,
    codePageDeviceRoleExistingComputer,
    codePageDeviceRoleNewComputer
  ]),
  // navigateUp: React.PropTypes.func.isRequired,
  // gotoCodePage: React.PropTypes.func.isRequired,
  onSubmit: React.PropTypes.func.isRequired
  // setCodePageOtherDeviceRole: React.PropTypes.func.isRequire
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start'
  }
})

'use strict'
/* @flow */

import React, { Component, Text, TouchableHighlight, View, ScrollView, StyleSheet, Platform } from 'react-native'
import Button from '../../common-adapters/button'
import { loadDevices } from '../../actions/devices'
import moment from 'moment'
import * as loginStates from '../../constants/login-states'
import CodePage from '../../login2/register/code-page'
import { routeAppend } from '../../actions/router'
import commonStyles from '../../styles/common'
import GenPaperKey from './gen-paper-key'
import ExistingDevice from '../../login2/register/existing-device'
import RemoveDevice from './remove-device'
import { setCodePageMyRole } from '../../actions/login2'
import { codePageDeviceRoleExistingPhone, codePageDeviceRoleExistingComputer } from '../../constants/login2'

// TODO
// [ ] - Add Icons

export default class Devices extends Component {
  constructor (props) {
    super(props)

    const myRole = (Platform.OS === 'ios' || Platform.OS === 'android') ? codePageDeviceRoleExistingPhone : codePageDeviceRoleExistingComputer
    this.props.dispatch(setCodePageMyRole(myRole))
  }

  loadDevices () {
    const {dispatch} = this.props
    if (!this.props.devices && !this.props.waitingForServer) {
      dispatch(loadDevices())
    }
  }

  renderDevice (device) {
    return (
      <View key={device.name} style={[styles.device]}>
        <Text style={commonStyles.greyText}>ICON {device.type}</Text>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={[styles.deviceLastUsed, commonStyles.greyText]}>Last Used: {moment(device.cTime).format('MM/DD/YY')}</Text>
        <Text style={[styles.deviceAddedInfo, commonStyles.greyText]}>TODO: Get Added info</Text>
        <Text style={styles.deviceRemove} onPress={() => this.props.dispatch(routeAppend({path: 'removeDevice', device}))}>Remove</Text>
      </View>
    )
  }

  renderAction (headerText, subText, onPress) {
    return (
      <TouchableHighlight onPress={onPress} style={{flex: 1}}>
        <View style={[styles.outlineBox, styles.innerAction, {marginRight: 10}]}>
          <View style={{flex: 1}}>
            <Text style={[commonStyles.greyText, commonStyles.centerText]}>ICON</Text>
            <Text style={[commonStyles.greyText, commonStyles.centerText]}>{headerText}</Text>
          </View>
          <Text style={[commonStyles.greyText, commonStyles.centerText]}>{subText}</Text>
        </View>
      </TouchableHighlight>
    )
  }

  render () {
    const { loginState, devices } = this.props

    if (loginState !== loginStates.LOGGED_IN) {
      return (
        <View style={{marginTop: 20}}>
          <Text style={[commonStyles.centerText]}> Login to see devices </Text>
        </View>
      )
    }

    if (!devices) {
      return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Button onPress={() => this.loadDevices()} buttonStyle={{fontSize: 32, marginTop: 20, marginBottom: 20}} title='Load Devices' />
        </View>
      )
    }

    return (
      <ScrollView>
        <View doc='Wrapper for new Actions (i.e. Connect a new device, Generate new paper key)'
          style={styles.newActionsWrapper}>
          {this.renderAction('Connect a new Device',
                             'On another device, download Keybase then click here to enter your unique passphrase',
                             () => this.props.dispatch(routeAppend('regExistingDevice')))}
          {this.renderAction('Generate a new paper key',
                             'A paper key is lorem ipsum dolor sit amet, consectetur adipiscing',
                             () => this.props.dispatch(routeAppend('genPaperKey')))}
        </View>

        <View doc='Wrapper for devices' style={styles.deviceWrapper}>
          {devices.map((d) => this.renderDevice(d))}
        </View>
      </ScrollView>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        hideNavBar: true,
        mapStateToProps: state => Object.assign({}, state.login, state.devices)
      },
      subRoutes: {
        codePage: CodePage,
        genPaperKey: GenPaperKey,
        regExistingDevice: ExistingDevice,
        removeDevice: RemoveDevice
      }
    }
  }
}

Devices.propTypes = {
  devices: React.PropTypes.array,
  loginState: React.PropTypes.string.isRequired,
  waitingForServer: React.PropTypes.bool.isRequired,
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  outlineBox: {
    backgroundColor: '#f4f4f4',
    borderWidth: 2,
    borderColor: '#999999',
    // TODO: this doesn't work
    borderStyle: 'dotted'
  },
  newActionsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    marginRight: 10,
    marginLeft: 10,
    marginTop: 20,
    flex: 1
  },
  innerAction: {
    flex: 1,
    padding: 10,
    alignItems: 'stretch'
  },

  // Device Styling
  deviceScrollView: {
  },
  deviceWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginRight: 10,
    marginLeft: 10,
    marginTop: 20
  },
  device: {
    width: 100,
    marginRight: 10,
    marginLeft: 10,
    marginBottom: 20
  },
  deviceName: {
  },
  deviceLastUsed: {
  },
  deviceAddedInfo: {
  },
  deviceRemove: {
    textDecorationLine: 'underline'
  }
})

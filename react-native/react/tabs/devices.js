'use strict'
/* @flow */

import React, { Component, Text, View, ScrollView, StyleSheet } from 'react-native'
import Button from '../common-adapters/button'
import { loadDevices } from '../actions/devices'
import moment from 'moment'
import * as loginStates from '../constants/login-states'

import commonStyles from '../styles/common'

// TODO
// [ ] - Add Icons

export default class Devices extends Component {
  loadDevices () {
    const {dispatch} = this.props
    if (!this.props.devices && !this.props.waitingForServer) {
      dispatch(loadDevices())
    }
  }

  renderDevice (device, onRemove) {
    return (
      <View key={device.name} style={[styles.device]}>
        <Text style={commonStyles.greyText}>ICON {device.type}</Text>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={[styles.deviceLastUsed, commonStyles.greyText]}>Last Used: {moment(device.cTime).format('MM/DD/YY')}</Text>
        <Text style={[styles.deviceAddedInfo, commonStyles.greyText]}>TODO: Get Added info</Text>
        <Text style={styles.deviceRemove} onPress={onRemove}>Remove</Text>
      </View>
    )
  }

  renderAction (headerText, subText) {
    return (
      <View style={[styles.outlineBox, styles.innerAction, {marginRight: 10}]}>
        <View style={{flex: 1}}>
          <Text style={[commonStyles.greyText, commonStyles.centerText]}>ICON</Text>
          <Text style={[commonStyles.greyText, commonStyles.centerText]}>{headerText}</Text>
        </View>
        <Text style={[commonStyles.greyText, commonStyles.centerText]}>{subText}</Text>
      </View>
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
          {this.renderAction("Connect a new Device", "On another device, download Keybase then click here to enter your unique passphrase")}
          {this.renderAction("Generate a new paper key", "A paper key is lorem ipsum dolor sit amet, consectetur adipiscing")}
        </View>

        <View doc='Wrapper for devices' style={styles.deviceWrapper}>
          {devices.map((d) => this.renderDevice(d, () => console.log('removed', d)))}
        </View>
      </ScrollView>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      parseNextRoute: null,
      componentAtTop: {
        hideNavBar: true,
        mapStateToProps: state => Object.assign({}, state.login, state.devices)
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

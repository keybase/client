'use strict'
/* @flow */

import React, { Component, Text, View, ScrollView, StyleSheet } from 'react-native'
import Button from '../common-adapters/button'
import { loadDevices } from '../actions/devices'
import moment from 'moment'

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
        <Text style={styles.greyText}>ICON {device.type}</Text>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={[styles.deviceLastUsed, styles.greyText]}>Last Used: {moment(device.cTime).format('MM/DD/YY')}</Text>
        <Text style={[styles.deviceAddedInfo, styles.greyText]}>TODO: Get Added info</Text>
        <Text style={styles.deviceRemove} onPress={onRemove}>Remove</Text>
      </View>
    )
  }

  render () {
    const { loggedIn } = this.props
    const devices = this.props.devices || []

    if (!loggedIn) {
      return (
        <View>
          <Text> Login to see devices </Text>
        </View>
      )
    }

    if (!devices) {
      return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Button onPress={this.loadDevices.bind(this)} buttonStyle={{fontSize: 32, marginTop: 20, marginBottom: 20}} title='Load Devices' />
        </View>
      )
    }

    return (
      <ScrollView>
        <View doc='Wrapper for new Actions (i.e. Connect a new device, Generate new paper key)'
          style={styles.newActionsWrapper}>
          <View doc='Wrapper for connect a new Device' style={[styles.outlineBox, styles.innerAction, {marginRight: 10}]}>
            <View style={{flex: 1}}>
              <Text style={[styles.greyText, styles.centerText]}>ICON</Text>
              <Text style={[styles.greyText, styles.centerText]}>Connect a new Device</Text>
            </View>
            <Text style={[styles.greyText, styles.centerText]}>On another device, download Keybase then click here to enter your unique passphrase</Text>
          </View>
          <View doc='Wrapper for generate a new paper key' style={[styles.outlineBox, styles.innerAction]}>
            <View style={{flex: 1}}>
              <Text style={[styles.greyText, styles.centerText]}>ICON</Text>
              <Text style={[styles.greyText, styles.centerText]}>Generate a new paper key</Text>
            </View>
            <Text style={[styles.greyText, styles.centerText, {flex: 2}]}>A paper key is lorem ipsum dolor sit amet, consectetur adipiscing</Text>
          </View>
        </View>

        <View doc='Wrapper for devices' style={styles.deviceWrapper}>
          {devices.map((d) => this.renderDevice(d, () => console.log('removed', d)))}
        </View>
      </ScrollView>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const componentAtTop = {
      component: Devices,
      hideNavBar: true,
      mapStateToProps: state => Object.assign({}, state.login, state.devices)
    }

    return {
      componentAtTop,
      parseNextRoute: null
    }
  }
}

Devices.propTypes = {
  devices: React.PropTypes.object.isRequired,
  loggedIn: React.PropTypes.bool.isRequired,
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
  greyText: {
    color: '#a6a6a6'
  },
  centerText: {
    textAlign: 'center'
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

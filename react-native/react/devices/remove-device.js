'use strict'
/* @flow */

import React, { Component, Text, View } from 'react-native'
import commonStyles from '../styles/common'
import { removeDevice } from '../actions/devices'
import { navigateUp } from '../actions/router'
import Button from '../common-adapters/button'

export default class RemoveDevice extends Component {
  constructor (props) {
    super(props)

    this.state = {
      passphrase: ''
    }
  }

  onSubmit () {
    this.props.removeDevice(this.props.device.deviceID)
  }

  render () {
    return (
      <View style={{flex: 1, padding: 20}}>
        <Text style={commonStyles.h1}>Remove "{this.props.device.name}"?</Text>
        <Text style={[commonStyles.h2, {marginTop: 20}]}>Removing this account will, lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum lorem ipsum lorem ipsum </Text>
        <View style={{flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginTop: 20}}>
          <Button style={{marginRight: 20}} title='Cancel' onPress={() => this.props.navigateUp()}/>
          <Button style={{}} title='Delete' onPress={() => this.onSubmit()} />
        </View>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: (state) => {
          const { dispatch } = state
          return {
            dispatch
          }
        },
        props: {
          device: currentPath.get('device'),
          navigateUp: () => store.dispatch(navigateUp()),
          removeDevice: deviceID => store.dispatch(removeDevice(deviceID))
        }
      }
    }
  }
}

RemoveDevice.propTypes = {
  device: React.PropTypes.object.isRequired,
  navigateUp: React.PropTypes.func.isRequired,
  removeDevice: React.PropTypes.func.isRequired
}

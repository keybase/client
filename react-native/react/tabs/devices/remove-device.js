'use strict'
/* @flow */

import React, { Component, Text, TextInput, View, StyleSheet } from 'react-native'
import commonStyles from '../../styles/common'
import { removeDevice } from '../../actions/devices'
import { navigateUp } from '../../actions/router'
import Button from '../../common-adapters/button'

export default class RemoveDevice extends Component {
  constructor (props) {
    super(props)

    this.state = {
      passphrase: ''
    }
  }

  onSubmit () {
    this.props.dispatch(removeDevice(this.props.device.deviceID))
  }

  render () {
    return (
      <View style={{flex: 1, padding: 20}}>
        <Text style={commonStyles.h1}>Remove "{this.props.device.name}"?</Text>
        <Text style={[commonStyles.h2, {marginTop: 20}]}>Removing this account will, lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum lorem ipsum lorem ipsum </Text>
        <TextInput style={[commonStyles.textInput]}
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={(passphrase) => this.setState({passphrase})}
          onSubmitEditing={() => this.onSubmit() }
          returnKeyType='next'
          secureTextEntry
          value={this.state.passphrase}
          placeholder='Enter your passphrase'
        />
        <View style={{flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginTop: 20}}>
          <Button style={{marginRight: 20}} title='Cancel' onPress={() => this.props.dispatch(navigateUp())}/>
          <Button style={{}} title='Delete' onPress={() => this.onSubmit()} enabled={this.state.passphrase.length} />
        </View>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => { return {dispatch: state.dispatch, device: currentPath.get('device')} }
      }
    }
  }
}

RemoveDevice.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  device: React.PropTypes.object.isRequired
}

const styles = StyleSheet.create({
})


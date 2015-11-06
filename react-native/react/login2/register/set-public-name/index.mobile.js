'use strict'
/* @flow */

import React, { Component, Text, TextInput, View } from 'react-native'
import commonStyles from '../../../styles/common'
import Button from '../../../common-adapters/button'
import { setDeviceName } from '../../../actions/login2'

export default class SetPublicName extends Component {
  constructor (props) {
    super(props)

    this.state = {
      deviceName: props.deviceName || ''
    }
  }

  onSubmit () {
    this.props.onSubmit(this.state.deviceName)
  }

  render () {
    const dupeName = this.props.existingDevices && this.props.existingDevices.indexOf(this.state.deviceName) !== -1
    const enabled = this.state.deviceName.length && !dupeName

    return (
      <View style={{flex: 1, padding: 20}}>
        <Text style={commonStyles.h1}>Set a public name for this device</Text>
        <Text style={[commonStyles.h2, {marginTop: 10}]}>We need this because lorem iplorem iplorem iplorem iplorem ipssssslorem ips</Text>
        <TextInput
          style={[commonStyles.textInput, {marginTop: 10}]}
          placeholder='Device nickname'
          value={this.state.deviceName}
          enablesReturnKeyAutomatically
          returnKeyType='next'
          autoCorrect={false}
          onChangeText={(deviceName) => this.setState({deviceName})}
          onSubmitEditing={() => { this.onSubmit() }}
          />
        <Button style={{alignSelf: 'flex-end'}} isAction title='Submit' onPress={() => this.onSubmit()} enabled={enabled}/>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: '',
        component: SetPublicName,
        leftButtonTitle: '',
        mapStateToProps: state => {
          const { deviceName } = state.login2
          return {
            deviceName
          }
        },
        props: {
          onSubmit: deviceName => store.dispatch(setDeviceName(deviceName))
        }
      }
    }
  }
}

SetPublicName.propTypes = {
  deviceName: React.PropTypes.string,
  existingDevices: React.PropTypes.array,
  onSubmit: React.PropTypes.func.isRequired
}

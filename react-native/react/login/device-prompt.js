'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableHighlight
} from 'react-native'

import commonStyles from '../styles/common'
import { submitDeviceName } from '../actions/login'

const submitButtonStyle = [commonStyles.actionButton, {width: 200}]

class DevicePrompt extends Component {
  constructor (props) {
    super(props)

    this.state = {
      deviceName: props.deviceName || ''
    }
  }

  submit () {
    this.props.onSubmit(this.state.deviceName)
  }

  render () {
    const error = this.props.deviceNameError ? <Text>{this.props.deviceNameError}</Text> : null

    return (
        <View style={styles.container}>
          <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Set a device name</Text>
          <Text style={[{margin: 20, marginBottom: 20}, commonStyles.h2]}>This is the first time you've logged into this device. You need to register this device by choosing a name. For example, Macbook or Desktop.</Text>
          <TextInput
            style={styles.input}
            placeholder='Device name'
            value={this.state.deviceName}
            enablesReturnKeyAutomatically
            returnKeyType='next'
            autoCorrect={false}
            onChangeText={(deviceName) => this.setState({deviceName})}
            onSubmitEditing={(event) => { this.submit() }}
            />

          {error}

          <View style={styles.submitWrapper}>
            <TouchableHighlight
              underlayColor={commonStyles.buttonHighlight}
              onPress={() => { this.submit() }}>
              <Text style={submitButtonStyle} >Next</Text>
            </TouchableHighlight>
          </View>
        </View>
    )
  }

  // TODO(mm): add types
  static parseRoute (store, currentPath, nextPath) {
    const {response, deviceName} = store.getState().login
    const componentAtTop = {
      title: 'Device Name',
      component: DevicePrompt,
      leftButtonTitle: 'Cancel',
      mapStateToProps: state => state.login,
      props: {
        onSubmit: (name) => store.dispatch(submitDeviceName(name, response)),
        deviceName
      }
    }

    return {
      componentAtTop,
      parseNextRoute: null // terminal node, so no next route
    }
  }
}

DevicePrompt.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  deviceName: React.PropTypes.string,
  deviceNameError: React.PropTypes.string
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  },
  input: {
    height: 40,
    marginBottom: 5,
    marginLeft: 10,
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: '#0f0f0f',
    fontSize: 13,
    padding: 4
  },
  submitWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  }
})

export default DevicePrompt

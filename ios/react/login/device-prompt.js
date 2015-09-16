'use strict'
/* @flow */

var React = require('react-native')
var {
  Component,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableHighlight
} = React

var commonStyles = require('../styles/common')
var submitButtonStyle = [commonStyles.actionButton, {width: 200}]

class DevicePrompt extends Component {
  constructor () {
    super()

    this.state = {
      deviceName: 'dev1'
    }
  }

  submit () {
    this.props.response.result(this.state.deviceName)
  }

  render () {
    return (
        <View style={styles.container}>
          <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Set a device name</Text>
          <Text style={[{margin: 20, marginBottom: 20}, commonStyles.h2]}>This is the first time you've logged into this device. You need to register this device by choosing a name. For example, Macbook or Desktop.</Text>
          <TextInput
            style={styles.input}
            placeholder='Device name'
            value={this.state.deviceName}
            enablesReturnKeyAutomatically={true}
            returnKeyType='next'
            autoCorrect={false}
            onChangeText={(deviceName) => this.setState({deviceName})}
            onSubmitEditing={(event) => {
              this.submit()
            }}
            />

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
}

DevicePrompt.propTypes = {
  navigator: React.PropTypes.object,
  response: React.PropTypes.object
}

var styles = StyleSheet.create({
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

module.exports = DevicePrompt

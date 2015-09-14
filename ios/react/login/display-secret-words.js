'use strict'
/* @flow */

var React = require('react-native')
var {
  Component,
  StyleSheet,
  View,
  Text,
  TouchableHighlight
} = React

var commonStyles = require('../styles/common')

class DisplaySecretWords extends Component {
  constructor () {
    super()
  }

  submit () {
    // TODO
    // this.props.response.result(this.state.deviceName)
  }

  render () {
    return (
        <View style={styles.container}>
          <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Register Device</Text>
          <Text style={[{margin: 20, marginBottom: 20}, commonStyles.h2]}>In order to register this device you need to enter in the secret phrase generated on an existing device</Text>
          <Text style={[styles.secret, commonStyles.h1]}>{this.props.secret}</Text>
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

DisplaySecretWords.propTypes = {
  navigator: React.PropTypes.object,
  response: React.PropTypes.object,
  secret: React.PropTypes.string
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
  },
  secret: {
    textAlign: 'center',
    marginBottom: 75,
    backgroundColor: 'grey',
    borderColor: 'black',
    padding: 10
  }
})

var submitButtonStyle = [commonStyles.actionButton, {width: 200}]

module.exports = DisplaySecretWords

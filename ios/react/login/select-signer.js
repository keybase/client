'use strict'

var React = require('react-native')
var {
  Component,
  StyleSheet,
  View,
  SwitchIOS,
  Text,
  TextInput,
  TouchableHighlight
} = React

var engine = require('../engine')
var DevicePrompt = require('./device-prompt')
var EventEmitter = require('EventEmitter');

var commonStyles = require('../styles/common')

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
  switchText: {
    fontSize: 14,
    textAlign: 'center',
    margin: 10
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rightSide: {
    justifyContent: 'flex-end',
    marginRight: 10
  },
  loginWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  }
})

var loginButtonStyle = [commonStyles.actionButton, {width: 200}]

class SelectSigner extends Component {
  constructor () {
    super()

    this.state = { }
  }

  /*
  componentWillUnmount () {
    this.subscriptions.forEach(function (s) {
      s.remove()
    })
  }
 */

  submit () {
  }

  render () {
    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder='TEMP'
          value={this.state.username}
          enablesReturnKeyAutomatically={true}
          returnKeyType='next'
          autoCorrect={false}
          onChangeText={(username) => this.setState({username})}
          onSubmitEditing={(event) => {
            this.refs['passphrase'].focus()
          }}
          />
      </View>
    )
  }
}

SelectSigner.propTypes = {
  navigator: React.PropTypes.object
}

module.exports = SelectSigner

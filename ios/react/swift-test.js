'use strict'

var React = require('react-native')
var {
  Component,
  StyleSheet,
  Text,
  View,
  NativeModules
} = React

var swiftNative = NativeModules.SwiftTest

var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF'
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10
  }
})

class SwiftTest extends Component {
  constructor () {
    super()

    this.state = {
      result: ''
    }

    swiftNative.example('This is', (fromSwift) => {
      this.setState({result: fromSwift})
    })
  }

  render () {
    return (
      <View style={styles.container}>
      <Text style={styles.welcome}>{this.state.result}</Text>
      </View>
    )
  }
}

module.exports = SwiftTest


'use strict'

var React = require('react-native')
var {
  StyleSheet,
  Text,
  View,
  Component,
  NativeModules,
  NativeAppEventEmitter
} = React

var objcNative = NativeModules.ObjcTest

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

class ObjcTest extends Component {
  constructor () {
    super()

    this.subscription = NativeAppEventEmitter.addListener(
      'EventName',
      (body) => this.setState({count: body.payload})
    )

    this.state = {
      result: '',
      count: ''
    }

    objcNative.exampleWith('This is', (fromObjc) => {
      this.setState({result: fromObjc})
    })
  }

  componentWillUnmount () {
    this.subscription.remove()
  }

  render () {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>{this.state.result}</Text>
        <Text style={styles.welcome}>Constants from Objc: language = {objcNative.language}</Text>
        <Text style={styles.welcome}>This is objc counting with events {this.state.count}</Text>
      </View>
    )
  }
}

module.exports = ObjcTest

'use strict'

var React = require('react-native')
var {
  StyleSheet,
  Text,
  View,
  Component
} = React

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

class ReactTest extends Component {
  constructor () {
    super()

    this.state = {
      count: 0
    }

    setInterval(() => {
      this.setState({count: this.state.count + 1})
    }, 1000)
  }

  render () {
    return (
      <View style={styles.container}>
      <Text style={styles.welcome}>This is react counting: {this.state.count}</Text>
      </View>
    )
  }
}

module.exports = ReactTest

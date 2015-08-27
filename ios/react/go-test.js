'use strict'

var React = require('react-native')
var {
  StyleSheet,
  Text,
  View,
  Component
} = React

var engine = require('./engine')

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

class GoTest extends Component {
  constructor () {
    super()

    this.state = {data: '123'}

    setInterval(() => {
      this.sendToGo()
    }, 1000)

    this.sendToGo()
  }

  sendToGo () {
    var toSend = this.state.data

    engine.rpc('test.testCallback', [{sessionID: 1, name: toSend}],
               (err, data) => {
                 if (!err) {
                   this.setState({data: data})
                 }
               })
  }

  render () {
    return (
      <View style={styles.container}>
      <Text style={styles.welcome}>From Go: {this.state.data}</Text>
      </View>
    )
  }
}

module.exports = GoTest

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
    }, 400)

    this.TEMP = 1

    this.sendToGo()
  }

  sendToGo () {
    var toSend = this.state.data

    if (this.TEMP % 2) {
      console.log("regular call")
      engine.rpc('debugging.debugtestCallback', {name: toSend},
                 (err, data) => {
                   if (!err && data) {
                     this.setState({data: data})
                   }
                 })
    } else {
      console.log("collated call")
      engine.collatedRpc('debugging.debugtest', {name: toSend},
                         (err, method, data) => {
                           console.log("COLLATED METHOD", method)
                           if (!err && data) {
                             this.setState({data: data.name})
                           }
                         })
    }

    this.TEMP++
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

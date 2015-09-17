'use strict'

var React = require('react-native')
var {
  StyleSheet,
  Text,
  View,
  Component
} = React

var engine = require('../engine')

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

    this.state = {data: 123}
    this.TEMP = 1
    this.sendToGo()
  }

  handleIncrement (err, data) {
    if (!err && data) {
      this.setState({data: data})
    }

    setTimeout(() => {
      this.sendToGo()
    }, 100)
  }

  clearTimer () {
    clearInterval(this.timer)
    this.timer = null
  }

  componentWillUnmount () {
    this.clearTimer()
  }

  handleSecondStep (param, response) {
    this.clearTimer()
    this.timer = setTimeout(() => {
      response.result(param.val + 1)
    }, 1000)
  }

  handleValPlus2 (err, data) {
    if (!err) {
      this.setState({data: data.valPlusTwo})
    }

    this.clearTimer()
    this.timer = setTimeout(() => {
      this.sendToGo()
    }, 1000)
  }

  sendToGo () {
    var toSend = this.state.data

    if ((this.TEMP % 10) < 8) {
      engine.rpc('debugging.increment', {val: toSend}, null, (err, data) => { this.handleIncrement(err, data) })
    } else {
      const incoming = { 'keybase.1.debugging.secondStep': (param, response) => { this.handleSecondStep(param, response) } }
      engine.rpc('debugging.firstStep', {val: toSend}, incoming, (err, data) => { this.handleValPlus2(err, data) })
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

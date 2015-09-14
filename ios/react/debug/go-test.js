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

    this.sendToGo()
  }

  clearTimer () {
    clearInterval(this.timer)
    this.timer = null
  }

  componentWillUnmount () {
    this.clearTimer()
  }

  handleMultiStep (err, method, param, response) {
    switch (method) {
      case 'keybase.1.debugging.secondStep':
        this.clearTimer()
        this.timer = setTimeout(() => {
          response.result(param.val + 1)
        }, 3000)
        break
      default:
        if (!err && param) {
          this.setState({data: param.valPlusTwo})
        }

        this.clearTimer()
        this.timer = setTimeout(() => {
          this.sendToGo()
        }, 1000)
    }
  }

  sendToGo () {
    var toSend = this.state.data

    if ((this.TEMP % 10) < 8) {
      engine.rpc('debugging.increment', {val: toSend}, (err, data) => { this.handleIncrement(err, data) })
    } else {
      engine.collatedRpc('debugging.firstStep', {val: toSend},
        (err, method, param, response) => { this.handleMultiStep(err, method, param, response) })
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

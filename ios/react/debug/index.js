'use strict'

/*
 * A debug tab. Use this to jump directly to a part of the app outside of the flow for quick debugging
 */

var React = require('react-native')
var {
  Component
} = React

var Temp = require('../login/device-prompt')

class Debug extends Component {
  constructor () {
    super()
  }

  render () {
    return (
      <Temp navigator={this.props.navigator}/>
    )
    // return React.createElement(require('./briding-tabs'))
  }
}

module.exports = Debug

'use strict'

/*
 * A debug tab. Use this to jump directly to a part of the app outside of the flow for quick debugging
 */

var React = require('react-native')
var {
  Component
} = React

class Debug extends Component {
  constructor () {
    super()
  }

  render () {
    // return React.createElement(require('../login'))
    return React.createElement(require('./briding-tabs'))
  }
}

module.exports = Debug

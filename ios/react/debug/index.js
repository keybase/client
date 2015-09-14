'use strict'

/*
 * A debug tab. Use this to jump directly to a part of the app outside of the flow for quick debugging
 */

var React = require('react-native')
var {
  Component
} = React

var Temp = require('./briding-tabs')

class Debug extends Component {
  constructor () {
    super()

    this.state = {
      mock: {
        sessionID: 124,
        devices: [
          {
            type: 'desktop',
            name: 'b',
            deviceID: 'e0ce327507bf30e8f7a2512a72bdd318',
            cTime: 0,
            mTime: 0
          }
        ],
        hasPGP: false,
        hasPaperBackupKey: false
      }
    }
  }

  render () {
    return (
      <Temp navigator={this.props.navigator} {...this.state.mock} />
    )
    // return React.createElement(require('./briding-tabs'))
  }
}

Debug.propTypes = {
  navigator: React.PropTypes.object
}

module.exports = Debug

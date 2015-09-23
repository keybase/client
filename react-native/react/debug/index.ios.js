'use strict'

/*
 * A debug tab. Use this to jump directly to a part of the app outside of the flow for quick debugging
 */

import React from 'react-native'
const { Component } = React
import { connect } from 'react-redux/native'

import Temp from '../more'

class Debug extends Component {
  constructor (props) {
    super(props)

    console.log(props)

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
      <Temp dispatch={this.props.dispatch} navigator={this.props.navigator} {...this.state.mock} />
    )
    // return React.createElement(require('./briding-tabs'))
  }
}

Debug.propTypes = {
  navigator: React.PropTypes.object,
  dispatch: React.PropTypes.func.isRequired
}

export default connect(state => state)(Debug)

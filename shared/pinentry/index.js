// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import PinentryRender from './index.render'

class Pinentry extends Component {
  render () {
    return <PinentryRender {...this.props} />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'pinentry'}}
  }
}

export default connect(
  (state, ownProps) => state.pinentry.pinentryStates[ownProps.sessionID]
)(Pinentry)

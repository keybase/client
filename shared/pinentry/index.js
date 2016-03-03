import React, {Component} from 'react'
import {connect} from 'react-redux'
import PinentryRender from './index.render'
import {onCancel} from '../actions/pinentry'

class Pinentry extends Component {
  render () {
    return <PinentryRender {...this.props} />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'pinentry'}}
  }
}

Pinentry.propTypes = PinentryRender.propTypes

export default connect(
  (state, ownProps) => {
    const {sessionID} = ownProps
    return state.pinentry.pinentryStates[sessionID]
  },
  (dispatch, ownProps) => {
    const {sessionID} = ownProps
    return {
      onCancel: () => dispatch(onCancel(sessionID))
    }
  }
)(Pinentry)

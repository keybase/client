import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import PinentryRender from './index.render'

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
    const sessionID = ownProps.sessionID
    return state.pinentry.pinentryStates[sessionID]
  }
)(Pinentry)

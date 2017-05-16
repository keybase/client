// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import PinentryRender from './index.render'

class Pinentry extends Component {
  render() {
    if (!this.props.features) {
      return null
    }
    return <PinentryRender {...this.props} />
  }
}

export default connect((state, ownProps) => state.pinentry.pinentryStates[ownProps.sessionID] || {})(Pinentry)

export function selector(): (store: Object) => ?Object {
  return store => ({
    pinentry: {
      pinentryStates: store.pinentry.pinentryStates || {},
    },
  })
}

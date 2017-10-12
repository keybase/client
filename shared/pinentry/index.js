// @flow
import React, {Component} from 'react'
import {connect, type MapStateToProps} from 'react-redux'
import PinentryRender from './index.render'

class Pinentry extends Component<any> {
  render() {
    if (!this.props.features) {
      return null
    }
    return <PinentryRender {...this.props} />
  }
}

const mapStateToProps: MapStateToProps<*, *, *> = (state, ownProps) =>
  state.pinentry.pinentryStates[ownProps.sessionID] || {}

export default connect(mapStateToProps)(Pinentry)

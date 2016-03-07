import React, {Component} from 'react'
import {connect} from 'react-redux'
import PinentryRender from './index.render'
import flags from '../util/feature-flags'

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

export function remoteComponentProps (pSessionID: string, managerProps: Object): Object {
  const sid = parseInt(pSessionID, 10)
  return {
    component: 'pinentry',
    key: 'pinentry:' + pSessionID,
    onCancel: () => managerProps.pinentryOnCancel(sid),
    onRemoteClose: () => managerProps.pinentryOnCancel(sid),
    onSubmit: managerProps.pinentryOnSubmit.bind(null, sid),
    sessionID: sid,
    title: 'Pinentry',
    waitForState: true,
    windowsOpts: flags.dz2 ? {width: 500, height: 260} : {width: 513, height: 260}
  }
}

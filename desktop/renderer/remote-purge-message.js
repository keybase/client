// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import RemoteComponent from './remote-component'
import * as Constants from '../../shared/constants/pgp'

type Props = {
  close: () => void,
  open: boolean,
}

class RemotePurgeMessage extends Component<void, Props, void> {
  shouldComponentUpdate (nextProps, nextState) {
    return nextProps !== this.props
  }

  render () {
    const {open} = this.props
    if (!open) {
      return null
    }

    const windowsOpts = {width: 600, height: 450}
    return (
      <div>
        <RemoteComponent
          title='PgpPurgeMessage'
          windowsOpts={windowsOpts}
          waitForState={false}
          onRemoteClose={() => this.props.close()}
          component='purgeMessage'
          onSubmit={() => {}}
          onCancel={() => this.props.close()}
          sessionID={0} />
      </div>
    )
  }
}

export default connect(
  state => ({
    open: state.pgp.open,
  }),
  dispatch => ({
    onClose: () => { dispatch({type: Constants.pgpAckedMessage, payload: {hitOk: false}}) },
  })
)(RemotePurgeMessage)

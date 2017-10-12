// @flow
import * as Constants from '../../constants/pgp'
import React, {Component} from 'react'
import RemoteComponent from './remote-component'
import {connect, type TypedState} from '../../util/container'

type Props = {
  onClose: () => void,
  open: boolean,
}

class RemotePurgeMessage extends Component<Props> {
  shouldComponentUpdate(nextProps, nextState) {
    return nextProps !== this.props
  }

  render() {
    const {open} = this.props
    if (!open) {
      return null
    }

    const windowsOpts = {width: 600, height: 450}
    return (
      <div>
        <RemoteComponent
          title="PgpPurgeMessage"
          windowsOpts={windowsOpts}
          waitForState={false}
          onRemoteClose={() => this.props.onClose()}
          component="purgeMessage"
          onSubmit={() => {}}
          onCancel={() => this.props.onClose()}
          sessionID={0}
        />
      </div>
    )
  }
}

export default connect(
  (state: TypedState) => ({
    open: state.pgp.open,
  }),
  (dispatch: any) => ({
    onClose: () => {
      dispatch({type: Constants.pgpAckedMessage, payload: {hitOk: false}})
    },
  })
)(RemotePurgeMessage)

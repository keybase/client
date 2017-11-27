// @flow
import * as PgpGen from '../../actions/pgp-gen'
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

const mapStateToProps = (state: TypedState) => ({
  open: state.pgp.open,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClose: () => {
    dispatch(PgpGen.createPgpAckedMessage({hitOk: false}))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(RemotePurgeMessage)

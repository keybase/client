// @flow
import React, {Component} from 'react'
import RemoteComponent from './remote-component'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {registerRekeyListener, close} from '../../actions/unlock-folders'

type Props = {
  close: () => void,
  closed: boolean,
  registerRekeyListener: () => void,
}

class RemoteUnlockFolders extends Component<void, Props, void> {
  componentWillMount() {
    this.props.registerRekeyListener()
  }

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps !== this.props
  }

  render() {
    const {closed} = this.props
    if (closed) {
      return null
    }

    const windowsOpts = {width: 500, height: 300}
    return (
      <div>
        <RemoteComponent
          title="UnlockFolders"
          windowsOpts={windowsOpts}
          waitForState={true}
          onRemoteClose={() => this.props.close()}
          component="unlockFolders"
          onSubmit={() => {}}
          onCancel={() => this.props.close()}
          sessionID={0}
        />
      </div>
    )
  }
}

export default connect(
  (state: any) => state.unlockFolders,
  (dispatch: any) =>
    bindActionCreators(
      {
        registerRekeyListener,
        close,
      },
      dispatch
    )
)(RemoteUnlockFolders)

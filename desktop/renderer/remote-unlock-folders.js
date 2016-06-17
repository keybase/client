// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {registerRekeyListener, close} from '../shared/actions/unlock-folders'
import RemoteComponent from './remote-component'

type Props = {
  close: () => void,
  closed: boolean,
  registerRekeyListener: () => void
}

class RemoteUnlockFolders extends Component<void, Props, void> {
  componentWillMount () {
    this.props.registerRekeyListener()
  }

  shouldComponentUpdate (nextProps, nextState) {
    return nextProps !== this.props
  }

  render () {
    const {closed} = this.props
    if (closed) {
      return null
    }

    const windowsOpts = {width: 500, height: 300}
    return (
      <div>
        <RemoteComponent
          title='UnlockFolders'
          windowsOpts={windowsOpts}
          waitForState
          onRemoteClose={() => this.props.close()}
          component='unlockFolders'
          onSubmit={() => {}}
          onCancel={() => this.props.close()}
          sessionID={0} />
      </div>
    )
  }
}

export default connect(
  state => state.unlockFolders,
  dispatch => bindActionCreators({
    registerRekeyListener,
    close,
  }, dispatch)
)(RemoteUnlockFolders)

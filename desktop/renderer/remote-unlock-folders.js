// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {registerRekeyListener} from '../shared/actions/unlock-folders'
import RemoteComponent from './remote-component'

type Props = {
  closed: boolean,
  registerRekeyListener: () => void
}

class RemoteUnlockFolders extends Component<void, Props, void> {
  componentWillMount () {
    this.props.registerRekeyListener()
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (nextProps !== this.props) {
      return true
    }
    return false
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
          onRemoteClose={() => {}}
          component='unlockFolders'
          onSubmit={() => {}}
          onCancel={() => {}}
          sessionID={0} />
      </div>
    )
  }
}

export default connect(
  state => state.unlockFolders,
  dispatch => bindActionCreators({registerRekeyListener}, dispatch)
)(RemoteUnlockFolders)

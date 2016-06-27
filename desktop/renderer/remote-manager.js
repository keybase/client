/* @flow */

import React, {Component} from 'react'
import RemoteTracker from './remote-tracker'
import RemotePinentry from './remote-pinentry'
import RemoteUnlockFolders from './remote-unlock-folders'

class RemoteManager extends Component<void, {}, void> {
  render () {
    return (
      <div style={{display: 'none'}}>
        <RemoteTracker />
        <RemotePinentry />
        <RemoteUnlockFolders />
      </div>
    )
  }
}

export default RemoteManager

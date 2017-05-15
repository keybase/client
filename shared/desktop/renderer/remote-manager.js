// @flow
import React, {Component} from 'react'
import RemoteTracker from './remote-tracker'
import RemotePinentry from './remote-pinentry'
import RemoteUnlockFolders from './remote-unlock-folders'
import RemotePurgeMessage from './remote-purge-message'

class RemoteManager extends Component<void, {}, void> {
  render() {
    return (
      <div style={{display: 'none'}}>
        <RemoteTracker />
        <RemotePinentry />
        <RemoteUnlockFolders />
        <RemotePurgeMessage />
      </div>
    )
  }
}

export default RemoteManager

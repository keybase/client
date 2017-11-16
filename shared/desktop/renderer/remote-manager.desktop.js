// @flow
import React, {Component} from 'react'
import RemoteTracker from './remote-tracker.desktop'
import RemotePinentry from './remote-pinentry.desktop'
import RemoteUnlockFolders from './remote-unlock-folders.desktop'
import RemotePurgeMessage from './remote-purge-message.desktop'

class RemoteManager extends Component<{}, void> {
  render() {
    return (
      <div style={{display: 'block', width: 200, height: 300}}>
        <RemoteTracker />
        <RemotePinentry />
        <RemoteUnlockFolders />
        <RemotePurgeMessage />
      </div>
    )
  }
}

export default RemoteManager

// @flow
import React, {Component} from 'react'
import RemoteMenubar from './remote-menubar.desktop'
import RemoteTracker from './remote-tracker.desktop'
import RemotePinentry from './remote-pinentry.desktop'
import RemoteUnlockFolders from './remote-unlock-folders.desktop'
import RemotePurgeMessage from './remote-purge-message.desktop'

class RemoteManager extends Component<{}, void> {
  render() {
    return (
      <div style={{display: 'block', width: 200, height: '100%', backgroundColor: 'pink'}}>
        <RemoteMenubar />
        <RemoteTracker />
        <RemotePinentry />
        <RemoteUnlockFolders />
        <RemotePurgeMessage />
      </div>
    )
  }
}

export default RemoteManager

// @flow
import React from 'react'
import RemoteMenubar from '../../menubar/remote-proxy.desktop'
import RemoteTracker from '../../tracker/remote-proxy.desktop'
import RemotePinentry from '../../pinentry/remote-proxy.desktop'
import RemoteUnlockFolders from '../../unlock-folders/remote-proxy.desktop'
import RemotePurgeMessage from '../../pgp/remote-proxy.desktop'

const RemoteProxies = () => (
  <div style={{display: 'block', width: 200, height: '100%', backgroundColor: 'pink'}}>
    <RemoteMenubar />
    <RemoteTracker />
    <RemotePinentry />
    <RemoteUnlockFolders />
    <RemotePurgeMessage />
  </div>
)

export default RemoteProxies

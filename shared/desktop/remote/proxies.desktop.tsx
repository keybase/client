import React from 'react'
import RemoteMenubar from '../../menubar/remote-proxy.desktop'
import RemoteProfile from '../../tracker2/remote-proxy.desktop'
import RemotePinentry from '../../pinentry/remote-proxy.desktop'
import RemoteUnlockFolders from '../../unlock-folders/remote-proxy.desktop'

const RemoteProxies = () => (
  <div style={style}>
    <RemoteMenubar />
    <RemoteProfile />
    <RemotePinentry />
    <RemoteUnlockFolders />
  </div>
)

const style = {display: 'none'}
export default RemoteProxies

// @flow
import React from 'react'
import RemoteMenubar from '../../menubar/remote-proxy.desktop'
import RemoteProfile from '../../tracker2/remote-proxy.desktop'
import RemoteTracker from '../../tracker/remote-proxy.desktop'
import RemotePinentry from '../../pinentry/remote-proxy.desktop'
import RemoteUnlockFolders from '../../unlock-folders/remote-proxy.desktop'
import flags from '../../util/feature-flags'

const RemoteProxies = () => (
  <div style={style}>
    <RemoteMenubar />
    {!!flags.identify3 && <RemoteProfile />}
    {!flags.identify3 && <RemoteTracker />}
    <RemotePinentry />
    <RemoteUnlockFolders />
  </div>
)

const style = {display: 'none'}
export default RemoteProxies

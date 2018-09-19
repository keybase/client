// @flow
import React from 'react'
import RemoteMenubar from '../../menubar/remote-proxy.desktop'
import RemoteTracker from '../../tracker/remote-proxy.desktop'
import RemotePinentry from '../../pinentry/remote-proxy.desktop'
import RemoteUnlockFolders from '../../unlock-folders/remote-proxy.desktop'

const RemoteProxies = () => (
  <div style={style}>
    <RemoteMenubar />
    <RemoteTracker />
    {/*
    <RemotePinentry />
    <RemoteUnlockFolders /> */}
  </div>
)

const style = {display: 'none'}
export default RemoteProxies

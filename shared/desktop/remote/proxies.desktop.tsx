import RemoteMenubar from '@/menubar/remote-proxy.desktop'
import RemoteProfile from '@/tracker/remote-proxy.desktop'
import RemotePinentry from '@/pinentry/remote-proxy.desktop'
import RemoteUnlockFolders from '@/unlock-folders/remote-proxy.desktop'

const RemoteProxies = () => (
  <>
    <RemoteMenubar />
    <RemoteProfile />
    <RemotePinentry />
    <RemoteUnlockFolders />
  </>
)

export default RemoteProxies

import * as Kb from '@/common-adapters'
import RemoteMenubar from '@/menubar/remote-proxy.desktop'
import RemoteProfile from '@/tracker/remote-proxy.desktop'
import RemotePinentry from '@/pinentry/remote-proxy.desktop'
import RemoteUnlockFolders from '@/unlock-folders/remote-proxy.desktop'

const RemoteProxies = () => (
  <Kb.Box2 direction="vertical" style={style}>
    <RemoteMenubar />
    <RemoteProfile />
    <RemotePinentry />
    <RemoteUnlockFolders />
  </Kb.Box2>
)

const style = {display: 'none' as const}
export default RemoteProxies

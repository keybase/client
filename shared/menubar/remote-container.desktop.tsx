import * as Container from '../util/container'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'
import * as ConfigConstants from '../constants/config'

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {avatarRefreshCounter, daemonHandshakeState, config, ...rest} = state
  const {windowShownCount} = config
  const replace = useAvatarState(s => s.replace)
  replace(avatarRefreshCounter)
  const setState = ConfigConstants.useDaemonState(s => s.dispatch.setState)
  setState(daemonHandshakeState)
  return (
    <Menubar
      {...rest}
      {...config}
      daemonHandshakeState={daemonHandshakeState}
      windowShownCount={windowShownCount.get('menu') ?? 0}
    />
  )
}
export default RemoteContainer

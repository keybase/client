import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'
import * as Followers from '../constants/followers'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {avatarRefreshCounter, daemonHandshakeState, config, followers, following, username, ...rest} = state
  const {windowShownCount} = config
  useAvatarState(s => s.replace)(avatarRefreshCounter)
  ConfigConstants.useDaemonState(s => s.dispatch.setState)(daemonHandshakeState)
  Followers.useFollowerState(s => s.dispatch.replace)(followers, following)
  ConfigConstants.useConfigState(s => s.dispatch.replaceUsername)(username)
  return (
    <Menubar
      {...rest}
      {...config}
      username={username}
      daemonHandshakeState={daemonHandshakeState}
      windowShownCount={windowShownCount.get('menu') ?? 0}
    />
  )
}
export default RemoteContainer

import * as ConfigConstants from '../constants/config'
import * as UsersConstants from '../constants/users'
import * as Container from '../util/container'
import * as Followers from '../constants/followers'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'

const RemoteContainer = () => {
  const {
    avatarRefreshCounter,
    daemonHandshakeState,
    followers,
    following,
    loggedIn,
    outOfDate,
    username,
    httpSrvAddress,
    httpSrvToken,
    windowShownCountNum,
    infoMap,
    ...rest
  } = Container.useRemoteStore<DeserializeProps>()
  useAvatarState(s => s.dispatch.replace)(avatarRefreshCounter)
  ConfigConstants.useDaemonState(s => s.dispatch.setState)(daemonHandshakeState)
  Followers.useFollowerState(s => s.dispatch.replace)(followers, following)
  UsersConstants.useState(s => s.dispatch.replace)(infoMap)
  ConfigConstants.useCurrentUserState(s => s.dispatch.replaceUsername)(username)
  ConfigConstants.useConfigState(s => s.dispatch.setHTTPSrvInfo)(httpSrvAddress, httpSrvToken)
  ConfigConstants.useConfigState(s => s.dispatch.setOutOfDate)(outOfDate)
  ConfigConstants.useConfigState(s => s.dispatch.setLoggedIn)(loggedIn, undefined, true)
  return (
    <Menubar
      {...rest}
      loggedIn={loggedIn}
      username={username}
      daemonHandshakeState={daemonHandshakeState}
      windowShownCount={windowShownCountNum}
      outOfDate={outOfDate}
    />
  )
}
export default RemoteContainer

import * as Container from '../util/container'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {avatarRefreshCounter, config, ...rest} = state
  const {windowShownCount} = config
  const replace = useAvatarState(s => s.replace)
  replace(avatarRefreshCounter)
  return <Menubar {...rest} {...config} windowShownCount={windowShownCount.get('menu') ?? 0} />
}
export default RemoteContainer

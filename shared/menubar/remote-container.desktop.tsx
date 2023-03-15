import * as Container from '../util/container'
import Menubar from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {config, ...rest} = state
  const {windowShownCount} = config
  return <Menubar {...rest} {...config} windowShownCount={windowShownCount.get('menu') ?? 0} />
}
export default RemoteContainer

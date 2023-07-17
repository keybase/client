import * as Container from '../util/container'
import * as RemoteGen from '../actions/remote-gen'
import Pinentry from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const dispatch = Container.useDispatch()
  return (
    <Pinentry
      {...state}
      onCancel={() => dispatch(RemoteGen.createPinentryOnCancel())}
      onSubmit={(password: string) => dispatch(RemoteGen.createPinentryOnSubmit({password}))}
    />
  )
}
export default RemoteContainer

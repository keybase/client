import * as Container from '../util/container'
import * as PinentryGen from '../actions/pinentry-gen'
import Pinentry from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const dispatch = Container.useDispatch()
  return (
    <Pinentry
      {...state}
      onCancel={() => dispatch(PinentryGen.createOnCancel())}
      onSubmit={(password: string) => dispatch(PinentryGen.createOnSubmit({password}))}
    />
  )
}
export default RemoteContainer

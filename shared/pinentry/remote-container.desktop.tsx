import * as RemoteGen from '../actions/remote-gen'
import * as R from '../constants/remote'
import * as C from '../constants'
import Pinentry from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'

const RemoteContainer = () => {
  const state = C.useRemoteStore<DeserializeProps>()
  return (
    <Pinentry
      {...state}
      onCancel={() => R.remoteDispatch(RemoteGen.createPinentryOnCancel())}
      onSubmit={(password: string) => R.remoteDispatch(RemoteGen.createPinentryOnSubmit({password}))}
    />
  )
}
export default RemoteContainer

import * as RemoteGen from '../actions/remote-gen'
import * as R from '@/constants/remote'
import Pinentry from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'

const RemoteContainer = (d: DeserializeProps) => {
  return (
    <Pinentry
      {...d}
      onCancel={() => R.remoteDispatch(RemoteGen.createPinentryOnCancel())}
      onSubmit={(password: string) => R.remoteDispatch(RemoteGen.createPinentryOnSubmit({password}))}
    />
  )
}
export default RemoteContainer

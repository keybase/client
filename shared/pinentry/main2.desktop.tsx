import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import type * as T from '@/constants/types'
import Pinentry from './index.desktop'
import loadRemoteComponent from '../desktop/remote/component-loader.desktop'

export type ProxyProps = {
  cancelLabel?: string
  prompt: string
  retryLabel?: string
  showTyping?: T.RPCGen.Feature
  submitLabel?: string
  type: T.RPCGen.PassphraseType
  windowTitle: string
}

const RemotePinentry = (p: ProxyProps) => (
  <Pinentry
    {...p}
    onCancel={() => R.remoteDispatch(RemoteGen.createPinentryOnCancel())}
    onSubmit={(password: string) => R.remoteDispatch(RemoteGen.createPinentryOnSubmit({password}))}
  />
)

loadRemoteComponent<ProxyProps>({
  Component: RemotePinentry,
  component: 'pinentry',
})

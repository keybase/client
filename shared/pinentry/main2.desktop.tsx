import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import type * as T from '@/constants/types'
import Pinentry from './index.desktop'
import loadRemoteComponent from '../desktop/remote/component-loader.desktop'
import {getRemoteComponentParam, RemoteDarkModeSync} from '../desktop/remote/remote-component.desktop'

export type ProxyProps = {
  cancelLabel?: string
  darkMode: boolean
  prompt: string
  retryLabel?: string
  showTyping?: T.RPCGen.Feature
  submitLabel?: string
  type: T.RPCGen.PassphraseType
  windowTitle: string
}

const RemotePinentry = (p: ProxyProps) => {
  const {darkMode, ...rest} = p
  return (
    <RemoteDarkModeSync darkMode={darkMode}>
      <Pinentry
        {...rest}
        onCancel={() => R.remoteDispatch(RemoteGen.createPinentryOnCancel())}
        onSubmit={(password: string) => R.remoteDispatch(RemoteGen.createPinentryOnSubmit({password}))}
      />
    </RemoteDarkModeSync>
  )
}

loadRemoteComponent<ProxyProps>({
  Component: RemotePinentry,
  component: 'pinentry',
  param: getRemoteComponentParam(),
})

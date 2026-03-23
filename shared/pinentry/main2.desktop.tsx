import * as React from 'react'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import type * as T from '@/constants/types'
import Pinentry from './index.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {useDarkModeState} from '@/stores/darkmode'

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

const DarkModeSync = ({darkMode, children}: {darkMode: boolean; children: React.ReactNode}) => {
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)
  React.useEffect(() => {
    const id = setTimeout(() => setSystemDarkMode(darkMode), 1)
    return () => clearTimeout(id)
  }, [setSystemDarkMode, darkMode])
  return <>{children}</>
}

const sessionID = /\?param=(\w+)/.exec(window.location.search)

load<ProxyProps>({
  child: (p: ProxyProps) => {
    const {darkMode, ...rest} = p
    return (
      <DarkModeSync darkMode={darkMode}>
        <Pinentry
          {...rest}
          onCancel={() => R.remoteDispatch(RemoteGen.createPinentryOnCancel())}
          onSubmit={(password: string) => R.remoteDispatch(RemoteGen.createPinentryOnSubmit({password}))}
        />
      </DarkModeSync>
    )
  },
  name: 'pinentry',
  params: sessionID?.[1] ?? '',
})

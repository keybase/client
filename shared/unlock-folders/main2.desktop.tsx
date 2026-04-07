import * as React from 'react'
import * as R from '@/constants/remote'
import * as RemoteGen from '../constants/remote-actions'
import UnlockFolders from './index.desktop'
import loadRemoteComponent from '../desktop/remote/component-loader.desktop'
import {RemoteDarkModeSync} from '../desktop/remote/remote-component.desktop'
import type {State as ConfigStore} from '@/stores/config'

export type ProxyProps = {
  darkMode: boolean
  devices: ConfigStore['unlockFoldersDevices']
  paperKeyError: string
  waiting: boolean
}

type Phase = 'promptOtherDevice' | 'paperKeyInput' | 'success'

const UnlockFoldersWrapper = (p: ProxyProps) => {
  const {darkMode, devices, waiting, paperKeyError: _error} = p
  const [phase, setPhase] = React.useState<Phase>('promptOtherDevice')
  const [paperKeyError, setPaperKeyError] = React.useState(_error)

  const lastError = React.useRef(_error)
  React.useEffect(() => {
    if (_error !== lastError.current) {
      lastError.current = _error
      setPaperKeyError(_error)
    }
  }, [_error])

  const lastPhase = React.useRef(phase)
  React.useEffect(() => {
    if (phase !== lastPhase.current) {
      lastPhase.current = phase
      setPaperKeyError('')
    }
  }, [phase])

  return (
    <RemoteDarkModeSync darkMode={darkMode}>
      <UnlockFolders
        devices={devices}
        waiting={waiting}
        phase={phase}
        paperkeyError={paperKeyError}
        onBackFromPaperKey={() => setPhase('promptOtherDevice')}
        onClose={() => R.remoteDispatch(RemoteGen.createCloseUnlockFolders())}
        onContinueFromPaperKey={(paperKey: string) =>
          R.remoteDispatch(RemoteGen.createUnlockFoldersSubmitPaperKey({paperKey}))
        }
        onFinish={() => R.remoteDispatch(RemoteGen.createCloseUnlockFolders())}
        toPaperKeyInput={() => setPhase('paperKeyInput')}
      />
    </RemoteDarkModeSync>
  )
}

loadRemoteComponent<ProxyProps>({
  Component: UnlockFoldersWrapper,
  component: 'unlock-folders',
})

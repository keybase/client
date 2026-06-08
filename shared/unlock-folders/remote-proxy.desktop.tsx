import * as C from '@/constants'
import {useEngineActionListener} from '@/engine/action-listener'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {useColorScheme} from 'react-native'
import {handleUnlockFoldersEngineAction} from './engine-actions.desktop'
import type {ProxyProps} from './main2.desktop'
import {useUnlockFoldersState} from './store'

const windowOpts = {height: 300, width: 500}

function UnlockFolders(p: ProxyProps) {
  const windowComponent = 'unlock-folders'
  const windowParam = windowComponent

  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowParam,
    windowTitle: 'UnlockFolders',
  })

  useSerializeProps(p, windowComponent, windowParam)
  return null
}

const UnlockRemoteProxy = () => {
  const {devices, open, paperKeyError} = useUnlockFoldersState(
    C.useShallow(s => ({
      devices: s.devices,
      open: s.dispatch.open,
      paperKeyError: s.paperKeyError,
    }))
  )
  const waiting = C.Waiting.useAnyWaiting('unlock-folders:waiting')
  const isDarkMode = useColorScheme() === 'dark'

  useEngineActionListener('keybase.1.rekeyUI.refresh', action => {
    handleUnlockFoldersEngineAction(action, open)
  })

  useEngineActionListener('keybase.1.rekeyUI.delegateRekeyUI', action => {
    handleUnlockFoldersEngineAction(action, open)
  })

  if (devices.length) {
    return (
      <UnlockFolders
        darkMode={isDarkMode}
        devices={devices}
        paperKeyError={paperKeyError}
        waiting={waiting}
      />
    )
  }
  return null
}
export default UnlockRemoteProxy

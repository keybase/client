import * as C from '@/constants'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {useColorScheme} from 'react-native'
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
  const devices = useUnlockFoldersState(s => s.devices)
  const paperKeyError = useUnlockFoldersState(s => s.paperKeyError)
  const waiting = C.Waiting.useAnyWaiting('unlock-folders:waiting')
  const isDarkMode = useColorScheme() === 'dark'
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

import * as C from '@/constants'
import * as React from 'react'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize, type ProxyProps} from './remote-serializer.desktop'
import {useColorScheme} from 'react-native'
import {useConfigState} from '@/stores/config'

const windowOpts = {height: 300, width: 500}

const UnlockFolders = React.memo(function UnlockFolders(p: ProxyProps) {
  const windowComponent = 'unlock-folders'
  const windowParam = windowComponent

  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowParam,
    windowTitle: 'UnlockFolders',
  })

  useSerializeProps(p, serialize, windowComponent, windowParam)
  return null
})

const UnlockRemoteProxy = () => {
  const devices = useConfigState(s => s.unlockFoldersDevices)
  const paperKeyError = useConfigState(s => s.unlockFoldersError)
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

import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize, type ProxyProps} from './remote-serializer.desktop'

const windowOpts = {height: 300, width: 500}

const UnlockFolders = React.memo(function (p: ProxyProps) {
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
  const devices = C.useConfigState(s => s.unlockFoldersDevices)
  const paperKeyError = C.useConfigState(s => s.unlockFoldersError)
  const waiting = C.Waiting.useAnyWaiting('unlock-folders:waiting')
  if (devices.length) {
    return (
      <UnlockFolders
        darkMode={Kb.Styles.isDarkMode()}
        devices={devices}
        paperKeyError={paperKeyError}
        waiting={waiting}
      />
    )
  }
  return null
}
export default UnlockRemoteProxy

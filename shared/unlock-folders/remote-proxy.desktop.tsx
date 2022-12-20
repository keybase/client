import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize, type ProxyProps} from './remote-serializer.desktop'

const windowOpts = {height: 300, width: 500}

const UnlockFolders = (p: ProxyProps) => {
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
}

const UnlockFoldersMemo = React.memo(UnlockFolders)

const UnlockRemoteProxy = () => {
  const unlockFolders = Container.useSelector(s => s.unlockFolders)
  const {popupOpen} = unlockFolders
  if (popupOpen) {
    const {devices, phase, paperkeyError, waiting} = unlockFolders
    return (
      <UnlockFoldersMemo
        darkMode={Styles.isDarkMode()}
        devices={devices}
        paperkeyError={paperkeyError}
        phase={phase}
        waiting={waiting}
      />
    )
  }
  return null
}
export default UnlockRemoteProxy

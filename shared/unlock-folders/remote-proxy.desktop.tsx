import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize} from './remote-serializer.desktop'

export type Props = {
  darkMode: boolean
} & Pick<Container.TypedState['unlockFolders'], 'devices' | 'paperkeyError' | 'phase' | 'waiting'>

const windowOpts = {height: 300, width: 500}

const UnlockFolders = (p: Props) => {
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

export default () => {
  const state = Container.useSelector(s => s)
  const {popupOpen} = state.unlockFolders
  if (popupOpen) {
    const {devices, phase, paperkeyError, waiting} = state.unlockFolders
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

import * as React from 'react'
import * as Styles from '../styles'
import {StatusBar} from 'react-native'

export const getBarStyle = () =>
  Styles.isAndroid ? 'default' : Styles.isDarkMode() ? 'light-content' : 'dark-content'

/** status bar can get messed up when showing full screen things. call this to unhide it on unmount */
const useFixStatusbar = () => {
  React.useEffect(
    () => () => {
      StatusBar.setBarStyle(getBarStyle(), true)
      StatusBar.setHidden(false)
    },
    []
  )
}

export default useFixStatusbar

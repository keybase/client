import * as ConfigConstants from '../constants/config'
import * as Constants from '../constants/router2'
import * as Container from '../util/container'
import * as DarkMode from '../constants/darkmode'
import * as FsConstants from '../constants/fs'
import * as Kb from '../common-adapters'
import * as Kbfs from '../fs/common'
import * as React from 'react'
import * as Styles from '../styles'
import Loading from '../login/loading'
import type {Theme} from '@react-navigation/native'
import {colors, darkColors, themed} from '../styles/colors'

export enum AppState {
  UNINIT, // haven't rendered the nav yet
  NEEDS_INIT, // rendered but need to bootstrap
  INITED, // regular app now
}

const useConnectNavToRedux = () => {
  const setNavOnce = React.useRef(false)
  const setNavigatorExists = ConfigConstants.useConfigState(s => s.dispatch.setNavigatorExists)
  React.useEffect(() => {
    if (!setNavOnce.current) {
      if (Constants.navigationRef_.isReady()) {
        setNavOnce.current = true
        setNavigatorExists()

        if (__DEV__) {
          // @ts-ignore
          window.DEBUGNavigator = Constants.navigationRef_.current
          // @ts-ignore
          window.DEBUGRouter2 = Constants
        }
      }
    }
  }, [setNavigatorExists, setNavOnce])
}

// if dark mode changes we should redraw
// on ios if dark mode changes and we're on system, ignore as it will thrash and we don't want that
const useDarkNeedsRedraw = () => {
  const isDarkMode = DarkMode.useDarkModeState(s => s.isDarkMode())
  const darkChanged = Container.usePrevious(isDarkMode) !== isDarkMode
  const darkModePreference = DarkMode.useDarkModeState(s => s.darkModePreference)
  const darkModePreferenceChanged = Container.usePrevious(darkModePreference) !== darkModePreference

  if (Styles.isIOS) {
    if (darkModePreferenceChanged) {
      return true
    }
    if (darkModePreference === 'system') {
      return false
    }
  }
  return darkChanged
}

const useNavKey = (appState: AppState, key: React.MutableRefObject<number>) => {
  const needsRedraw = useDarkNeedsRedraw()
  if (needsRedraw) {
    key.current++
  }
  return appState === AppState.NEEDS_INIT ? -1 : key.current
}

const useIsDarkChanged = () => {
  const isDarkMode = DarkMode.useDarkModeState(s => s.isDarkMode())
  const darkChanged = Container.usePrevious(isDarkMode) !== isDarkMode
  return darkChanged
}

const useInitialState = () => {
  const darkChanged = useIsDarkChanged()
  return darkChanged
    ? Constants.navigationRef_?.isReady()
      ? Constants.navigationRef_.getRootState()
      : undefined
    : undefined
}

export const useShared = () => {
  useConnectNavToRedux()
  // We use useRef and usePrevious so we can understand how our state has changed and do the right thing
  // if we use useEffect and useState we'll have to deal with extra renders which look really bad
  const loggedInLoaded = ConfigConstants.useDaemonState(s => s.handshakeState === 'done')
  const loggedIn = ConfigConstants.useConfigState(s => s.loggedIn)
  const navContainerKey = React.useRef(1)
  // keep track if we went to an init route yet or not
  const appState = React.useRef(loggedInLoaded ? AppState.NEEDS_INIT : AppState.UNINIT)

  if (appState.current === AppState.UNINIT && loggedInLoaded) {
    appState.current = AppState.NEEDS_INIT
  }

  const setNavState = Constants.useState(s => s.dispatch.setNavState)
  const onStateChange = React.useCallback(() => {
    const ns = Constants.getRootState()
    setNavState(ns)
  }, [setNavState])

  const navKey = useNavKey(appState.current, navContainerKey)
  const initialState = useInitialState()
  return {
    appState,
    initialState,
    loggedIn,
    loggedInLoaded,
    navKey,
    onStateChange,
  }
}

export const useSharedAfter = (appState: React.MutableRefObject<AppState>) => {
  // stuff that happens after the first hook is done
  // if we handled NEEDS_INIT we're done
  if (appState.current === AppState.NEEDS_INIT) {
    appState.current = AppState.INITED
  }
}

export const SimpleLoading = React.memo(function SimpleLoading() {
  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={{
        backgroundColor: Styles.globalColors.white,
        // backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
      }}
    >
      <Loading allowFeedback={false} failed="" status="" />
    </Kb.Box2>
  )
})

export const FilesTabBadge = () => {
  const uploadIcon = FsConstants.useState(s => s.getUploadIconForFilesTab())
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.fsBadgeIconUpload} /> : null
}

const styles = Styles.styleSheetCreate(() => ({
  fsBadgeIconUpload: {
    bottom: Styles.globalMargins.tiny,
    height: Styles.globalMargins.small,
    position: 'absolute',
    right: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
}))

// the nav assumes plain colors for animation in some cases so we can't use the themed colors there
export const theme: Theme = {
  colors: {
    get background() {
      // return themed.fastBlank as string
      return (DarkMode.useDarkModeState.getState().isDarkMode() ? darkColors.white : colors.white) as string
    },
    get border() {
      return themed.black_10 as string
    },
    get card() {
      return (
        DarkMode.useDarkModeState.getState().isDarkMode() ? darkColors.fastBlank : colors.fastBlank
      ) as string
    },
    get notification() {
      return themed.black as string
    },
    get primary() {
      return themed.black as string
    },
    get text() {
      return (DarkMode.useDarkModeState.getState().isDarkMode() ? darkColors.black : colors.black) as string
    },
  },
  dark: false,
}

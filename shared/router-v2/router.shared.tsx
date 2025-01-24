import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common'
import * as React from 'react'
import logger from '@/logger'
import Loading from '../login/loading'
import type {Theme} from '@react-navigation/native'
import {colors, darkColors, themed} from '@/styles/colors'
import {registerDebugClear} from '@/util/debug'

export enum AppState {
  UNINIT, // haven't rendered the nav yet
  NEEDS_INIT, // rendered but need to bootstrap
  INITED, // regular app now
}

const useConnectNavToState = () => {
  const setNavOnce = React.useRef(false)
  React.useEffect(() => {
    if (!setNavOnce.current) {
      if (C.Router2.navigationRef_.isReady()) {
        setNavOnce.current = true

        if (__DEV__) {
          window.DEBUGNavigator = C.Router2.navigationRef_.current
          window.DEBUGRouter2 = C.Router2
          window.KBCONSTANTS = require('@/constants')
          registerDebugClear(() => {
            window.DEBUGNavigator = undefined
            window.DEBUGRouter2 = undefined
            window.KBCONSTANTS = undefined
          })
        }
      }
    }
  }, [setNavOnce])
}

// if dark mode changes we should redraw
// on ios if dark mode changes and we're on system, ignore as it will thrash and we don't want that
const useDarkNeedsRedraw = (setNavKey: React.Dispatch<React.SetStateAction<number>>) => {
  const isDarkMode = C.useDarkModeState(s => s.isDarkMode())
  const [lastDarkMode, setLastDarkMode] = React.useState(isDarkMode)
  const darkModePreference = C.useDarkModeState(s => s.darkModePreference)
  const [lastDarkModePreference, setLastDarkModePreference] = React.useState(darkModePreference)

  React.useEffect(() => {
    if (lastDarkModePreference !== darkModePreference) {
      setLastDarkModePreference(darkModePreference)
      setNavKey(n => n + 1)
    }
    if (lastDarkMode !== isDarkMode) {
      setLastDarkMode(isDarkMode)
      if (
        Kb.Styles.isIOS &&
        lastDarkModePreference === darkModePreference &&
        darkModePreference === 'system'
      ) {
        return // dont force rerender if we're using system so we get animated colors
      }
      setNavKey(n => n + 1)
    }
  }, [isDarkMode, lastDarkMode, darkModePreference, lastDarkModePreference, setNavKey])
}

const useNavKey = (appState: AppState, setNavKey: React.Dispatch<React.SetStateAction<number>>) => {
  const needsInit = appState === AppState.NEEDS_INIT
  useDarkNeedsRedraw(needsInit ? () => {} : setNavKey)
}

export const useShared = () => {
  useConnectNavToState()
  // We use useRef and usePrevious so we can understand how our state has changed and do the right thing
  // if we use useEffect and useState we'll have to deal with extra renders which look really bad
  // if we ever were loaded just keep that state so we don't lose loggedin state when disconnecting
  const [everLoaded, setEverLoaded] = React.useState(false)
  const _loggedInLoaded = C.useDaemonState(s => s.handshakeState === 'done')
  const loggedInLoaded = everLoaded || _loggedInLoaded
  React.useEffect(() => {
    if (_loggedInLoaded) {
      setEverLoaded(true)
    }
  }, [_loggedInLoaded])

  const loggedIn = C.useConfigState(s => s.loggedIn)
  const loggedInUser = C.useCurrentUserState(s => s.username)
  const [navKey, setNavKey] = React.useState(1)
  // keep track if we went to an init route yet or not
  const [appState, setAppState] = React.useState(loggedInLoaded ? AppState.NEEDS_INIT : AppState.UNINIT)
  React.useEffect(() => {
    if (appState === AppState.UNINIT && loggedInLoaded) {
      setAppState(AppState.NEEDS_INIT)
    }
  }, [loggedInLoaded, appState])

  const setNavState = C.useRouterState(s => s.dispatch.setNavState)
  const onStateChange = React.useCallback(() => {
    const ns = C.Router2.getRootState()
    setNavState(ns)
  }, [setNavState])

  useNavKey(appState, setNavKey)

  const onUnhandledAction = React.useCallback(
    (
      a: Readonly<{
        type: string
        payload?: object | undefined
        source?: string | undefined
        target?: string | undefined
      }>
    ) => {
      logger.info(`[NAV] Unhandled action: ${a.type}`, a, C.Router2.logState())
    },
    []
  )
  return {
    appState,
    // initialState,
    loggedIn,
    loggedInLoaded,
    loggedInUser,
    navKey,
    onStateChange,
    onUnhandledAction,
    setAppState,
  }
}

export const SimpleLoading = React.memo(function SimpleLoading() {
  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={{backgroundColor: Kb.Styles.globalColors.white}}
    >
      <Loading allowFeedback={false} failed="" status="" />
    </Kb.Box2>
  )
})

export const FilesTabBadge = () => {
  const uploadIcon = C.useFSState(s => s.getUploadIconForFilesTab())
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.fsBadgeIconUpload} /> : null
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  fsBadgeIconUpload: {
    bottom: Kb.Styles.globalMargins.tiny,
    height: Kb.Styles.globalMargins.small,
    position: 'absolute',
    right: Kb.Styles.globalMargins.small,
    width: Kb.Styles.globalMargins.small,
  },
}))

// the nav assumes plain colors for animation in some cases so we can't use the themed colors there
export const theme: Theme = {
  colors: {
    get background() {
      return themed.white
    },
    get border() {
      return themed.black_10 as string
    },
    get card() {
      return (C.useDarkModeState.getState().isDarkMode() ? darkColors.fastBlank : colors.fastBlank) as string
    },
    get notification() {
      return themed.black as string
    },
    get primary() {
      return themed.black as string
    },
    get text() {
      return (C.useDarkModeState.getState().isDarkMode() ? darkColors.black : colors.black) as string
    },
  },
  dark: false,
  fonts: {
    bold: Kb.Styles.globalStyles.fontBold,
    heavy: Kb.Styles.globalStyles.fontExtrabold,
    medium: Kb.Styles.globalStyles.fontSemibold,
    regular: Kb.Styles.globalStyles.fontRegular,
  },
}

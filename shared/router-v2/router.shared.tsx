import * as C from '@/constants'
import * as Container from '@/util/container'
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
  const setNavigatorExists = C.useConfigState(s => s.dispatch.setNavigatorExists)
  React.useEffect(() => {
    if (!setNavOnce.current) {
      if (C.Router2.navigationRef_.isReady()) {
        setNavOnce.current = true
        setNavigatorExists()

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
  }, [setNavigatorExists, setNavOnce])
}

// if dark mode changes we should redraw
// on ios if dark mode changes and we're on system, ignore as it will thrash and we don't want that
const useDarkNeedsRedraw = () => {
  const isDarkMode = C.useDarkModeState(s => s.isDarkMode())
  const darkChanged = Container.usePrevious(isDarkMode) !== isDarkMode
  const darkModePreference = C.useDarkModeState(s => s.darkModePreference)
  const darkModePreferenceChanged = Container.usePrevious(darkModePreference) !== darkModePreference

  if (Kb.Styles.isIOS) {
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
  if (appState === AppState.NEEDS_INIT) {
    key.current = -1
  } else {
    if (needsRedraw) {
      key.current++
    }
  }
}

const useIsDarkChanged = () => {
  const isDarkMode = C.useDarkModeState(s => s.isDarkMode())
  const darkChanged = Container.usePrevious(isDarkMode) !== isDarkMode
  return darkChanged
}

const useInitialState = () => {
  const darkChanged = useIsDarkChanged()
  return darkChanged
    ? C.Router2.navigationRef_.isReady()
      ? C.Router2.navigationRef_.getRootState()
      : undefined
    : undefined
}

export const useShared = () => {
  useConnectNavToState()
  // We use useRef and usePrevious so we can understand how our state has changed and do the right thing
  // if we use useEffect and useState we'll have to deal with extra renders which look really bad
  // if we ever were loaded just keep that state so we don't lose loggedin state when disconnecting
  const everLoaded = React.useRef(false)
  const _loggedInLoaded = C.useDaemonState(s => s.handshakeState === 'done')
  const loggedInLoaded = everLoaded.current || _loggedInLoaded
  if (_loggedInLoaded) {
    everLoaded.current = true
  }

  const loggedIn = C.useConfigState(s => s.loggedIn)
  const navKeyRef = React.useRef(1)
  // keep track if we went to an init route yet or not
  const appState = React.useRef(loggedInLoaded ? AppState.NEEDS_INIT : AppState.UNINIT)

  if (appState.current === AppState.UNINIT && loggedInLoaded) {
    appState.current = AppState.NEEDS_INIT
  }

  const setNavState = C.useRouterState(s => s.dispatch.setNavState)
  const onStateChange = React.useCallback(() => {
    const ns = C.Router2.getRootState()
    setNavState(ns)
  }, [setNavState])

  useNavKey(appState.current, navKeyRef)
  const initialState = useInitialState()

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

  const navKey = navKeyRef.current
  return {
    appState,
    initialState,
    loggedIn,
    loggedInLoaded,
    navKey,
    onStateChange,
    onUnhandledAction,
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
        backgroundColor: Kb.Styles.globalColors.white,
        // backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
      }}
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
}

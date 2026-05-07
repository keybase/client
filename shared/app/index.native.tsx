/// <reference types="webpack-env" />
import * as C from '@/constants'
import {useConfigState} from '@/stores/config'
import {useShellState} from '@/stores/shell'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Main from './main.native'
import {KeyboardProvider} from 'react-native-keyboard-controller'
import Animated, {ReducedMotionConfig, ReduceMotion} from 'react-native-reanimated'
import {AppRegistry, AppState, Appearance, Keyboard} from 'react-native'
import {PortalProvider} from '@/common-adapters/portal.native'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {makeEngine} from '../engine'
import {GestureHandlerRootView} from 'react-native-gesture-handler'
import {enableFreeze} from 'react-native-screens'
import {setKeyboardUp} from '@/styles/keyboard-state'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'
import {useUnmountAll} from '@/util/debug-react'
import {darkModeSupported, guiConfig} from 'react-native-kb'
import {install} from 'react-native-kb'
import * as DarkMode from '@/stores/darkmode'
import {initPlatformListener, onEngineConnected, onEngineDisconnected, onEngineIncoming} from '@/constants/init/index.native'
import logger from '@/logger'

logger.info('INIT App index module load')

enableFreeze(true)
setServiceDecoration(ServiceDecoration)

module.hot?.accept(() => {
  console.log('accepted update in shared/index.native')
})

const initDarkMode = () => {
  const {setDarkModePreference, setSystemDarkMode, setSystemSupported} =
    DarkMode.useDarkModeState.getState().dispatch
  setSystemDarkMode(Appearance.getColorScheme() === 'dark')
  setSystemSupported(darkModeSupported)
  try {
    const obj = JSON.parse(guiConfig) as {ui?: {darkMode?: string}} | undefined
    const dm = obj?.ui?.darkMode
    switch (dm) {
      case 'system': // fallthrough
      case 'alwaysDark': // fallthrough
      case 'alwaysLight':
        setDarkModePreference(dm, false)
        break
      default:
    }
  } catch {}
}

const useDarkHookup = () => {
  const appStateRef = React.useRef('active')
  const setSystemDarkMode = DarkMode.useDarkModeState(s => s.dispatch.setSystemDarkMode)
  const setMobileAppState = useShellState(s => s.dispatch.setMobileAppState)

  React.useEffect(() => {
    const appStateChangeSub = AppState.addEventListener('change', nextAppState => {
      appStateRef.current = nextAppState
      if (nextAppState !== 'unknown' && nextAppState !== 'extension') {
        setMobileAppState(nextAppState)
      }

      if (nextAppState === 'active') {
        setSystemDarkMode(Appearance.getColorScheme() === 'dark')
      }
    })

    // only watch dark changes if in foreground due to ios calling this to take snapshots
    const darkSub = Appearance.addChangeListener(() => {
      if (appStateRef.current === 'active') {
        setSystemDarkMode(Appearance.getColorScheme() === 'dark')
      }
    })

    return () => {
      appStateChangeSub.remove()
      darkSub.remove()
    }
  }, [setSystemDarkMode, setMobileAppState])
}

const useKeyboardHookup = () => {
  React.useEffect(() => {
    const kbSubWS = Keyboard.addListener('keyboardWillShow', () => {
      setKeyboardUp(true)
    })
    const kbSubDS = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardUp(true)
    })
    const kbSubWH = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardUp(false)
    })
    const kbSubDH = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardUp(false)
    })
    return () => {
      kbSubWS.remove()
      kbSubDS.remove()
      kbSubWH.remove()
      kbSubDH.remove()
    }
  }, [])
}

const StoreHelper = (p: {children: React.ReactNode}): React.ReactNode => {
  const {children} = p
  useDarkHookup()
  useKeyboardHookup()

  return children
}

// dont' remake engine/store on reload
if (__DEV__ && !globalThis.DEBUGmadeEngine) {
  globalThis.DEBUGmadeEngine = false
}

// once per module
let inited = false
const useInit = () => {
  if (inited) return
  inited = true
  initDarkMode()
  Animated.addWhitelistedNativeProps({text: true})
  install()
  const {batch} = C.useWaitingState.getState().dispatch
  const eng = makeEngine(batch, c => {
    if (c) {
      onEngineConnected()
    } else {
      onEngineDisconnected()
    }
  }, onEngineIncoming)
  initPlatformListener()
  eng.listenersAreReady()

  // On mobile there is no installer
  useConfigState.getState().dispatch.installerRan()
}

// reanimated has issues updating shared values with this on seemingly w/ zoom toolkit
const wrapInStrict = false as boolean
const WRAP = wrapInStrict
  ? ({children}: {children: React.ReactNode}) => <React.StrictMode>{children}</React.StrictMode>
  : ({children}: {children: React.ReactNode}) => <>{children}</>

// on android this can be recreated a bunch so our engine/store / etc should live outside
const Keybase = () => {
  useInit()

  const {unmountAll, show} = useUnmountAll()

  return show ? (
    <WRAP>
      <KeyboardProvider statusBarTranslucent={true} navigationBarTranslucent={true}>
        <ReducedMotionConfig mode={ReduceMotion.Never} />
        <GestureHandlerRootView style={styles.gesture}>
          <PortalProvider>
            <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none">
              <StoreHelper>
                <Main />
                {unmountAll}
              </StoreHelper>
            </SafeAreaProvider>
          </PortalProvider>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </WRAP>
  ) : (
    unmountAll
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  gesture: {flexGrow: 1},
}))

const load = () => {
  AppRegistry.registerComponent('Keybase', () => Keybase)
}

export {load}

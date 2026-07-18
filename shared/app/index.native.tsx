import * as C from '@/constants'
import {useShellState} from '@/stores/shell'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Main from './main'
import {KeyboardProvider} from 'react-native-keyboard-controller'
import {ReducedMotionConfig, ReduceMotion} from 'react-native-reanimated'
import {AppRegistry, AppState, Appearance, Platform} from 'react-native'
import {PortalProvider} from '@/common-adapters/portal.native'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {makeEngine} from '../engine'
import {GestureHandlerRootView} from 'react-native-gesture-handler'
import {enableFreeze} from 'react-native-screens'
import {Image as ExpoImage} from 'expo-image'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'
import {useUnmountAll} from '@/util/debug-react'
import {darkModeSupported, guiConfig} from 'react-native-kb'
import * as DarkMode from '@/stores/darkmode'
import {colors, darkColors} from '@/styles/colors'
import {initPlatformListener, onEngineConnected, onEngineDisconnected, onEngineIncoming} from '@/constants/init/index'
import logger from '@/logger'

logger.info('INIT App index module load')

enableFreeze(true)
setServiceDecoration(ServiceDecoration)
// SDWebImage (used by expo-image) flushes its memory cache on iOS memory warnings, but
// the simulator never sends memory warnings. Cap the cache so loading hundreds of chat
// images doesn't exhaust VM in the simulator. On a real device this is a safety net only.
// configureCache is iOS-only native (no Android impl) so calling it on Android throws.
if (Platform.OS === 'ios') {
  ExpoImage.configureCache({maxMemoryCost: 100 * 1024 * 1024})
}

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

const StoreHelper = (p: {children: React.ReactNode}): React.ReactNode => {
  const {children} = p
  useDarkHookup()

  return children
}

// dont' remake engine/store on reload
if (__DEV__ && !globalThis.DEBUGmadeEngine) {
  globalThis.DEBUGmadeEngine = false
}

// once per module
let inited = false
const useInit = () => {
  React.useEffect(() => {
    if (inited) return
    inited = true
    initDarkMode()
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
  }, [])
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

  // The gap between screens during iOS 26 push transitions (the outgoing screen is inset) shows
  // the first opaque ancestor of the navigator. Nothing in react-navigation paints that region,
  // so this root view fills it with the themed app background instead of the black root view.
  const backgroundColor = DarkMode.useDarkModeState(s =>
    s.isDarkMode() ? darkColors.white : colors.white
  )

  return show ? (
    <WRAP>
      <KeyboardProvider statusBarTranslucent={true} navigationBarTranslucent={true}>
        <ReducedMotionConfig mode={ReduceMotion.Never} />
        <GestureHandlerRootView style={[styles.gesture, {backgroundColor}]}>
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

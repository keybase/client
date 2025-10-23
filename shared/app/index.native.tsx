import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Main from './main.native'
// crashy still
// import {KeyboardProvider} from 'react-native-keyboard-controller'
import Animated, {ReducedMotionConfig, ReduceMotion} from 'react-native-reanimated'
import {AppRegistry, AppState, Appearance, Linking, Keyboard} from 'react-native'
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

enableFreeze(true)
setServiceDecoration(ServiceDecoration)

module.hot?.accept(() => {
  console.log('accepted update in shared/index.native')
})

const useDarkHookup = () => {
  const initedRef = React.useRef(false)
  const appStateRef = React.useRef('active')
  const setSystemDarkMode = C.useDarkModeState(s => s.dispatch.setSystemDarkMode)
  const setMobileAppState = C.useConfigState(s => s.dispatch.setMobileAppState)
  const setSystemSupported = C.useDarkModeState(s => s.dispatch.setSystemSupported)
  const setDarkModePreference = C.useDarkModeState(s => s.dispatch.setDarkModePreference)

  // once
  if (!initedRef.current) {
    initedRef.current = true
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

  React.useEffect(() => {
    const appStateChangeSub = AppState.addEventListener('change', nextAppState => {
      appStateRef.current = nextAppState
      nextAppState !== 'unknown' && nextAppState !== 'extension' && setMobileAppState(nextAppState)

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

const StoreHelper = (p: {children: React.ReactNode}) => {
  const {children} = p
  useDarkHookup()
  useKeyboardHookup()
  const handleAppLink = C.useDeepLinksState(s => s.dispatch.handleAppLink)

  React.useEffect(() => {
    const linkingSub = Linking.addEventListener('url', ({url}: {url: string}) => {
      handleAppLink(url)
    })
    return () => {
      linkingSub.remove()
    }
  }, [handleAppLink])

  const darkMode = C.useDarkModeState(s => s.isDarkMode())
  return <Kb.Styles.DarkModeContext.Provider value={darkMode}>{children}</Kb.Styles.DarkModeContext.Provider>
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
  Animated.addWhitelistedNativeProps({text: true})
  install()
  const {batch} = C.useWaitingState.getState().dispatch
  const eng = makeEngine(batch, c => {
    if (c) {
      C.useEngineState.getState().dispatch.onEngineConnected()
    } else {
      C.useEngineState.getState().dispatch.onEngineDisconnected()
    }
  })
  C.initListeners()
  eng.listenersAreReady()

  // On mobile there is no installer
  C.useConfigState.getState().dispatch.installerRan()
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

  // <KeyboardProvider statusBarTranslucent={true} navigationBarTranslucent={true}>
  return show ? (
    <WRAP>
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      <GestureHandlerRootView style={styles.gesture}>
        <PortalProvider>
          <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none">
            <StoreHelper>
              <Kb.Styles.CanFixOverdrawContext.Provider value={true}>
                <Main />
                {unmountAll}
              </Kb.Styles.CanFixOverdrawContext.Provider>
            </StoreHelper>
          </SafeAreaProvider>
        </PortalProvider>
      </GestureHandlerRootView>
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

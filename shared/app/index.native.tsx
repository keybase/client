import * as C from '../constants'
import * as Styles from '../styles'
import * as React from 'react'
import {chatDebugEnabled} from '../constants/chat2/debug'
import Main from './main.native'
import makeStore from '../store/configure-store'
import {AppRegistry, AppState, Appearance, Linking, Keyboard} from 'react-native'
import {PortalProvider} from '../common-adapters/portal.native'
import {Provider, useDispatch} from 'react-redux'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {makeEngine} from '../engine'
import {GestureHandlerRootView} from 'react-native-gesture-handler'
import {enableFreeze} from 'react-native-screens'
import {setKeyboardUp} from '../styles/keyboard-state'
enableFreeze(true)

type ConfigureStore = ReturnType<typeof makeStore>
let _store: ConfigureStore | undefined

module.hot?.accept(() => {
  console.log('accepted update in shared/index.native')
})

const ReduxHelper = (p: {children: React.ReactNode}) => {
  const {children} = p
  const dispatch = useDispatch()
  const appStateRef = React.useRef('active')
  const {setSystemDarkMode} = C.useDarkModeState.getState().dispatch
  const handleAppLink = C.useDeepLinksState(s => s.dispatch.handleAppLink)
  const setMobileAppState = C.useConfigState(s => s.dispatch.setMobileAppState)
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
    const linkingSub = Linking.addEventListener('url', ({url}: {url: string}) => {
      handleAppLink(url)
    })

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
      appStateChangeSub.remove()
      darkSub.remove()
      linkingSub.remove()
      kbSubWS.remove()
      kbSubDS.remove()
      kbSubWH.remove()
      kbSubDH.remove()
    }
  }, [dispatch, setSystemDarkMode, handleAppLink, setMobileAppState])

  const darkMode = C.useDarkModeState(s => s.isDarkMode())
  return <Styles.DarkModeContext.Provider value={darkMode}>{children}</Styles.DarkModeContext.Provider>
}

// dont' remake engine/store on reload
if (__DEV__ && !globalThis.DEBUGmadeEngine) {
  globalThis.DEBUGmadeEngine = false
}

const ensureStore = () => {
  if (__DEV__) {
    if (globalThis.DEBUGmadeEngine) {
      _store = global.DEBUGStore
      return
    }
    globalThis.DEBUGmadeEngine = true
  }
  if (_store) {
    return
  }
  _store = makeStore()
  if (__DEV__ || chatDebugEnabled) {
    global.DEBUGStore = _store
  }

  const {batch} = C.useWaitingState.getState().dispatch
  const eng = makeEngine(batch, c => {
    if (c) {
      C.useEngineState.getState().dispatch.onEngineConnected()
    } else {
      C.useEngineState.getState().dispatch.onEngineDisconnected()
    }
  })
  _store.initListeners()
  eng.listenersAreReady()

  // On mobile there is no installer
  C.useConfigState.getState().dispatch.installerRan()
}

// on android this can be recreated a bunch so our engine/store / etc should live outside
const Keybase = () => {
  ensureStore()

  if (!_store) return null // never happens

  // reanimated still isn't compatible yet with strict mode
  // <React.StrictMode>
  // </React.StrictMode>
  return (
    <GestureHandlerRootView style={styles.gesture}>
      <Provider store={_store.store}>
        <PortalProvider>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <ReduxHelper>
              <Styles.CanFixOverdrawContext.Provider value={true}>
                <Main />
              </Styles.CanFixOverdrawContext.Provider>
            </ReduxHelper>
          </SafeAreaProvider>
        </PortalProvider>
      </Provider>
    </GestureHandlerRootView>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  gesture: {flexGrow: 1},
}))

function load() {
  AppRegistry.registerComponent('Keybase', () => Keybase)
}

export {load}

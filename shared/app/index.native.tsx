import * as ConfigGen from '../actions/config-gen'
import * as Styles from '../styles'
import * as DeeplinksGen from '../actions/deeplinks-gen'
import * as React from 'react'
import Main from './main.native'
import makeStore from '../store/configure-store'
import {AppRegistry, AppState, Appearance, Linking} from 'react-native'
import {PortalProvider} from '@gorhom/portal'
import {Provider, useDispatch} from 'react-redux'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {makeEngine} from '../engine'
import {GestureHandlerRootView} from 'react-native-gesture-handler'

type ConfigureStore = ReturnType<typeof makeStore>
let _store: ConfigureStore | undefined

module.hot?.accept(() => {
  console.log('accepted update in shared/index.native')
})

const NativeEventsToRedux = (p: {setDarkMode: (d: boolean) => void}) => {
  const {setDarkMode} = p
  const dispatch = useDispatch()
  const appStateRef = React.useRef('active')

  const dispatchAndSetDarkmode = React.useCallback(
    (dark: boolean) => {
      setDarkMode(dark)
      dispatch(ConfigGen.createSetSystemDarkMode({dark}))
    },
    [dispatch, setDarkMode]
  )

  React.useEffect(() => {
    const appStateChangeSub = AppState.addEventListener('change', nextAppState => {
      appStateRef.current = nextAppState
      nextAppState !== 'unknown' &&
        nextAppState !== 'extension' &&
        dispatch(ConfigGen.createMobileAppState({nextAppState}))

      if (nextAppState === 'active') {
        dispatchAndSetDarkmode(Appearance.getColorScheme() === 'dark')
      }
    })

    // only watch dark changes if in foreground due to ios calling this to take snapshots
    const darkSub = Appearance.addChangeListener(() => {
      if (appStateRef.current === 'active') {
        dispatchAndSetDarkmode(Appearance.getColorScheme() === 'dark')
      }
    })
    const linkingSub = Linking.addEventListener('url', ({url}: {url: string}) => {
      dispatch(DeeplinksGen.createLink({link: url}))
    })

    return () => {
      appStateChangeSub.remove()
      darkSub.remove()
      linkingSub.remove()
    }
  }, [dispatch, dispatchAndSetDarkmode])

  return null
}

// dont' remake engine/store on reload
if (__DEV__ && !globalThis.madeEngine) {
  globalThis.madeEngine = false
}

const ensureStore = () => {
  if (__DEV__) {
    if (globalThis.madeEngine) {
      _store = global.DEBUGStore
      return
    }
    globalThis.madeEngine = true
  }
  if (_store) {
    return
  }
  _store = makeStore()
  if (__DEV__) {
    global.DEBUGStore = _store
  }

  const eng = makeEngine(_store.store.dispatch)
  _store.initListeners()
  eng.listenersAreReady()

  // On mobile there is no installer
  _store.store.dispatch(ConfigGen.createInstallerRan())
}

// on android this can be recreated a bunch so our engine/store / etc should live outside
const Keybase = () => {
  ensureStore()

  const [darkMode, setDarkMode] = React.useState(Styles.isDarkMode())

  if (!_store) return null // never happens

  // TODO if we use it, add it here
  // <React.StrictMode>
  // </React.StrictMode>
  return (
    <GestureHandlerRootView style={styles.gesture}>
      <Provider store={_store.store}>
        <PortalProvider>
          <SafeAreaProvider>
            <Styles.DarkModeContext.Provider value={darkMode}>
              <Styles.CanFixOverdrawContext.Provider value={true}>
                <Main />
              </Styles.CanFixOverdrawContext.Provider>
            </Styles.DarkModeContext.Provider>
          </SafeAreaProvider>
        </PortalProvider>
        <NativeEventsToRedux setDarkMode={setDarkMode} />
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

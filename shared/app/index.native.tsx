import * as ConfigGen from '../actions/config-gen'
import * as DeeplinksGen from '../actions/deeplinks-gen'
import * as React from 'react'
import Main from './main.native'
import configureStore from '../store/configure-store'
import {AppRegistry, AppState, Appearance, Linking} from 'react-native'
import {PortalProvider} from '@gorhom/portal'
import {Provider, useDispatch} from 'react-redux'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {makeEngine} from '../engine'

let store: ReturnType<typeof configureStore>['store']

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in shared/index.native')
    store = global.DEBUGStore
  })

const NativeEventsToRedux = () => {
  const dispatch = useDispatch()

  React.useEffect(() => {
    const appStateChangeSub = AppState.addEventListener('change', nextAppState => {
      store &&
        nextAppState !== 'unknown' &&
        nextAppState !== 'extension' &&
        dispatch(ConfigGen.createMobileAppState({nextAppState}))
    })

    const darkSub = Appearance.addChangeListener(() => {
      dispatch(ConfigGen.createSetSystemDarkMode({dark: Appearance.getColorScheme() === 'dark'}))
    })

    const linkingSub = Linking.addEventListener('url', ({url}: {url: string}) => {
      dispatch(DeeplinksGen.createLink({link: url}))
    })

    return () => {
      appStateChangeSub?.remove()
      darkSub?.remove()
      linkingSub?.remove()
    }
  }, [])

  return null
}

const Keybase = () => {
  const madeStoreRef = React.useRef(false)

  if (!madeStoreRef.current) {
    madeStoreRef.current = true
    if (!global.DEBUGLoaded) {
      global.DEBUGLoaded = true
      const temp = configureStore()
      store = temp.store
      if (__DEV__) {
        global.DEBUGStore = temp.store
      }
      const eng = makeEngine(temp.store.dispatch, temp.store.getState)
      temp.runSagas()
      eng.sagasAreReady()

      // On mobile there is no installer
      temp.store.dispatch(ConfigGen.createInstallerRan())
    }
  }

  return (
    <Provider store={store}>
      <PortalProvider>
        <SafeAreaProvider>
          <Main />
        </SafeAreaProvider>
      </PortalProvider>
      <NativeEventsToRedux />
    </Provider>
  )
}

function load() {
  AppRegistry.registerComponent('Keybase', () => Keybase)
}

export {load}

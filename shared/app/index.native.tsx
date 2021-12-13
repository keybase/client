import * as ConfigGen from '../actions/config-gen'
import Main from './main.native'
import * as React from 'react'
import configureStore from '../store/configure-store'
import {AppRegistry, AppState} from 'react-native'
import {PortalProvider} from '@gorhom/portal'
import {Provider} from 'react-redux'
import {makeEngine} from '../engine'
import {SafeAreaProvider} from 'react-native-safe-area-context'

let store: ReturnType<typeof configureStore>['store']

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in shared/index.native')
    store = global.DEBUGStore
  })


const Keybase = () => {
    const madeStoreRef = React.useRef(false);
    console.log('aaa rendering root Keybase', {store, madeStoreRef, globalD: global.DEBUGStore})

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

    React.useEffect(() => {
            const appStateChangeSub = AppState.addEventListener('change', nextAppState => {
              store && store.dispatch(ConfigGen.createMobileAppState({nextAppState}))
            })
            return () => appStateChangeSub?.remove() 
    }, [])


    return (
      <Provider store={store}>
        <PortalProvider>
          <SafeAreaProvider>
            <Main />
          </SafeAreaProvider>
        </PortalProvider>
      </Provider>
    )
}

function load() {
  AppRegistry.registerComponent('Keybase', () => Keybase)
}

export {load}

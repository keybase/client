import * as ConfigGen from '../actions/config-gen'
import * as DeeplinksGen from '../actions/deeplinks-gen'
import Main from './main.native'
import * as React from 'react'
import configureStore from '../store/configure-store'
import {AppRegistry, AppState, Linking} from 'react-native'
import {GatewayProvider} from '@chardskarth/react-gateway'
import {Provider} from 'react-redux'
import {makeEngine} from '../engine'
import {SafeAreaProvider} from 'react-native-safe-area-context'

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in shared/index.native')
  })

let store: ReturnType<typeof configureStore>['store']

type Props = {}

class Keybase extends React.Component<Props> {
  constructor(props: Props) {
    super(props)

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

    AppState.addEventListener('change', this._handleAppStateChange)
  }

  componentDidMount() {
    Linking.addEventListener('url', this._handleOpenURL)
    Linking.getInitialURL().then(url => url && this._handleOpenURL({url}))
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this._handleAppStateChange)
    Linking.removeEventListener('url', this._handleOpenURL)
  }

  _handleOpenURL(event: {url: string}) {
    store && store.dispatch(DeeplinksGen.createLink({link: event.url}))
  }

  _handleAppStateChange = (nextAppState: 'active' | 'background' | 'inactive') => {
    store && store.dispatch(ConfigGen.createMobileAppState({nextAppState}))
  }

  render() {
    return (
      <Provider store={store}>
        <GatewayProvider>
          <SafeAreaProvider>
            <Main />
          </SafeAreaProvider>
        </GatewayProvider>
      </Provider>
    )
  }
}

function load() {
  AppRegistry.registerComponent('Keybase', () => Keybase)
}

export {load}

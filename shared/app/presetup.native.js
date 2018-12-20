// @flow
// Saves some startup time by making some slow calls at the beginning so they can run in parallel to all our requires and js startup time cost.

// This can be removed when we aren't profiling the app.
import {YellowBox} from 'react-native'
import configureStore from '../store/configure-store'
import loginRouteTree from './routes-login'
import {makeEngine} from '../engine'
import {setInitialRouteDef} from '../actions/route-tree'
import * as ConfigGen from '../actions/config-gen'

// const modules = require.getModules()
// const moduleIds = Object.keys(modules)
// const loadedModuleNames = moduleIds
//   .filter(moduleId => modules[moduleId].isInitialized)
//   .map(moduleId => modules[moduleId].verboseName)
// const waitingModuleNames = moduleIds
//   .filter(moduleId => !modules[moduleId].isInitialized)
//   .map(moduleId => modules[moduleId].verboseName)
//
// // make sure that the modules you expect to be waiting are actually waiting
// console.log('loaded:', loadedModuleNames.length, 'waiting:', waitingModuleNames.length)
//
// // grab this text blob, and put it in a file named packager/modulePaths.js
// console.log(`module.exports = ${JSON.stringify(loadedModuleNames.sort())};`)
// console.log(`waiting is ${JSON.stringify(waitingModuleNames.sort())};`)

function load() {
  performance.mark('app-end')
  performance.measure('app-start', 'app-start')
  YellowBox.ignoreWarnings(['Require cycle:'])

  performance.mark('configuring store')
  const {store, runSagas} = configureStore()
  global.store = store
  if (__DEV__) {
    global.DEBUGStore = this.store
  }
  performance.measure('configuring store', 'configuring store')

  performance.mark('configure engine')
  makeEngine(store.dispatch, store.getState)
  performance.measure('configure engine', 'configure engine')

  performance.mark('configure sagas')
  runSagas()

  store.dispatch(setInitialRouteDef(loginRouteTree))
  store.dispatch(ConfigGen.createInstallerRan())
  // store.dispatch(setInitialRouteDef(loginRouteTree))

  // On mobile there is no installer
  // store.dispatch(ConfigGen.createInstallerRan())
  performance.measure('configure sagas', 'configure sagas')

  performance.mark('call appLoad')
  const appLoad = require('./index-presetup.native').load
  appLoad()

  performance.measure('call appLoad', 'call appLoad')
  console.log('App is loaded here')
}

export {load}
